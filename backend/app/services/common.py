"""Utilidades de dominio compartidas por los routers."""
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Challenge, NdaAcceptance, Notification, Proposal, Team, TeamMember, User
from app.models.enums import Confidentiality, ProposalStatus, Role, TeamRole
from app.schemas import ChallengeOut, TeamOut
from app.services.careers import career_matches


def get_or_404(db: Session, model, obj_id: int, name: str = "Recurso"):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{name} no encontrado")
    return obj


def notify(db: Session, user_id: int, title: str, body: str | None = None, link: str | None = None) -> None:
    db.add(Notification(user_id=user_id, title=title, body=body, link=link))


def is_challenge_owner(user: User, ch: Challenge) -> bool:
    return user.role == Role.ADMIN or (user.organization_id is not None and user.organization_id == ch.organization_id)


def accepted_team_id(db: Session, ch: Challenge) -> int | None:
    return db.scalar(select(Proposal.team_id).where(
        Proposal.challenge_id == ch.id, Proposal.status == ProposalStatus.ACEPTADA))


def is_team_member(db: Session, user: User, team_id: int | None) -> bool:
    if team_id is None:
        return False
    return db.scalar(select(TeamMember.id).where(
        TeamMember.team_id == team_id, TeamMember.user_id == user.id)) is not None


def is_challenge_participant(db: Session, user: User, ch: Challenge) -> bool:
    """Dueño del reto o integrante del equipo aceptado."""
    return is_challenge_owner(user, ch) or is_team_member(db, user, accepted_team_id(db, ch))


def career_allows(user: User | None, ch: Challenge) -> bool:
    """Un estudiante solo ve las problemáticas que piden su carrera (o que no piden ninguna)."""
    if user is None or user.role != Role.ESTUDIANTE or not ch.required_disciplines:
        return True
    return career_matches(user.career, ch.required_disciplines) is not None


def can_view_challenge(db: Session, user: User | None, ch: Challenge) -> bool:
    """Regla de carrera, salvo que el estudiante ya participe con un equipo en la problemática."""
    if career_allows(user, ch):
        return True
    my_teams = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    return db.scalar(select(Proposal.id).where(
        Proposal.challenge_id == ch.id, Proposal.team_id.in_(my_teams))) is not None


def career_denied_message(user: User, ch: Challenge) -> str:
    carrera = f"Tu carrera ({user.career})" if user.career else "Tu perfil no tiene carrera registrada y"
    return (f"Esta problemática busca estudiantes de: {', '.join(ch.required_disciplines)}. "
            f"{carrera} no está entre ellas.")


def has_nda(db: Session, user: User, ch: Challenge) -> bool:
    if ch.confidentiality == Confidentiality.PUBLICO or is_challenge_owner(user, ch):
        return True
    return db.scalar(select(NdaAcceptance.id).where(
        NdaAcceptance.user_id == user.id, NdaAcceptance.challenge_id == ch.id)) is not None


def challenge_out(db: Session, ch: Challenge, user: User | None) -> ChallengeOut:
    can_see = user is not None and has_nda(db, user, ch)
    count = db.scalar(select(func.count(Proposal.id)).where(Proposal.challenge_id == ch.id)) or 0
    data = ChallengeOut.model_validate(ch).model_dump()
    data.update(
        organization_name=ch.organization.name if ch.organization else None,
        description=ch.description if can_see else None,
        nda_required=not can_see,
        proposals_count=count,
    )
    return ChallengeOut(**data)


def team_out(team: Team) -> TeamOut:
    out = TeamOut.model_validate(team)
    out.disciplines = sorted({m.user.career for m in team.members
                              if m.user.career and m.role != TeamRole.ASESOR})
    return out


def recompute_rating(db: Session, user: User) -> None:
    from app.models import Review
    avg, count = db.execute(select(func.avg(Review.score), func.count(Review.id))
                            .where(Review.reviewee_id == user.id)).one()
    user.rating_avg = round(float(avg or 0), 2)
    user.rating_count = int(count or 0)
