"""Modelos ORM de la plataforma de vinculación universidad-empresa."""
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON, Boolean, Date, DateTime, Enum as SAEnum, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    CapabilityType, ChallengeStatus, Confidentiality, IPModel, MilestoneStatus,
    OrgSize, OrgType, ProposalStatus, Role, TeamRole,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _enum(e):
    # Guarda el valor ("empresa") y no el nombre ("EMPRESA"); portable SQLite/PostgreSQL
    return SAEnum(e, values_callable=lambda x: [i.value for i in x], native_enum=False, length=30)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------- Organizaciones
class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    type: Mapped[OrgType] = mapped_column(_enum(OrgType), index=True)
    size: Mapped[OrgSize | None] = mapped_column(_enum(OrgSize), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rfc: Mapped[str | None] = mapped_column(String(13), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    members: Mapped[list["User"]] = relationship(back_populates="organization")
    capabilities: Mapped[list["Capability"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    challenges: Mapped[list["Challenge"]] = relationship(back_populates="organization")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[Role] = mapped_column(_enum(Role), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    organization: Mapped[Organization | None] = relationship(back_populates="members")

    # Perfil académico (estudiantes y académicos)
    career: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    semester: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Reputación calculada a partir de evaluaciones
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)


# ---------------------------------------------------------------- Carreras
class Career(Base):
    """Carrera registrada en la plataforma. Las del catálogo base se guardan al vincularlas a una
    universidad; las nuevas las crea una universidad y quedan disponibles para todos."""
    __tablename__ = "careers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    created_by_org_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UniversityCareer(Base):
    """Carreras que ofrece cada universidad."""
    __tablename__ = "university_careers"
    __table_args__ = (UniqueConstraint("organization_id", "career_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    career_id: Mapped[int] = mapped_column(ForeignKey("careers.id"), index=True)

    career: Mapped[Career] = relationship()


# ---------------------------------------------------------------- Capacidades universitarias
class Capability(TimestampMixin, Base):
    """Laboratorios, equipo, expertos y servicios que ofrece una universidad."""
    __tablename__ = "capabilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    type: Mapped[CapabilityType] = mapped_column(_enum(CapabilityType), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    contact_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    organization: Mapped[Organization] = relationship(back_populates="capabilities")


# ---------------------------------------------------------------- Retos
class Challenge(TimestampMixin, Base):
    """Problema publicado por una empresa o dependencia de gobierno."""
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    title: Mapped[str] = mapped_column(String(200), index=True)
    summary: Mapped[str] = mapped_column(String(500))        # visible siempre
    description: Mapped[str] = mapped_column(Text)           # oculto si es confidencial y no hay NDA
    category: Mapped[str] = mapped_column(String(120), index=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    required_disciplines: Mapped[list[str]] = mapped_column(JSON, default=list)
    min_disciplines: Mapped[int] = mapped_column(Integer, default=2)  # fomenta equipos multidisciplinarios
    modalities: Mapped[list[str]] = mapped_column(JSON, default=list)

    budget_mxn: Mapped[float | None] = mapped_column(Float, nullable=True)
    offers_stipend: Mapped[bool] = mapped_column(Boolean, default=False)  # evita "mano de obra gratis"
    duration_weeks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)

    confidentiality: Mapped[Confidentiality] = mapped_column(_enum(Confidentiality), default=Confidentiality.PUBLICO)
    ip_model: Mapped[IPModel] = mapped_column(_enum(IPModel), default=IPModel.COMPARTIDA)
    status: Mapped[ChallengeStatus] = mapped_column(_enum(ChallengeStatus), default=ChallengeStatus.BORRADOR, index=True)

    organization: Mapped[Organization] = relationship(back_populates="challenges")
    proposals: Mapped[list["Proposal"]] = relationship(back_populates="challenge", cascade="all, delete-orphan")
    milestones: Mapped[list["Milestone"]] = relationship(back_populates="challenge", cascade="all, delete-orphan",
                                                         order_by="Milestone.due_date")


class NdaAcceptance(Base):
    """Registro de aceptación del acuerdo de confidencialidad de un reto."""
    __tablename__ = "nda_acceptances"
    __table_args__ = (UniqueConstraint("user_id", "challenge_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), index=True)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------- Equipos
class Team(TimestampMixin, Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    university_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[TeamRole] = mapped_column(_enum(TeamRole), default=TeamRole.INTEGRANTE)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    team: Mapped[Team] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


# ---------------------------------------------------------------- Postulaciones
class Proposal(TimestampMixin, Base):
    __tablename__ = "proposals"
    __table_args__ = (UniqueConstraint("team_id", "challenge_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    approach: Mapped[str] = mapped_column(Text)
    work_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_weeks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ProposalStatus] = mapped_column(_enum(ProposalStatus), default=ProposalStatus.ENVIADA, index=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    challenge: Mapped[Challenge] = relationship(back_populates="proposals")
    team: Mapped[Team] = relationship()


# ---------------------------------------------------------------- Seguimiento
class Milestone(TimestampMixin, Base):
    """Entregables del proyecto una vez aceptada una propuesta."""
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[MilestoneStatus] = mapped_column(_enum(MilestoneStatus), default=MilestoneStatus.PENDIENTE)
    deliverable_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    company_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    challenge: Mapped[Challenge] = relationship(back_populates="milestones")


class Message(Base):
    """Canal de comunicación empresa-equipo dentro de un reto."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    author: Mapped[User] = relationship()


class Review(Base):
    """Evaluación mutua al cerrar un reto: construye confianza y portafolio."""
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("challenge_id", "reviewer_id", "reviewee_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reviewee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    score: Mapped[int] = mapped_column(Integer)  # 1..5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)  # ruta para web/app, ej. /retos/5
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
