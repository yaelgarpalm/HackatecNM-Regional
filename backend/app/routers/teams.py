"""Equipos multidisciplinarios de estudiantes con asesor académico."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_roles
from app.models import Team, TeamMember, User
from app.models.enums import Role, TeamRole
from app.schemas import TeamCreate, TeamMemberIn, TeamOut
from app.services.common import get_or_404, notify, team_out

router = APIRouter(prefix="/teams", tags=["Equipos"])


def _leader_or_advisor(db: Session, team: Team, user: User) -> None:
    if user.role == Role.ADMIN:
        return
    m = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id))
    if not m or m.role == TeamRole.INTEGRANTE:
        raise HTTPException(403, "Solo el líder o el asesor pueden administrar el equipo")


@router.post("", response_model=TeamOut, status_code=201)
def create_team(data: TeamCreate, user: User = Depends(require_roles(Role.ESTUDIANTE, Role.ACADEMICO)),
                db: Session = Depends(get_db)):
    """Quien crea el equipo queda como líder (estudiante) o asesor (académico)."""
    team = Team(name=data.name, description=data.description,
                university_id=user.organization_id, created_by_id=user.id)
    role = TeamRole.ASESOR if user.role == Role.ACADEMICO else TeamRole.LIDER
    team.members.append(TeamMember(user_id=user.id, role=role))
    db.add(team)
    db.commit()
    db.refresh(team)
    return team_out(team)


@router.get("/mine", response_model=list[TeamOut])
def my_teams(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Team).join(TeamMember).where(TeamMember.user_id == user.id).order_by(Team.id)
    return [team_out(t) for t in db.scalars(stmt).unique()]


@router.get("/{team_id}", response_model=TeamOut)
def get_team(team_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return team_out(get_or_404(db, Team, team_id, "Equipo"))


@router.post("/{team_id}/members", response_model=TeamOut, status_code=201)
def add_member(team_id: int, data: TeamMemberIn, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Agrega integrantes de CUALQUIER carrera (e incluso de otra universidad)."""
    team = get_or_404(db, Team, team_id, "Equipo")
    _leader_or_advisor(db, team, user)
    new = get_or_404(db, User, data.user_id, "Usuario")
    if new.role not in (Role.ESTUDIANTE, Role.ACADEMICO):
        raise HTTPException(422, "Solo estudiantes y académicos pueden integrarse a equipos")
    if data.role == TeamRole.ASESOR and new.role != Role.ACADEMICO:
        raise HTTPException(422, "El asesor debe ser un académico")
    if any(m.user_id == new.id for m in team.members):
        raise HTTPException(409, "El usuario ya pertenece al equipo")
    team.members.append(TeamMember(user_id=new.id, role=data.role))
    notify(db, new.id, f"Te agregaron al equipo '{team.name}'", None, f"/equipos/{team.id}")
    db.commit()
    db.refresh(team)
    return team_out(team)


@router.delete("/{team_id}/members/{user_id}", response_model=TeamOut)
def remove_member(team_id: int, user_id: int, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    team = get_or_404(db, Team, team_id, "Equipo")
    if user.id != user_id:  # cualquiera puede salirse por sí mismo
        _leader_or_advisor(db, team, user)
    member = next((m for m in team.members if m.user_id == user_id), None)
    if not member:
        raise HTTPException(404, "El usuario no pertenece al equipo")
    team.members.remove(member)
    db.commit()
    db.refresh(team)
    return team_out(team)
