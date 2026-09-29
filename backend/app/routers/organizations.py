from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import Pagination, get_current_user, require_roles
from app.models import Capability, Organization, User
from app.models.enums import CapabilityType, OrgType, Role
from app.schemas import (
    CapabilityCreate, CapabilityOut, OrganizationOut, OrganizationUpdate, Page,
)
from app.services.common import get_or_404

router = APIRouter(tags=["Organizaciones y capacidades"])


def _check_member(user: User, org_id: int) -> None:
    if user.role != Role.ADMIN and user.organization_id != org_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo miembros de la organización pueden modificarla")


# ---------------------------------------------------------------- Organizaciones
@router.get("/organizations", response_model=Page[OrganizationOut])
def list_organizations(
    type: OrgType | None = None,
    state: str | None = None,
    q: str | None = None,
    verified: bool | None = None,
    pag: Pagination = Depends(),
    db: Session = Depends(get_db),
):
    """Directorio público de empresas, universidades y dependencias."""
    stmt = select(Organization)
    if type:
        stmt = stmt.where(Organization.type == type)
    if state:
        stmt = stmt.where(Organization.state.ilike(f"%{state}%"))
    if verified is not None:
        stmt = stmt.where(Organization.verified.is_(verified))
    if q:
        stmt = stmt.where(or_(Organization.name.ilike(f"%{q}%"), Organization.sector.ilike(f"%{q}%")))
    return pag.apply(db, stmt.order_by(Organization.name))


@router.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(org_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Organization, org_id, "Organización")


@router.patch("/organizations/{org_id}", response_model=OrganizationOut)
def update_organization(org_id: int, data: OrganizationUpdate,
                        user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = get_or_404(db, Organization, org_id, "Organización")
    _check_member(user, org_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(org, k, v)
    db.commit()
    return org


@router.post("/organizations/{org_id}/verify", response_model=OrganizationOut)
def verify_organization(org_id: int, _: User = Depends(require_roles(Role.ADMIN)),
                        db: Session = Depends(get_db)):
    """El administrador valida la organización (sello de confianza)."""
    org = get_or_404(db, Organization, org_id, "Organización")
    org.verified = True
    db.commit()
    return org


# ---------------------------------------------------------------- Capacidades
@router.get("/capabilities", response_model=Page[CapabilityOut])
def search_capabilities(
    q: str | None = Query(None, description="Busca en nombre, descripción y etiquetas"),
    type: CapabilityType | None = None,
    organization_id: int | None = None,
    state: str | None = None,
    available: bool | None = True,
    pag: Pagination = Depends(),
    db: Session = Depends(get_db),
):
    """Catálogo público de laboratorios, equipo, expertos y servicios universitarios."""
    stmt = select(Capability).join(Organization)
    if type:
        stmt = stmt.where(Capability.type == type)
    if organization_id:
        stmt = stmt.where(Capability.organization_id == organization_id)
    if state:
        stmt = stmt.where(Organization.state.ilike(f"%{state}%"))
    if available is not None:
        stmt = stmt.where(Capability.available.is_(available))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Capability.name.ilike(like), Capability.description.ilike(like),
                              cast(Capability.tags, String).ilike(like)))
    return pag.apply(db, stmt.order_by(Capability.name))


@router.post("/organizations/{org_id}/capabilities", response_model=CapabilityOut, status_code=201)
def create_capability(org_id: int, data: CapabilityCreate,
                      user: User = Depends(require_roles(Role.UNIVERSIDAD, Role.ACADEMICO)),
                      db: Session = Depends(get_db)):
    org = get_or_404(db, Organization, org_id, "Organización")
    if org.type != OrgType.UNIVERSIDAD:
        raise HTTPException(422, "Solo las universidades registran capacidades")
    _check_member(user, org_id)
    cap = Capability(organization_id=org_id, **data.model_dump())
    db.add(cap)
    db.commit()
    return cap


@router.get("/capabilities/{cap_id}", response_model=CapabilityOut)
def get_capability(cap_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Capability, cap_id, "Capacidad")


@router.put("/capabilities/{cap_id}", response_model=CapabilityOut)
def update_capability(cap_id: int, data: CapabilityCreate,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cap = get_or_404(db, Capability, cap_id, "Capacidad")
    _check_member(user, cap.organization_id)
    for k, v in data.model_dump().items():
        setattr(cap, k, v)
    db.commit()
    return cap


@router.delete("/capabilities/{cap_id}", status_code=204)
def delete_capability(cap_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cap = get_or_404(db, Capability, cap_id, "Capacidad")
    _check_member(user, cap.organization_id)
    db.delete(cap)
    db.commit()
