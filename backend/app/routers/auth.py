from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.deps import get_current_user
from app.models import Organization, User
from app.models.enums import OrgType, Role
from app.schemas import LoginIn, RefreshIn, Token, UserCreate, UserOut
from app.services.matching import normalize

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Qué tipo de organización corresponde a cada rol
ROLE_ORG = {
    Role.EMPRESA: OrgType.EMPRESA,
    Role.GOBIERNO: OrgType.GOBIERNO,
    Role.UNIVERSIDAD: OrgType.UNIVERSIDAD,
    Role.ESTUDIANTE: OrgType.UNIVERSIDAD,
    Role.ACADEMICO: OrgType.UNIVERSIDAD,
}

ORG_OWNER_ROLES = (Role.EMPRESA, Role.GOBIERNO, Role.UNIVERSIDAD)


def _tokens(user: User) -> Token:
    return Token(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """Registro para cualquier actor. Puede crear su organización en el mismo paso."""
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "El correo ya está registrado")

    org_id = data.organization_id
    # Quien da de alta una empresa, dependencia o universidad crea la suya: no puede unirse
    # a una organización ajena (quedaría como su responsable sin serlo)
    if data.role in ORG_OWNER_ROLES and org_id is not None:
        raise HTTPException(422, "Escribe el nombre de tu organización para registrarla")
    if data.organization:
        if data.organization.type != ROLE_ORG[data.role]:
            raise HTTPException(422, f"Un usuario '{data.role.value}' debe pertenecer a una organización "
                                     f"de tipo '{ROLE_ORG[data.role].value}'")
        name = data.organization.name.strip()
        same_type = db.scalars(select(Organization.name).where(Organization.type == data.organization.type))
        if any(normalize(n) == normalize(name) for n in same_type):
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"Ya existe una organización registrada como '{name}'. Si es la tuya, pide a su "
                                "responsable que te dé acceso; si es otra, agrega algo que la distinga (p. ej. la ciudad).")
        org = Organization(**{**data.organization.model_dump(), "name": name})
        db.add(org)
        db.flush()
        org_id = org.id
    elif org_id is not None:
        org = db.get(Organization, org_id)
        if not org:
            raise HTTPException(404, "Organización no encontrada")
        if org.type != ROLE_ORG[data.role]:
            raise HTTPException(422, "El tipo de organización no corresponde con el rol")

    if data.role in ORG_OWNER_ROLES and org_id is None:
        raise HTTPException(422, "Escribe el nombre de tu empresa, dependencia o institución para crear la cuenta")

    user = User(
        email=email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        organization_id=org_id,
        career=data.career,
        semester=data.semester,
        skills=data.skills,
        bio=data.bio,
        portfolio_url=data.portfolio_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta desactivada")
    return user


@router.post("/login", response_model=Token)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Login JSON (recomendado para la web y la app móvil)."""
    return _tokens(_authenticate(db, data.email, data.password))


@router.post("/token", response_model=Token, include_in_schema=True)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login por formulario OAuth2 (lo usa el botón 'Authorize' de Swagger)."""
    return _tokens(_authenticate(db, form.username, form.password))


@router.post("/refresh", response_model=Token)
def refresh(data: RefreshIn, db: Session = Depends(get_db)):
    """Renueva la sesión sin volver a pedir contraseña (clave para la app móvil)."""
    user_id = decode_token(data.refresh_token, "refresh")
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token inválido")
    return _tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
