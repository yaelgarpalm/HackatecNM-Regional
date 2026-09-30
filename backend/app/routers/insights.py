"""Recomendaciones personalizadas, indicadores de vinculación y catálogos."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
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
from app.services.careers import all_careers
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


# Estado del proyecto desde el punto de vista de la universidad
def _project_state(p: Proposal) -> str:
    if p.status == ProposalStatus.ENVIADA:
        return "postulado"
    if p.status == ProposalStatus.RECHAZADA:
        return "no_seleccionado"
    if p.status == ProposalStatus.RETIRADA:
        return "retirado"
    return {ChallengeStatus.FINALIZADO: "finalizado", ChallengeStatus.CANCELADO: "cancelado"}.get(
        p.challenge.status, "en_curso")


@router.get("/stats/university/{org_id}/dashboard")
def university_dashboard(org_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Tablero de la universidad: cumplimiento, estado de los proyectos y todos los proyectos de sus alumnos."""
    if user.role != Role.ADMIN and not (user.role == Role.UNIVERSIDAD and user.organization_id == org_id):
        raise HTTPException(403, "Solo la oficina de vinculación de esta institución puede ver su tablero")

    alumnos = select(User.id).where(User.organization_id == org_id, User.role == Role.ESTUDIANTE)
    equipos = select(TeamMember.team_id).where(TeamMember.user_id.in_(alumnos))
    propuestas = db.scalars(select(Proposal).where(Proposal.team_id.in_(equipos))
                            .order_by(Proposal.created_at.desc())).all()

    hoy = date.today()
    proyectos, por_estado = [], {k: 0 for k in ("en_curso", "postulado", "finalizado", "no_seleccionado",
                                                  "retirado", "cancelado")}
    hitos_tot = {"total": 0, "aprobados": 0, "en_revision": 0, "pendientes": 0, "con_cambios": 0, "vencidos": 0}
    al_dia = con_atraso = sin_hitos = 0

    for p in propuestas:
        ch, estado = p.challenge, _project_state(p)
        por_estado[estado] += 1
        h = {"total": 0, "aprobados": 0, "en_revision": 0, "pendientes": 0, "con_cambios": 0, "vencidos": 0}
        proximo = None
        if p.status == ProposalStatus.ACEPTADA:
            for m in sorted(ch.milestones, key=lambda m: (m.due_date is None, m.due_date or hoy)):
                h["total"] += 1
                if m.status == MilestoneStatus.APROBADO:
                    h["aprobados"] += 1
                    continue
                if m.status == MilestoneStatus.ENTREGADO:
                    h["en_revision"] += 1
                elif m.status == MilestoneStatus.CAMBIOS:
                    h["con_cambios"] += 1
                else:
                    h["pendientes"] += 1
                if m.status != MilestoneStatus.ENTREGADO and m.due_date and m.due_date < hoy:
                    h["vencidos"] += 1
                if proximo is None:
                    proximo = {"title": m.title, "due_date": m.due_date, "status": m.status.value}
            for k in hitos_tot:
                hitos_tot[k] += h[k]

        # Semáforo de cumplimiento del proyecto
        if estado != "en_curso":
            cumplimiento = estado
        elif h["total"] == 0:
            cumplimiento, sin_hitos = "sin_hitos", sin_hitos + 1
        elif h["vencidos"]:
            cumplimiento, con_atraso = "con_atraso", con_atraso + 1
        else:
            cumplimiento, al_dia = "al_dia", al_dia + 1

        alumnos_equipo = [
            {"id": m.user.id, "full_name": m.user.full_name, "career": m.user.career, "role": m.role.value}
            for m in p.team.members if m.user.organization_id == org_id and m.user.role == Role.ESTUDIANTE
        ]
        proyectos.append({
            "proposal_id": p.id, "challenge_id": ch.id, "challenge_title": ch.title,
            "organization_name": ch.organization.name if ch.organization else None,
            "team_name": p.team.name, "students": alumnos_equipo, "state": estado, "compliance": cumplimiento,
            "milestones": h, "progress": round(h["aprobados"] / h["total"], 3) if h["total"] else 0.0,
            "next_milestone": proximo, "created_at": p.created_at,
        })

    total_alumnos = _count(db, select(func.count()).select_from(alumnos.subquery()))
    en_proyectos = {a["id"] for pr in proyectos if pr["state"] in ("en_curso", "finalizado") for a in pr["students"]}

    # Tendencia: postulaciones de los últimos 6 meses (y cuántas terminaron aceptadas)
    meses = []
    y, m = hoy.year, hoy.month
    for _ in range(6):
        meses.insert(0, (y, m))
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    tendencia = [{"mes": f"{yy}-{mm:02d}", "postulaciones": 0, "aceptadas": 0} for yy, mm in meses]
    idx = {t["mes"]: t for t in tendencia}
    for p in propuestas:
        t = idx.get(f"{p.created_at.year}-{p.created_at.month:02d}")
        if t:
            t["postulaciones"] += 1
            t["aceptadas"] += p.status == ProposalStatus.ACEPTADA

    # Alumnos por carrera que participan (postulados, en curso o finalizados)
    por_carrera: dict[str, set[int]] = {}
    for pr in proyectos:
        if pr["state"] in ("en_curso", "finalizado", "postulado"):
            for a in pr["students"]:
                por_carrera.setdefault(a["career"] or "Sin carrera", set()).add(a["id"])
    carreras = sorted(({"carrera": k, "alumnos": len(v)} for k, v in por_carrera.items()),
                      key=lambda x: (-x["alumnos"], x["carrera"]))

    decididas = sum(1 for p in propuestas if p.status in (ProposalStatus.ACEPTADA, ProposalStatus.RECHAZADA))
    aceptadas = sum(1 for p in propuestas if p.status == ProposalStatus.ACEPTADA)
    return {
        "kpis": {
            "tasa_aceptacion": round(aceptadas / decididas, 3) if decididas else None,
            "participacion": round(len(en_proyectos) / total_alumnos, 3) if total_alumnos else None,
            "postulaciones_mes": tendencia[-1]["postulaciones"],
            "postulaciones_mes_anterior": tendencia[-2]["postulaciones"],
        },
        "tendencia": tendencia,
        "carreras": carreras,
        "resumen": {
            "estudiantes": total_alumnos,
            "estudiantes_en_proyectos": len(en_proyectos),
            "empresas_atendidas": len({pr["organization_name"] for pr in proyectos
                                       if pr["state"] in ("en_curso", "finalizado")}),
        },
        "cumplimiento": {
            **hitos_tot,
            "porcentaje": round(hitos_tot["aprobados"] / hitos_tot["total"], 3) if hitos_tot["total"] else None,
            "proyectos_al_dia": al_dia, "proyectos_con_atraso": con_atraso, "proyectos_sin_hitos": sin_hitos,
        },
        "proyectos_por_estado": por_estado,
        "proyectos": proyectos,
    }


@router.get("/catalogs")
def catalogs(db: Session = Depends(get_db)):
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
        "carreras": all_careers(db),
    }
