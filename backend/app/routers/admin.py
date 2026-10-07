"""Consultas exclusivas del administrador: universidades y personas registradas."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import Pagination, require_roles
from app.models import Organization, UniversityCareer, User
from app.models.enums import OrgType, Role
from app.schemas import AdminUniversity, AdminUser, Page
from app.services.matching import normalize

router = APIRouter(prefix="/admin", tags=["Administración"])
solo_admin = require_roles(Role.ADMIN)


def _matches(q: str | None, *fields: str | None) -> bool:
    """Todas las palabras de la búsqueda aparecen en los campos (sin distinguir acentos ni mayúsculas)."""
    if not q:
        return True
    text = normalize(" ".join(f for f in fields if f))
    return all(w in text for w in normalize(q).split())


@router.get("/universities", response_model=list[AdminUniversity])
def registered_universities(
    q: str | None = Query(None, description="Nombre, ciudad o estado"),
    _: User = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    """Universidades registradas con cuántos alumnos, académicos y carreras tiene cada una."""
    unis = db.scalars(select(Organization).where(Organization.type == OrgType.UNIVERSIDAD).order_by(Organization.name))
    people = {(org_id, role): n for org_id, role, n in db.execute(
        select(User.organization_id, User.role, func.count()).where(User.is_active.is_(True))
        .group_by(User.organization_id, User.role))}
    careers = dict(db.execute(select(UniversityCareer.organization_id, func.count())
                              .group_by(UniversityCareer.organization_id)).all())
    return [
        AdminUniversity.model_validate(o).model_copy(update={
            "students": people.get((o.id, Role.ESTUDIANTE), 0),
            "academics": people.get((o.id, Role.ACADEMICO), 0),
            "careers": careers.get(o.id, 0),
        })
        for o in unis if _matches(q, o.name, o.city, o.state)
    ]


@router.get("/users", response_model=Page[AdminUser])
def registered_users(
    role: Role | None = Query(None, description="Por ejemplo, estudiante"),
    organization_id: int | None = None,
    q: str | None = Query(None, description="Nombre, correo, carrera u organización"),
    pag: Pagination = Depends(),
    _: User = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    """Personas registradas (sin administradores), las más recientes primero, con su correo y organización."""
    stmt = select(User).where(User.role != Role.ADMIN)
    if role:
        stmt = stmt.where(User.role == role)
    if organization_id:
        stmt = stmt.where(User.organization_id == organization_id)
    org_names = dict(db.execute(select(Organization.id, Organization.name)).all())
    users = [u for u in db.scalars(stmt.order_by(User.created_at.desc(), User.id.desc()))
             if _matches(q, u.full_name, u.email, u.career, org_names.get(u.organization_id))]
    return pag.apply_list(users, lambda u: AdminUser.model_validate(u).model_copy(
        update={"organization_name": org_names.get(u.organization_id)}))
