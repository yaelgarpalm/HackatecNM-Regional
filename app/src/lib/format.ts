import { router, type Href } from 'expo-router';

export const LABELS: Record<string, string> = {
  // roles
  empresa: 'Empresa',
  universidad: 'Universidad',
  estudiante: 'Estudiante',
  academico: 'Académico',
  gobierno: 'Gobierno',
  admin: 'Administrador',
  // estados de reto
  borrador: 'Borrador',
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  // postulación
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  retirada: 'Retirada',
  // hitos
  pendiente: 'Pendiente',
  entregado: 'Entregado',
  aprobado: 'Aprobado',
  cambios_solicitados: 'Cambios solicitados',
  // modalidades
  residencia: 'Residencia',
  servicio_social: 'Servicio social',
  tesis: 'Tesis',
  proyecto_clase: 'Proyecto de clase',
  consultoria: 'Consultoría',
  // confidencialidad / PI
  publico: 'Público',
  confidencial: 'Confidencial (NDA)',
  compartida: 'Compartida',
  abierta: 'Abierta',
  // equipo
  lider: 'Líder',
  integrante: 'Integrante',
  asesor: 'Asesor',
  // capacidades
  laboratorio: 'Laboratorio',
  equipo: 'Equipo',
  experto: 'Experto',
  servicio: 'Servicio',
  // tamaños
  micro: 'Micro',
  pequena: 'Pequeña',
  mediana: 'Mediana',
  grande: 'Grande',
  startup: 'Startup',
  cooperativa: 'Cooperativa',
};

export const label = (v: string | null | undefined) => (v ? LABELS[v] ?? v : '');

export const money = (n: number | null | undefined) =>
  n == null ? '' : `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`;

export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return shortDate(iso);
};

export const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);


/** Regresa a la pantalla anterior; si se entró por enlace directo (web), va a la ruta indicada. */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
