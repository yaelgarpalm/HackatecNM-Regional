"""Recomendaciones personalizadas, indicadores de vinculación y catálogos."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_roles
from app.models import Capability, Challenge, Milestone, Organization, Proposal, Review, Team, TeamMember, User
from app.models.enums import (
    CapabilityType, ChallengeStatus, Confidentiality, IPModel, MilestoneStatus, Modality,
    OrgSize, OrgType, ProposalStatus, Role, TeamRole,
)
from app.schemas import ChallengeMatch
from app.services.careers import CARRERAS
from app.services.common import career_allows, challenge_out
from app.services.matching import score_challenge_for_user

router = APIRouter(tags=["Recomendaciones e indicadores"])


@router.get("/recommendations/challenges", response_model=list[ChallengeMatch])
def recommended_challenges(limit: int = Query(10, le=50),
                           user: User = Depends(require_roles(Role.ESTUDIANTE, Role.ACADEMICO)),
                           db: Session = Depends(get_db)):
    """Problemáticas abiertas ordenadas por afinidad con la carrera y habilidades del usuario."""
    results = []
    for ch in db.scalars(select(Challenge).where(Challenge.status == ChallengeStatus.ABIERTO)):
        if not career_allows(user, ch):
            continue
        score, reasons = score_challenge_for_user(user, ch)
        if score > 0:
            results.append(ChallengeMatch(challenge=challenge_out(db, ch, user), score=score, reasons=reasons))
    return sorted(results, key=lambda r: r.score, reverse=True)[:limit]


def _count(db: Session, stmt) -> int:
    return db.scalar(stmt) or 0


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)):
    """Indicadores públicos de vinculación (útiles para la portada y para acreditaciones)."""
    by_status = dict(db.execute(select(Challenge.status, func.count()).group_by(Challenge.status)).all())
    return {
        "organizaciones": {
            t.value: _count(db, select(func.count(Organization.id)).where(Organization.type == t)) for t in OrgType
        },
        "usuarios": {
            r.value: _count(db, select(func.count(User.id)).where(User.role == r))
            for r in Role if r != Role.ADMIN
        },
        "retos": {s.value: by_status.get(s, 0) for s in ChallengeStatus},
        "postulaciones": _count(db, select(func.count(Proposal.id))),
        "equipos": _count(db, select(func.count(Team.id))),
        "capacidades_publicadas": _count(db, select(func.count(Capability.id))),
        "hitos_aprobados": _count(db, select(func.count(Milestone.id))
                                  .where(Milestone.status == MilestoneStatus.APROBADO)),
        "calificacion_promedio": round(float(db.scalar(select(func.avg(Review.score))) or 0), 2),
    }


@router.get("/stats/university/{org_id}")
def university_stats(org_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Indicadores de vinculación de una universidad específica."""
    students = select(User.id).where(User.organization_id == org_id)
    teams = select(TeamMember.team_id).where(TeamMember.user_id.in_(students))
    proposals = select(Proposal).where(Proposal.team_id.in_(teams))
    accepted = proposals.where(Proposal.status == ProposalStatus.ACEPTADA)
    return {
        "estudiantes_registrados": _count(db, select(func.count()).select_from(
            select(User.id).where(User.organization_id == org_id, User.role == Role.ESTUDIANTE).subquery())),
        "capacidades": _count(db, select(func.count(Capability.id)).where(Capability.organization_id == org_id)),
        "postulaciones": _count(db, select(func.count()).select_from(proposals.subquery())),
        "proyectos_vinculados": _count(db, select(func.count()).select_from(accepted.subquery())),
        "empresas_atendidas": _count(db, select(func.count(func.distinct(Challenge.organization_id)))
                                     .join(Proposal, Proposal.challenge_id == Challenge.id)
                                     .where(Proposal.team_id.in_(teams),
                                            Proposal.status == ProposalStatus.ACEPTADA)),
    }


@router.get("/catalogs")
def catalogs():
    """Valores válidos para selects/dropdowns en la web y la app (evita codificarlos en el frontend)."""
    as_list = lambda e: [i.value for i in e]  # noqa: E731
    return {
        "roles": [r for r in as_list(Role) if r != "admin"],
        "tipos_organizacion": as_list(OrgType),
        "tamanos_organizacion": as_list(OrgSize),
        "tipos_capacidad": as_list(CapabilityType),
        "estados_reto": as_list(ChallengeStatus),
        "confidencialidad": as_list(Confidentiality),
        "propiedad_intelectual": as_list(IPModel),
        "modalidades": as_list(Modality),
        "roles_equipo": as_list(TeamRole),
        "estados_postulacion": as_list(ProposalStatus),
        "estados_hito": as_list(MilestoneStatus),
        "carreras": list(CARRERAS),
    }
