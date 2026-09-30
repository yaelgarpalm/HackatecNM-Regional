"""Problemáticas: publicación, NDA, postulaciones, seguimiento, mensajes y evaluaciones."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import Pagination, get_current_user, get_optional_user, require_roles
from app.models import (
    Capability, Challenge, Message, Milestone, NdaAcceptance, Organization, Proposal,
    Review, Team, TeamMember, User,
)
from app.models.enums import (
    ChallengeStatus, MilestoneStatus, Modality, ProposalStatus, Role, TeamRole,
)
from app.schemas import (
    CapabilityMatch, CapabilityOut, ChallengeCreate, ChallengeOut, ChallengeStatusIn,
    ChallengeUpdate, ChatMessageIn, ChatMessageOut, MessageOut, MilestoneCreate,
    MilestoneDeliver, MilestoneOut, MilestoneReview, Page, ProposalCreate, ProposalDecision,
    ProposalOut, ReviewCreate, ReviewOut, UserMatch, UserPublic,
)
from app.services.common import (
    accepted_team_id, can_view_challenge, career_allows, career_denied_message, challenge_out, get_or_404, has_nda,
    is_challenge_owner,
    is_challenge_participant, is_team_member, notify, recompute_rating, team_out,
)
from app.services.careers import career_matches
from app.services.matching import (
    discipline_coverage, score_capability_for_challenge, score_user_for_challenge,
)

router = APIRouter(tags=["Problemáticas"])

# Transiciones de estado permitidas para el dueño del reto
TRANSITIONS = {
    ChallengeStatus.BORRADOR: {ChallengeStatus.ABIERTO, ChallengeStatus.CANCELADO},
    ChallengeStatus.ABIERTO: {ChallengeStatus.BORRADOR, ChallengeStatus.CANCELADO},
    ChallengeStatus.EN_PROGRESO: {ChallengeStatus.FINALIZADO, ChallengeStatus.CANCELADO},
    ChallengeStatus.FINALIZADO: set(),
    ChallengeStatus.CANCELADO: set(),
}


def _owned(db: Session, ch_id: int, user: User) -> Challenge:
    ch = get_or_404(db, Challenge, ch_id, "Problemática")
    if not is_challenge_owner(user, ch):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo la organización dueña de la problemática puede hacer esto")
    return ch


def _participant(db: Session, ch_id: int, user: User) -> Challenge:
    ch = get_or_404(db, Challenge, ch_id, "Problemática")
    if not is_challenge_participant(db, user, ch):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo participantes de la problemática")
    return ch


def _check_deadline(deadline: date | None) -> None:
    if deadline and deadline < date.today():
        raise HTTPException(422, "La fecha límite para postularse no puede ser un día que ya pasó")


def _team_user_ids(db: Session, team_id: int) -> list[int]:
    return list(db.scalars(select(TeamMember.user_id).where(TeamMember.team_id == team_id)))


def _org_user_ids(db: Session, org_id: int) -> list[int]:
    return list(db.scalars(select(User.id).where(User.organization_id == org_id)))


# ================================================================ CRUD de retos
@router.get("/challenges", response_model=Page[ChallengeOut])
def list_challenges(
    q: str | None = Query(None, description="Texto libre: título, resumen o etiquetas"),
    category: str | None = None,
    status_: ChallengeStatus | None = Query(None, alias="status", description="Vacío = todos (excepto borradores ajenos)"),
    modality: Modality | None = None,
    state: str | None = Query(None, description="Estado de la República"),
    organization_id: int | None = None,
    mine: bool = Query(False, description="Solo problemáticas de mi organización"),
    pag: Pagination = Depends(),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Tablero público de problemáticas. Con sesión iniciada muestra el detalle de los que ya firmaste NDA."""
    stmt = select(Challenge).join(Organization)
    if mine:
        if not user or not user.organization_id:
            raise HTTPException(401, "Inicia sesión con una cuenta de organización")
        stmt = stmt.where(Challenge.organization_id == user.organization_id)
        if status_:
            stmt = stmt.where(Challenge.status == status_)
    else:
        # Borradores nunca son públicos
        stmt = stmt.where(Challenge.status != ChallengeStatus.BORRADOR)
        if status_:
            stmt = stmt.where(Challenge.status == status_)
    if category:
        stmt = stmt.where(Challenge.category.ilike(f"%{category}%"))
    if modality:
        stmt = stmt.where(cast(Challenge.modalities, String).like(f'%"{modality.value}"%'))
    if state:
        stmt = stmt.where(Organization.state.ilike(f"%{state}%"))
    if organization_id:
        stmt = stmt.where(Challenge.organization_id == organization_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Challenge.title.ilike(like), Challenge.summary.ilike(like),
                              cast(Challenge.tags, String).ilike(like)))
    stmt = stmt.order_by(Challenge.created_at.desc())
    if user and user.role == Role.ESTUDIANTE and not mine:
        # Solo las problemáticas que piden la carrera del estudiante
        visibles = [ch for ch in db.scalars(stmt) if can_view_challenge(db, user, ch)]
        return pag.apply_list(visibles, lambda ch: challenge_out(db, ch, user))
    return pag.apply(db, stmt, lambda ch: challenge_out(db, ch, user))


@router.post("/challenges", response_model=ChallengeOut, status_code=201)
def create_challenge(data: ChallengeCreate,
                     user: User = Depends(require_roles(Role.EMPRESA, Role.GOBIERNO)),
                     db: Session = Depends(get_db)):
    """Una empresa o dependencia publica un problema real."""
    if not user.organization_id:
        raise HTTPException(422, "Tu cuenta no está vinculada a una organización")
    _check_deadline(data.deadline)
    payload = data.model_dump(exclude={"publish"})
    payload["modalities"] = [m.value for m in data.modalities]
    ch = Challenge(organization_id=user.organization_id, created_by_id=user.id,
                   status=ChallengeStatus.ABIERTO if data.publish else ChallengeStatus.BORRADOR,
                   **payload)
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return challenge_out(db, ch, user)


@router.get("/challenges/{ch_id}", response_model=ChallengeOut)
def get_challenge(ch_id: int, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    ch = get_or_404(db, Challenge, ch_id, "Problemática")
    if ch.status == ChallengeStatus.BORRADOR and not (user and is_challenge_owner(user, ch)):
        raise HTTPException(404, "Problemática no encontrada")
    if not can_view_challenge(db, user, ch):
        raise HTTPException(403, career_denied_message(user, ch))
    return challenge_out(db, ch, user)


@router.patch("/challenges/{ch_id}", response_model=ChallengeOut)
def update_challenge(ch_id: int, data: ChallengeUpdate,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ch = _owned(db, ch_id, user)
    if ch.status not in (ChallengeStatus.BORRADOR, ChallengeStatus.ABIERTO):
        raise HTTPException(409, "No se puede editar una problemática en progreso o cerrada")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("deadline") != ch.deadline:  # una fecha ya guardada puede conservarse aunque haya pasado
        _check_deadline(changes.get("deadline"))
    if "modalities" in changes and changes["modalities"] is not None:
        changes["modalities"] = [m.value if hasattr(m, "value") else m for m in changes["modalities"]]
    for k, v in changes.items():
        setattr(ch, k, v)
    db.commit()
    return challenge_out(db, ch, user)


@router.patch("/challenges/{ch_id}/status", response_model=ChallengeOut)
def change_status(ch_id: int, data: ChallengeStatusIn,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ch = _owned(db, ch_id, user)
    if data.status not in TRANSITIONS[ch.status]:
        raise HTTPException(409, f"No se puede pasar de '{ch.status.value}' a '{data.status.value}'")
    ch.status = data.status
    team_id = accepted_team_id(db, ch)
    if team_id and data.status in (ChallengeStatus.FINALIZADO, ChallengeStatus.CANCELADO):
        for uid in _team_user_ids(db, team_id):
            estado = "finalizó" if data.status == ChallengeStatus.FINALIZADO else "fue cancelada"
            notify(db, uid, f"La problemática '{ch.title}' {estado}",
                   "Ya puedes evaluar a tus contrapartes." if data.status == ChallengeStatus.FINALIZADO else None,
                   f"/retos/{ch.id}")
    db.commit()
    return challenge_out(db, ch, user)


@router.post("/challenges/{ch_id}/nda", response_model=ChallengeOut)
def accept_nda(ch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Acepta el acuerdo de confidencialidad y desbloquea la descripción completa."""
    ch = get_or_404(db, Challenge, ch_id, "Problemática")
    if ch.status == ChallengeStatus.BORRADOR and not is_challenge_owner(user, ch):
        raise HTTPException(404, "Problemática no encontrada")
    if not has_nda(db, user, ch):
        db.add(NdaAcceptance(user_id=user.id, challenge_id=ch.id))
        db.commit()
    return challenge_out(db, ch, user)


# ================================================================ Postulaciones
def _proposal_out(db: Session, p: Proposal) -> ProposalOut:
    out = ProposalOut.model_validate(p)
    out.team = team_out(p.team)
    members = [m.user for m in p.team.members if m.role != TeamRole.ASESOR]
    out.discipline_coverage = discipline_coverage(members, p.challenge.required_disciplines)
    out.challenge_title = p.challenge.title
    return out


@router.get("/challenges/{ch_id}/proposals", response_model=list[ProposalOut])
def list_proposals(ch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """La empresa ve todas; un estudiante solo las de sus equipos."""
    ch = get_or_404(db, Challenge, ch_id, "Problemática")
    stmt = select(Proposal).where(Proposal.challenge_id == ch.id)
    if not is_challenge_owner(user, ch):
        my_teams = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
        stmt = stmt.where(Proposal.team_id.in_(my_teams))
    return [_proposal_out(db, p) for p in db.scalars(stmt.order_by(Proposal.created_at))]


@router.post("/challenges/{ch_id}/proposals", response_model=ProposalOut, status_code=201)
def submit_proposal(ch_id: int, data: ProposalCreate,
                    user: User = Depends(require_roles(Role.ESTUDIANTE, Role.ACADEMICO)),
                    db: Session = Depends(get_db)):
    ch = get_or_404(db, Challenge, ch_id, "Problemática")
    if ch.status != ChallengeStatus.ABIERTO:
        raise HTTPException(409, "La problemática no está abierta a postulaciones")
    if not has_nda(db, user, ch):
        raise HTTPException(403, "Debes aceptar el acuerdo de confidencialidad antes de postularte")

    team = get_or_404(db, Team, data.team_id, "Equipo")
    member = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id))
    if not member or member.role == TeamRole.INTEGRANTE:
        raise HTTPException(403, "Solo el líder o el asesor del equipo puede postular")

    # Regla multidisciplinaria: número mínimo de carreras distintas en el equipo
    careers = {m.user.career.strip().lower() for m in team.members
               if m.role != TeamRole.ASESOR and m.user.career}
    if ch.required_disciplines:
        fuera = [m.user.full_name for m in team.members if m.role != TeamRole.ASESOR
                 and not career_matches(m.user.career, ch.required_disciplines)]
        if fuera:
            raise HTTPException(422, f"La problemática solo acepta estudiantes de: {', '.join(ch.required_disciplines)}. "
                                     f"No cumplen: {', '.join(fuera)}")
    if len(careers) < ch.min_disciplines:
        raise HTTPException(422, f"La problemática pide un equipo de al menos {ch.min_disciplines} carreras distintas; "
                                 f"tu equipo tiene {len(careers)}")

    if db.scalar(select(Proposal.id).where(Proposal.team_id == team.id, Proposal.challenge_id == ch.id)):
        raise HTTPException(409, "Este equipo ya se postuló a esta problemática")

    # Todos los integrantes quedan cubiertos por el NDA del reto
    for m in team.members:
        if not has_nda(db, m.user, ch):
            db.add(NdaAcceptance(user_id=m.user_id, challenge_id=ch.id))

    p = Proposal(challenge_id=ch.id, **data.model_dump())
    db.add(p)
    for uid in _org_user_ids(db, ch.organization_id):
        notify(db, uid, f"Nueva postulación para '{ch.title}'", f"Equipo: {team.name}", f"/retos/{ch.id}/postulaciones")
    db.commit()
    db.refresh(p)
    return _proposal_out(db, p)


@router.patch("/proposals/{proposal_id}", response_model=ProposalOut)
def decide_proposal(proposal_id: int, data: ProposalDecision,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """La empresa acepta/rechaza; el equipo puede retirar su propuesta."""
    p = get_or_404(db, Proposal, proposal_id, "Postulación")
    ch = p.challenge
    if p.status != ProposalStatus.ENVIADA:
        raise HTTPException(409, "La postulación ya fue resuelta")

    if data.status == ProposalStatus.RETIRADA:
        if not is_team_member(db, user, p.team_id):
            raise HTTPException(403, "Solo el equipo puede retirar su postulación")
        p.status = ProposalStatus.RETIRADA
        db.commit()
        return _proposal_out(db, p)

    if not is_challenge_owner(user, ch):
        raise HTTPException(403, "Solo la organización dueña de la problemática decide")
    if data.status not in (ProposalStatus.ACEPTADA, ProposalStatus.RECHAZADA):
        raise HTTPException(422, "Estado inválido")

    if data.status == ProposalStatus.ACEPTADA and ch.status != ChallengeStatus.ABIERTO:
        raise HTTPException(409, "La problemática ya no está abierta")

    p.status, p.feedback = data.status, data.feedback
    if data.status == ProposalStatus.ACEPTADA:
        ch.status = ChallengeStatus.EN_PROGRESO
        # Se rechazan automáticamente las demás, con aviso
        for other in ch.proposals:
            if other.id != p.id and other.status == ProposalStatus.ENVIADA:
                other.status = ProposalStatus.RECHAZADA
                other.feedback = other.feedback or "Se seleccionó otra propuesta. ¡Gracias por participar!"
                for uid in _team_user_ids(db, other.team_id):
                    notify(db, uid, f"Tu postulación a '{ch.title}' no fue seleccionada", None, f"/retos/{ch.id}")

    verb = "aceptada 🎉" if data.status == ProposalStatus.ACEPTADA else "rechazada"
    for uid in _team_user_ids(db, p.team_id):
        notify(db, uid, f"Tu postulación a '{ch.title}' fue {verb}", data.feedback, f"/retos/{ch.id}")
    db.commit()
    return _proposal_out(db, p)


@router.get("/proposals/mine", response_model=list[ProposalOut])
def my_proposals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Postulaciones de todos los equipos del usuario (estudiante o académico)."""
    my_teams = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    stmt = select(Proposal).where(Proposal.team_id.in_(my_teams)).order_by(Proposal.created_at.desc())
    return [_proposal_out(db, p) for p in db.scalars(stmt)]


@router.get("/proposals/received", response_model=list[ProposalOut])
def received_proposals(user: User = Depends(require_roles(Role.EMPRESA, Role.GOBIERNO)),
                       db: Session = Depends(get_db)):
    """Postulaciones recibidas en todas las problemáticas de la organización del usuario."""
    stmt = select(Proposal).join(Challenge, Proposal.challenge_id == Challenge.id)
    if user.role != Role.ADMIN:
        if not user.organization_id:
            return []
        stmt = stmt.where(Challenge.organization_id == user.organization_id)
    stmt = stmt.order_by(Proposal.created_at.desc())
    return [_proposal_out(db, p) for p in db.scalars(stmt)]


@router.get("/challenges/{ch_id}/participants", response_model=list[UserPublic])
def list_participants(ch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Personas de la organización dueña y del equipo aceptado (para chat y evaluaciones)."""
    ch = _participant(db, ch_id, user)
    ids = set(_org_user_ids(db, ch.organization_id))
    team_id = accepted_team_id(db, ch)
    if team_id:
        ids |= set(_team_user_ids(db, team_id))
    return db.scalars(select(User).where(User.id.in_(ids)).order_by(User.full_name)).all()


# ================================================================ Recomendaciones para la empresa
@router.get("/challenges/{ch_id}/matches/capabilities", response_model=list[CapabilityMatch])
def match_capabilities(ch_id: int, limit: int = Query(10, le=50),
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Laboratorios, equipo y expertos universitarios afines a la problemática."""
    ch = _owned(db, ch_id, user)
    results = []
    for cap in db.scalars(select(Capability)):
        score, reasons = score_capability_for_challenge(cap, ch)
        if score > 0:
            results.append(CapabilityMatch(capability=CapabilityOut.model_validate(cap),
                                           organization_name=cap.organization.name,
                                           score=score, reasons=reasons))
    return sorted(results, key=lambda r: r.score, reverse=True)[:limit]


@router.get("/challenges/{ch_id}/matches/talent", response_model=list[UserMatch])
def match_talent(ch_id: int, role: Role = Query(Role.ESTUDIANTE), limit: int = Query(20, le=100),
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Estudiantes o académicos cuyo perfil encaja con la problemática."""
    ch = _owned(db, ch_id, user)
    if role not in (Role.ESTUDIANTE, Role.ACADEMICO):
        raise HTTPException(422, "role debe ser estudiante o academico")
    results = []
    for u in db.scalars(select(User).where(User.role == role, User.is_active.is_(True))):
        if not career_allows(u, ch):
            continue
        score, reasons = score_user_for_challenge(u, ch)
        if score > 0:
            results.append(UserMatch(user=UserPublic.model_validate(u), score=score, reasons=reasons))
    return sorted(results, key=lambda r: r.score, reverse=True)[:limit]


# ================================================================ Seguimiento (hitos)
@router.get("/challenges/{ch_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(ch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _participant(db, ch_id, user).milestones


@router.post("/challenges/{ch_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(ch_id: int, data: MilestoneCreate,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ch = _participant(db, ch_id, user)
    if ch.status != ChallengeStatus.EN_PROGRESO:
        raise HTTPException(409, "Los hitos se definen cuando la problemática está en progreso")
    m = Milestone(challenge_id=ch.id, **data.model_dump())
    db.add(m)
    db.commit()
    return m


@router.post("/milestones/{m_id}/deliver", response_model=MilestoneOut)
def deliver_milestone(m_id: int, data: MilestoneDeliver,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = get_or_404(db, Milestone, m_id, "Hito")
    ch = m.challenge
    if not is_team_member(db, user, accepted_team_id(db, ch)):
        raise HTTPException(403, "Solo el equipo asignado entrega")
    m.deliverable_url, m.status = data.deliverable_url, MilestoneStatus.ENTREGADO
    for uid in _org_user_ids(db, ch.organization_id):
        notify(db, uid, f"Entrega: {m.title}", f"Problemática '{ch.title}'", f"/retos/{ch.id}/hitos")
    db.commit()
    return m


@router.post("/milestones/{m_id}/review", response_model=MilestoneOut)
def review_milestone(m_id: int, data: MilestoneReview,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = get_or_404(db, Milestone, m_id, "Hito")
    if not is_challenge_owner(user, m.challenge):
        raise HTTPException(403, "Solo la organización dueña revisa entregas")
    if data.status not in (MilestoneStatus.APROBADO, MilestoneStatus.CAMBIOS):
        raise HTTPException(422, "Usa 'aprobado' o 'cambios_solicitados'")
    if m.status != MilestoneStatus.ENTREGADO:
        raise HTTPException(409, "El hito aún no ha sido entregado")
    m.status, m.company_comment = data.status, data.company_comment
    team_id = accepted_team_id(db, m.challenge)
    for uid in _team_user_ids(db, team_id) if team_id else []:
        resultado = "aprobado ✅" if data.status == MilestoneStatus.APROBADO else "con cambios solicitados"
        notify(db, uid, f"Hito '{m.title}' {resultado}", data.company_comment,
               f"/retos/{m.challenge_id}/hitos")
    db.commit()
    return m


# ================================================================ Mensajería
@router.get("/challenges/{ch_id}/messages", response_model=list[ChatMessageOut])
def list_messages(ch_id: int, after_id: int = Query(0, description="Para polling incremental desde la app"),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _participant(db, ch_id, user)
    return db.scalars(select(Message).where(Message.challenge_id == ch_id, Message.id > after_id)
                      .order_by(Message.id).limit(200)).all()


@router.post("/challenges/{ch_id}/messages", response_model=ChatMessageOut, status_code=201)
def send_message(ch_id: int, data: ChatMessageIn,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ch = _participant(db, ch_id, user)
    msg = Message(challenge_id=ch.id, author_id=user.id, body=data.body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# ================================================================ Evaluaciones
@router.post("/challenges/{ch_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(ch_id: int, data: ReviewCreate,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Evaluación mutua al finalizar: alimenta la reputación y el portafolio."""
    ch = _participant(db, ch_id, user)
    if ch.status != ChallengeStatus.FINALIZADO:
        raise HTTPException(409, "Solo se evalúa cuando la problemática está finalizada")
    reviewee = get_or_404(db, User, data.reviewee_id, "Usuario")
    if reviewee.id == user.id or not is_challenge_participant(db, reviewee, ch):
        raise HTTPException(422, "Solo puedes evaluar a otro participante de la problemática")
    if db.scalar(select(Review.id).where(Review.challenge_id == ch.id, Review.reviewer_id == user.id,
                                         Review.reviewee_id == reviewee.id)):
        raise HTTPException(409, "Ya evaluaste a este participante")
    r = Review(challenge_id=ch.id, reviewer_id=user.id, **data.model_dump())
    db.add(r)
    db.flush()
    recompute_rating(db, reviewee)
    notify(db, reviewee.id, "Recibiste una evaluación", f"{data.score}/5 en '{ch.title}'", f"/perfil/{reviewee.id}")
    db.commit()
    return r


@router.delete("/challenges/{ch_id}", response_model=MessageOut)
def delete_challenge(ch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ch = _owned(db, ch_id, user)
    if ch.status != ChallengeStatus.BORRADOR:
        raise HTTPException(409, "Solo se eliminan borradores; usa el estado 'cancelado'")
    for nda in db.scalars(select(NdaAcceptance).where(NdaAcceptance.challenge_id == ch.id)):
        db.delete(nda)
    db.delete(ch)
    db.commit()
    return MessageOut(detail="Problemática eliminada")

