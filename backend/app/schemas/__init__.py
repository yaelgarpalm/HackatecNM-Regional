"""Esquemas Pydantic (contratos JSON que consumen la web y la app móvil)."""
from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.services.careers import exact_career
from app.models.enums import (
    CapabilityType, ChallengeStatus, Confidentiality, IPModel, MilestoneStatus,
    Modality, OrgSize, OrgType, ProposalStatus, Role, TeamRole,
)

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    """Respuesta paginada estándar (útil para scroll infinito en la app)."""
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class MessageOut(BaseModel):
    detail: str


def _clean_list(v: list[str] | None) -> list[str]:
    if not v:
        return []
    seen, out = set(), []
    for item in v:
        s = item.strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


def _official_career(v: str | None) -> str | None:
    """Guarda el nombre oficial del catálogo ('contador' -> 'Licenciatura en Contaduría')."""
    if v is None or not v.strip():
        return None
    return exact_career(v) or " ".join(v.split())


def _official_careers(v: list[str] | None) -> list[str] | None:
    return None if v is None else _clean_list([_official_career(i) or "" for i in v])


# ---------------------------------------------------------------- Carreras
class CareerIn(BaseModel):
    name: str = Field(min_length=3, max_length=150)


class CareerOut(BaseModel):
    id: int
    name: str
    universities: int = 0  # cuántas instituciones la ofrecen


class CareerLinkOut(BaseModel):
    career: CareerOut
    created: bool          # True si la carrera no existía y se creó
    already_linked: bool   # True si la universidad ya la tenía


# ---------------------------------------------------------------- Auth
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


# ---------------------------------------------------------------- Organizaciones
class OrganizationBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    type: OrgType
    size: OrgSize | None = None
    sector: str | None = None
    rfc: str | None = Field(default=None, max_length=13)
    description: str | None = None
    city: str | None = None
    state: str | None = None
    website: str | None = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = None
    size: OrgSize | None = None
    sector: str | None = None
    description: str | None = None
    city: str | None = None
    state: str | None = None
    website: str | None = None


class OrganizationOut(ORM, OrganizationBase):
    id: int
    verified: bool
    created_at: datetime


# ---------------------------------------------------------------- Usuarios
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    role: Role
    career: str | None = None
    semester: int | None = Field(default=None, ge=1, le=14)
    skills: list[str] = []
    bio: str | None = None
    portfolio_url: str | None = None

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, v):
        return _clean_list(v)

    @field_validator("career")
    @classmethod
    def official_career(cls, v):
        return _official_career(v)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    organization_id: int | None = None
    # Alternativa: registrar la organización al mismo tiempo que el usuario
    organization: OrganizationCreate | None = None

    @field_validator("role")
    @classmethod
    def no_admin(cls, v: Role) -> Role:
        if v == Role.ADMIN:
            raise ValueError("No es posible registrarse como administrador")
        return v


class UserUpdate(BaseModel):
    full_name: str | None = None
    career: str | None = None
    semester: int | None = Field(default=None, ge=1, le=14)
    skills: list[str] | None = None
    bio: str | None = None
    portfolio_url: str | None = None

    @field_validator("career")
    @classmethod
    def official_career(cls, v):
        return _official_career(v)


class UserPublic(ORM):
    id: int
    full_name: str
    role: Role
    career: str | None
    skills: list[str]
    organization_id: int | None
    rating_avg: float
    rating_count: int


class UserOut(UserPublic):
    email: EmailStr
    semester: int | None
    bio: str | None
    portfolio_url: str | None
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------- Capacidades
class CapabilityBase(BaseModel):
    type: CapabilityType
    name: str = Field(min_length=2, max_length=200)
    description: str | None = None
    tags: list[str] = []
    contact_user_id: int | None = None
    available: bool = True

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v):
        return _clean_list(v)


class CapabilityCreate(CapabilityBase):
    pass


class CapabilityOut(ORM, CapabilityBase):
    id: int
    organization_id: int


# ---------------------------------------------------------------- Retos
class ChallengeBase(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    summary: str = Field(min_length=10, max_length=500)
    description: str = Field(min_length=20)
    category: str
    tags: list[str] = []
    required_disciplines: list[str] = []
    min_disciplines: int = Field(default=2, ge=1, le=6)
    modalities: list[Modality] = []
    budget_mxn: float | None = Field(default=None, ge=0)
    offers_stipend: bool = False
    duration_weeks: int | None = Field(default=None, ge=1, le=104)
    deadline: date | None = None
    confidentiality: Confidentiality = Confidentiality.PUBLICO
    ip_model: IPModel = IPModel.COMPARTIDA

    @field_validator("tags")
    @classmethod
    def clean_lists(cls, v):
        return _clean_list(v)

    @field_validator("required_disciplines")
    @classmethod
    def official_careers(cls, v):
        return _official_careers(v)


class ChallengeCreate(ChallengeBase):
    publish: bool = False  # True = pasa directo a "abierto"


class ChallengeUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    required_disciplines: list[str] | None = None
    min_disciplines: int | None = Field(default=None, ge=1, le=6)
    modalities: list[Modality] | None = None
    budget_mxn: float | None = None
    offers_stipend: bool | None = None
    duration_weeks: int | None = None
    deadline: date | None = None
    confidentiality: Confidentiality | None = None
    ip_model: IPModel | None = None

    @field_validator("required_disciplines")
    @classmethod
    def official_careers(cls, v):
        return _official_careers(v)


class ChallengeStatusIn(BaseModel):
    status: ChallengeStatus


class ChallengeOut(ORM):
    id: int
    organization_id: int
    organization_name: str | None = None
    title: str
    summary: str
    description: str | None  # None cuando es confidencial y no se ha aceptado el NDA
    category: str
    tags: list[str]
    required_disciplines: list[str]
    min_disciplines: int
    modalities: list[str]
    budget_mxn: float | None
    offers_stipend: bool
    duration_weeks: int | None
    deadline: date | None
    confidentiality: Confidentiality
    ip_model: IPModel
    status: ChallengeStatus
    nda_required: bool = False
    proposals_count: int = 0
    created_at: datetime


# ---------------------------------------------------------------- Equipos
class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None


class TeamMemberIn(BaseModel):
    user_id: int
    role: TeamRole = TeamRole.INTEGRANTE


class TeamMemberOut(ORM):
    user_id: int
    role: TeamRole
    user: UserPublic


class TeamOut(ORM):
    id: int
    name: str
    description: str | None
    university_id: int | None
    created_by_id: int
    members: list[TeamMemberOut]
    disciplines: list[str] = []


# ---------------------------------------------------------------- Postulaciones
class ProposalCreate(BaseModel):
    team_id: int
    approach: str = Field(min_length=20)
    work_plan: str | None = None
    estimated_weeks: int | None = Field(default=None, ge=1, le=104)


class ProposalDecision(BaseModel):
    status: ProposalStatus
    feedback: str | None = None


class ProposalOut(ORM):
    id: int
    challenge_id: int
    team_id: int
    approach: str
    work_plan: str | None
    estimated_weeks: int | None
    status: ProposalStatus
    feedback: str | None
    created_at: datetime
    team: TeamOut | None = None
    discipline_coverage: float | None = None
    challenge_title: str | None = None


# ---------------------------------------------------------------- Seguimiento
class MilestoneCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    due_date: date | None = None


class MilestoneDeliver(BaseModel):
    deliverable_url: str


class MilestoneReview(BaseModel):
    status: MilestoneStatus
    company_comment: str | None = None


class MilestoneOut(ORM):
    id: int
    challenge_id: int
    title: str
    description: str | None
    due_date: date | None
    status: MilestoneStatus
    deliverable_url: str | None
    company_comment: str | None


class ChatMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(ORM):
    id: int
    challenge_id: int
    author_id: int
    author: UserPublic
    body: str
    created_at: datetime


class ReviewCreate(BaseModel):
    reviewee_id: int
    score: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewOut(ORM):
    id: int
    challenge_id: int
    reviewer_id: int
    reviewee_id: int
    score: int
    comment: str | None
    created_at: datetime


class NotificationOut(ORM):
    id: int
    title: str
    body: str | None
    link: str | None
    read: bool
    created_at: datetime


# ---------------------------------------------------------------- Recomendaciones
class ChallengeMatch(BaseModel):
    challenge: ChallengeOut
    score: float
    reasons: list[str]


class CapabilityMatch(BaseModel):
    capability: CapabilityOut
    organization_name: str
    score: float
    reasons: list[str]


class UserMatch(BaseModel):
    user: UserPublic
    score: float
    reasons: list[str]
