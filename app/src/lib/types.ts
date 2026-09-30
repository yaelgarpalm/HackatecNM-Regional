// Tipos que reflejan los esquemas del backend (app/schemas)

export type Role = 'empresa' | 'universidad' | 'estudiante' | 'academico' | 'gobierno' | 'admin';
export type OrgType = 'empresa' | 'universidad' | 'gobierno';
export type ChallengeStatus = 'borrador' | 'abierto' | 'en_progreso' | 'finalizado' | 'cancelado';
export type ProposalStatus = 'enviada' | 'aceptada' | 'rechazada' | 'retirada';
export type MilestoneStatus = 'pendiente' | 'entregado' | 'aprobado' | 'cambios_solicitados';
export type TeamRole = 'lider' | 'integrante' | 'asesor';
export type CapabilityType = 'laboratorio' | 'equipo' | 'experto' | 'servicio';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserPublic {
  id: number;
  full_name: string;
  role: Role;
  career: string | null;
  skills: string[];
  organization_id: number | null;
  rating_avg: number;
  rating_count: number;
}

export interface User extends UserPublic {
  email: string;
  semester: number | null;
  bio: string | null;
  portfolio_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  type: OrgType;
  size: string | null;
  sector: string | null;
  rfc: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  verified: boolean;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

export interface NearbyOrganization extends Organization {
  distance_km: number;
  capabilities: number;
  careers: string[];
}

export interface Capability {
  id: number;
  organization_id: number;
  type: CapabilityType;
  name: string;
  description: string | null;
  tags: string[];
  contact_user_id: number | null;
  available: boolean;
}

export interface Challenge {
  id: number;
  organization_id: number;
  organization_name: string | null;
  title: string;
  summary: string;
  description: string | null;
  category: string;
  tags: string[];
  required_disciplines: string[];
  min_disciplines: number;
  modalities: string[];
  budget_mxn: number | null;
  offers_stipend: boolean;
  duration_weeks: number | null;
  deadline: string | null;
  confidentiality: 'publico' | 'confidencial';
  ip_model: 'empresa' | 'universidad' | 'compartida' | 'abierta';
  status: ChallengeStatus;
  nda_required: boolean;
  proposals_count: number;
  created_at: string;
}

export interface TeamMember {
  user_id: number;
  role: TeamRole;
  user: UserPublic;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  university_id: number | null;
  created_by_id: number;
  members: TeamMember[];
  disciplines: string[];
}

export interface Proposal {
  id: number;
  challenge_id: number;
  team_id: number;
  approach: string;
  work_plan: string | null;
  estimated_weeks: number | null;
  status: ProposalStatus;
  feedback: string | null;
  created_at: string;
  team: Team | null;
  discipline_coverage: number | null;
  challenge_title: string | null;
}

export interface Milestone {
  id: number;
  challenge_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  deliverable_url: string | null;
  company_comment: string | null;
}

export interface ChatMessage {
  id: number;
  challenge_id: number;
  author_id: number;
  author: UserPublic;
  body: string;
  created_at: string;
}

export interface Review {
  id: number;
  challenge_id: number;
  reviewer_id: number;
  reviewee_id: number;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ChallengeMatch {
  challenge: Challenge;
  score: number;
  reasons: string[];
}

export interface CapabilityMatch {
  capability: Capability;
  organization_name: string;
  score: number;
  reasons: string[];
}

export interface UserMatch {
  user: UserPublic;
  score: number;
  reasons: string[];
}

export interface Catalogs {
  roles: string[];
  tipos_organizacion: string[];
  tamanos_organizacion: string[];
  tipos_capacidad: string[];
  estados_reto: string[];
  confidencialidad: string[];
  propiedad_intelectual: string[];
  modalidades: string[];
  roles_equipo: string[];
  estados_postulacion: string[];
  estados_hito: string[];
  carreras: string[];
}
