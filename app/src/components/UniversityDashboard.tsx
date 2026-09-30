import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { HBars, Kpi, MonthlyColumns, PIE_COLORS, PieChart, VIZ, type Segment } from '@/components/charts';
import { useApi } from '@/components/hooks';
import { colors, radius } from '@/components/theme';
import {
  Badge, Button, Card, Empty, ErrorView, H2, Loading, Muted, Row, Screen, Section, Title, type IconName,
} from '@/components/ui';
import { shortDate } from '@/lib/format';
import type { User } from '@/lib/types';

type Hitos = { total: number; aprobados: number; en_revision: number; pendientes: number; con_cambios: number; vencidos: number };
type Proyecto = {
  proposal_id: number; challenge_id: number; challenge_title: string; organization_name: string | null; team_name: string;
  students: { id: number; full_name: string; career: string | null; role: string }[];
  state: string; compliance: string; milestones: Hitos; progress: number;
  next_milestone: { title: string; due_date: string | null; status: string } | null; created_at: string;
};
type Dashboard = {
  kpis: { tasa_aceptacion: number | null; participacion: number | null; postulaciones_mes: number; postulaciones_mes_anterior: number };
  tendencia: { mes: string; postulaciones: number; aceptadas: number }[];
  carreras: { carrera: string; alumnos: number }[];
  resumen: { estudiantes: number; estudiantes_en_proyectos: number; empresas_atendidas: number };
  cumplimiento: Hitos & { porcentaje: number | null; proyectos_al_dia: number; proyectos_con_atraso: number; proyectos_sin_hitos: number };
  proyectos_por_estado: Record<string, number>;
  proyectos: Proyecto[];
};

/** Estados de proyecto: colores categóricos validados + gris neutro para lo que ya no sigue. */
const ESTADOS: Record<string, { label: string; color: string; icon: IconName }> = {
  en_curso: { label: 'En curso', color: VIZ.blue, icon: 'construct-outline' },
  postulado: { label: 'Postulados', color: VIZ.orange, icon: 'paper-plane-outline' },
  finalizado: { label: 'Finalizados', color: VIZ.aqua, icon: 'checkmark-done-outline' },
  no_seleccionado: { label: 'No seleccionados', color: VIZ.neutral, icon: 'close-circle-outline' },
  retirado: { label: 'Retirados', color: VIZ.neutralDark, icon: 'return-down-back-outline' },
  cancelado: { label: 'Cancelados', color: VIZ.neutralDark, icon: 'ban-outline' },
};
/** Semáforo de cumplimiento de cada proyecto. */
const CUMPLIMIENTO: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' | 'primary'; icon: IconName }> = {
  al_dia: { label: 'Al día', tone: 'success', icon: 'checkmark-circle' },
  con_atraso: { label: 'Con atraso', tone: 'danger', icon: 'alert-circle' },
  sin_hitos: { label: 'Sin hitos definidos', tone: 'warning', icon: 'time-outline' },
  postulado: { label: 'Esperando respuesta', tone: 'warning', icon: 'hourglass-outline' },
  finalizado: { label: 'Concluido', tone: 'success', icon: 'ribbon-outline' },
  no_seleccionado: { label: 'No seleccionado', tone: 'neutral', icon: 'close-circle-outline' },
  retirado: { label: 'Retirado', tone: 'neutral', icon: 'return-down-back-outline' },
  cancelado: { label: 'Cancelado', tone: 'danger', icon: 'ban-outline' },
};
const FILTROS = ['todos', 'en_curso', 'postulado', 'finalizado', 'no_seleccionado'] as const;
const FILTRO_LABEL: Record<string, string> = {
  todos: 'Todos', en_curso: 'En curso', postulado: 'Postulados', finalizado: 'Finalizados', no_seleccionado: 'No seleccionados',
};

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const today = new Date().toISOString().slice(0, 10);
const shortCareer = (c: string) => c.replace(/^(Ingeniería|Licenciatura)( en)? /, '');

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 320, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
      borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{title}</Text>
      {!!subtitle && <Muted style={{ marginTop: 2, marginBottom: 12 }}>{subtitle}</Muted>}
      {!subtitle && <View style={{ height: 12 }} />}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Proyectos
function ProyectoCard({ p }: { p: Proyecto }) {
  const cu = CUMPLIMIENTO[p.compliance];
  const m = p.milestones;
  const next = p.next_milestone;
  const late = !!next?.due_date && next.due_date < today && next.status !== 'entregado';
  return (
    <Pressable onPress={() => router.push(`/reto/${p.challenge_id}`)}
      style={({ hovered }: any) => ({
        backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1,
        borderColor: hovered ? colors.primary : colors.border, borderLeftWidth: 5, borderLeftColor: ESTADOS[p.state].color,
      })}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <H2>{p.challenge_title}</H2>
          <Muted>{p.organization_name} · Equipo {p.team_name}</Muted>
        </View>
        <Badge text={cu.label} tone={cu.tone} icon={cu.icon} />
      </Row>

      <Row gap={6} style={{ marginTop: 8 }}>
        {p.students.map((a) => (
          <Badge key={a.id} tone="neutral" icon="school-outline"
            text={`${a.full_name}${a.career ? ` · ${shortCareer(a.career)}` : ''}`} />
        ))}
      </Row>

      {p.state === 'en_curso' && (
        <View style={{ marginTop: 12 }}>
          {m.total ? (
            <>
              <Row style={{ flexWrap: 'nowrap' }} gap={10}>
                <View style={{ height: 10, backgroundColor: VIZ.track, borderRadius: 999, overflow: 'hidden', flex: 1 }}>
                  <View style={{ width: `${Math.round(p.progress * 100)}%`, height: 10, borderRadius: 999,
                    backgroundColor: p.compliance === 'con_atraso' ? VIZ.critical : VIZ.good }} />
                </View>
                <Text style={{ fontWeight: '700', color: colors.text }}>{m.aprobados}/{m.total} hitos</Text>
              </Row>
              {next && (
                <Row gap={6} style={{ marginTop: 8 }}>
                  <Ionicons name={late ? 'alert-circle' : 'flag-outline'} size={15} color={late ? colors.danger : colors.primary} />
                  <Text style={{ fontSize: 13, color: late ? colors.danger : colors.text }}>
                    Próximo: {next.title}{next.due_date ? ` · ${late ? 'venció' : 'vence'} ${shortDate(next.due_date)}` : ''}
                    {next.status === 'entregado' ? ' · en revisión' : ''}
                  </Text>
                </Row>
              )}
            </>
          ) : <Muted>La empresa todavía no define los hitos del proyecto.</Muted>}
        </View>
      )}
      <Muted style={{ fontSize: 12, marginTop: 8 }}>Postulado el {shortDate(p.created_at)}</Muted>
    </Pressable>
  );
}

export function UniversityDashboard({ user }: { user: User }) {
  const q = useApi<Dashboard>(user.organization_id ? `/stats/university/${user.organization_id}/dashboard` : null);
  const [filtro, setFiltro] = useState<string>('todos');
  const d = q.data;
  const proyectos = (d?.proyectos ?? []).filter((p) => filtro === 'todos' || p.state === filtro);

  const c = d?.cumplimiento;
  const k = d?.kpis;
  const deltaMes = k ? k.postulaciones_mes - k.postulaciones_mes_anterior : 0;
  const enCurso = (d?.proyectos ?? []).filter((p) => p.state === 'en_curso');

  const hitosSeg: Segment[] = c ? [
    { key: 'aprobados', label: 'Aprobados', value: c.aprobados, color: VIZ.good, icon: 'checkmark-circle' },
    { key: 'revision', label: 'En revisión', value: c.en_revision, color: VIZ.blue, icon: 'eye' },
    { key: 'pendientes', label: 'Pendientes', value: c.pendientes, color: VIZ.neutral, icon: 'ellipse-outline' },
    { key: 'cambios', label: 'Con cambios', value: c.con_cambios, color: VIZ.serious, icon: 'create' },
  ] : [];
  // Carreras: las 4 con más alumnos con color propio; el resto se agrupa en gris (más de 4 colores no se distinguen)
  const carrerasSeg: Segment[] = d ? [
    ...d.carreras.slice(0, 4).map((x, i) => ({ key: x.carrera, label: shortCareer(x.carrera), value: x.alumnos, color: PIE_COLORS[i] })),
    ...(d.carreras.length > 4 ? [{ key: 'otras', label: 'Otras carreras', color: VIZ.neutral,
      value: d.carreras.slice(4).reduce((a, x) => a + x.alumnos, 0) }] : []),
  ] : [];
  const estadosSeg: Segment[] = d ? Object.entries(d.proyectos_por_estado)
    .filter(([key, v]) => v > 0 || !['retirado', 'cancelado'].includes(key))
    .map(([key, v]) => ({ key, label: ESTADOS[key].label, value: v, color: ESTADOS[key].color, icon: ESTADOS[key].icon })) : [];

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Title>Hola, {user.full_name.split(' ')[0]}</Title>
      <Muted>Tablero de vinculación: cumplimiento y proyectos de los alumnos de tu institución.</Muted>

      {q.isLoading ? <Loading /> : q.error || !d || !c || !k ? <ErrorView error={q.error} onRetry={q.refetch} /> : (
        <>
          {/* ---------- KPIs ---------- */}
          <Section title="Indicadores clave">
            <Row gap={10}>
              <Kpi label="Cumplimiento de hitos" icon="speedometer-outline" value={pct(c.porcentaje)} meter={c.porcentaje}
                tone={c.porcentaje != null && c.porcentaje < 0.5 ? 'critical' : 'good'}
                hint={c.total ? `${c.aprobados} de ${c.total} hitos aprobados` : 'Aún no hay hitos'} />
              <Kpi label="Tasa de aceptación" icon="checkmark-done-outline" value={pct(k.tasa_aceptacion)} meter={k.tasa_aceptacion}
                hint="Postulaciones aceptadas de las ya respondidas" />
              <Kpi label="Participación de alumnos" icon="people-outline" value={pct(k.participacion)} meter={k.participacion}
                hint={`${d.resumen.estudiantes_en_proyectos} de ${d.resumen.estudiantes} alumnos en proyectos`} />
              <Kpi label="Postulaciones este mes" icon="paper-plane-outline" value={String(k.postulaciones_mes)}
                delta={{ value: deltaMes, text: deltaMes === 0 ? 'igual que el mes pasado'
                  : `${deltaMes > 0 ? '+' : ''}${deltaMes} vs. mes pasado` }} />
              <Kpi label="Proyectos en curso" icon="construct-outline" value={String(d.proyectos_por_estado.en_curso)}
                hint={`con ${d.resumen.empresas_atendidas} empresa(s) atendida(s)`} />
              <Kpi label="Hitos vencidos" icon={c.vencidos ? 'alert-circle' : 'checkmark-circle'} value={String(c.vencidos)}
                tone={c.vencidos ? 'critical' : 'good'}
                hint={c.vencidos ? `${c.proyectos_con_atraso} proyecto(s) con atraso` : 'Ningún proyecto con atraso'} />
            </Row>
          </Section>

          {/* ---------- Gráficas ---------- */}
          <Section title="Estado de cumplimiento">
            <Row gap={10} style={{ alignItems: 'stretch' }}>
              <ChartCard title="Hitos por estado" subtitle="Toca una rebanada o pasa el mouse por la lista para ver el detalle">
                {c.total ? <PieChart segments={hitosSeg} unit=" hitos" centerLabel="hitos" />
                  : <Muted>Cuando las empresas definan hitos en los proyectos, aquí verás su avance.</Muted>}
              </ChartCard>
              <ChartCard title="Avance por proyecto en curso" subtitle="Hitos aprobados de cada proyecto">
                {!enCurso.length ? <Muted>No hay proyectos en curso.</Muted> : (
                  <HBars max={1} onPress={(key) => {
                    const p = enCurso.find((x) => String(x.proposal_id) === key);
                    if (p) router.push(`/reto/${p.challenge_id}`);
                  }} rows={enCurso.map((p) => ({
                    key: String(p.proposal_id), label: p.challenge_title, value: p.progress,
                    display: p.milestones.total ? `${p.milestones.aprobados}/${p.milestones.total}` : 'sin hitos',
                    color: p.compliance === 'con_atraso' ? VIZ.critical : VIZ.blue,
                    icon: p.compliance === 'con_atraso' ? 'alert-circle' : p.compliance === 'al_dia' ? 'checkmark-circle' : 'time-outline',
                    note: p.compliance === 'con_atraso' ? `${p.milestones.vencidos} hito(s) vencido(s) · ${p.organization_name}` : p.organization_name ?? undefined,
                  }))} />
                )}
              </ChartCard>
            </Row>
          </Section>

          <Section title="Estado de los proyectos">
            <Row gap={10} style={{ alignItems: 'stretch' }}>
              <ChartCard title="Proyectos por estado" subtitle="Todas las postulaciones y proyectos de tus alumnos">
                {estadosSeg.some((x) => x.value > 0) ? <PieChart segments={estadosSeg} unit=" proyectos" centerLabel="proyectos" />
                  : <Muted>Tus alumnos todavía no se postulan a ninguna problemática.</Muted>}
              </ChartCard>
              <ChartCard title="Postulaciones por mes" subtitle="Últimos 6 meses">
                <MonthlyColumns data={d.tendencia} />
              </ChartCard>
            </Row>
          </Section>

          <Section title="Alumnos por carrera">
            <ChartCard title="¿Qué carreras participan más?" subtitle="Alumnos postulados o en proyectos, por carrera">
              {d.carreras.length ? <PieChart segments={carrerasSeg} unit=" alumnos" centerLabel="alumnos" />
                : <Muted>Aún no hay alumnos participando.</Muted>}
            </ChartCard>
          </Section>

          {/* ---------- Lista ---------- */}
          <Section title="Proyectos de tus alumnos">
            <Row gap={6} style={{ marginBottom: 12 }}>
              {FILTROS.map((key) => {
                const on = filtro === key;
                const n = key === 'todos' ? d.proyectos.length : d.proyectos_por_estado[key] ?? 0;
                return (
                  <Pressable key={key} onPress={() => setFiltro(key)}
                    style={{ borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : colors.text }}>{FILTRO_LABEL[key]} ({n})</Text>
                  </Pressable>
                );
              })}
            </Row>
            {!proyectos.length ? (
              <Empty text={filtro === 'todos' ? 'Tus alumnos todavía no participan en problemáticas.' : 'No hay proyectos en este estado.'}
                icon="folder-open-outline" />
            ) : proyectos.map((p) => <ProyectoCard key={p.proposal_id} p={p} />)}
          </Section>
        </>
      )}

      <Section title="Accesos rápidos">
        <Card>
          <Row>
            <Button title="Publicar capacidad" icon="add-circle-outline" onPress={() => router.push('/capacidad')} />
            <Button title="Ver problemáticas abiertas" variant="secondary" onPress={() => router.push('/retos')} />
            <Button title="Indicadores globales" variant="secondary" onPress={() => router.push('/indicadores')} />
          </Row>
        </Card>
      </Section>
    </Screen>
  );
}
