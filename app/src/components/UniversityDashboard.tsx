import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useApi } from '@/components/hooks';
import { colors, radius } from '@/components/theme';
import {
  Badge, Button, Card, Empty, ErrorView, H2, Loading, Muted, Row, Screen, Section, Stat, Title, type IconName,
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
  resumen: { estudiantes: number; estudiantes_en_proyectos: number; empresas_atendidas: number };
  cumplimiento: Hitos & { porcentaje: number | null; proyectos_al_dia: number; proyectos_con_atraso: number; proyectos_sin_hitos: number };
  proyectos_por_estado: Record<string, number>;
  proyectos: Proyecto[];
};

/** Nombre, color e ícono de cada estado de proyecto. */
const ESTADOS: Record<string, { label: string; color: string; soft: string; icon: IconName }> = {
  en_curso: { label: 'En curso', color: colors.primary, soft: colors.primarySoft, icon: 'construct-outline' },
  postulado: { label: 'Postulados', color: colors.accent, soft: colors.accentSoft, icon: 'paper-plane-outline' },
  finalizado: { label: 'Finalizados', color: colors.success, soft: colors.successSoft, icon: 'checkmark-done-outline' },
  no_seleccionado: { label: 'No seleccionados', color: '#8A96A3', soft: '#EEF1F4', icon: 'close-circle-outline' },
  retirado: { label: 'Retirados', color: '#B0B8C1', soft: '#F3F5F7', icon: 'return-down-back-outline' },
  cancelado: { label: 'Cancelados', color: colors.danger, soft: colors.dangerSoft, icon: 'ban-outline' },
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

const pct = (v: number) => `${Math.round(v * 100)}%`;
const today = new Date().toISOString().slice(0, 10);

function ProgressBar({ value, color = colors.primary, height = 10 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: colors.primarySoft, borderRadius: 999, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height, backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

function Pill({ icon, value, text, color, soft }: { icon: IconName; value: number; text: string; color: string; soft: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 120, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
      borderRadius: radius.md, backgroundColor: soft }}>
      <Ionicons name={icon} size={20} color={color} />
      <View>
        <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
        <Text style={{ fontSize: 12, color: colors.text }}>{text}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Estado de cumplimiento
function Cumplimiento({ c }: { c: Dashboard['cumplimiento'] }) {
  const color = c.porcentaje == null ? colors.muted : c.porcentaje >= 0.7 ? colors.success : c.porcentaje >= 0.4 ? colors.accent : colors.danger;
  return (
    <Section title="Estado de cumplimiento">
      <Card>
        {c.porcentaje == null ? (
          <Muted>Todavía no hay hitos en los proyectos en curso. El cumplimiento se calcula con los hitos que aprueban las empresas.</Muted>
        ) : (
          <>
            <Row style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 40, fontWeight: '800', color }}>{pct(c.porcentaje)}</Text>
                <Muted>de los hitos aprobados por las empresas ({c.aprobados} de {c.total})</Muted>
              </View>
            </Row>
            <View style={{ flexDirection: 'row', marginTop: 10 }}><ProgressBar value={c.porcentaje} color={color} height={14} /></View>
          </>
        )}

        <Muted style={{ fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Proyectos en curso</Muted>
        <Row gap={8}>
          <Pill icon="checkmark-circle" value={c.proyectos_al_dia} text="Al día" color={colors.success} soft={colors.successSoft} />
          <Pill icon="alert-circle" value={c.proyectos_con_atraso} text="Con atraso" color={colors.danger} soft={colors.dangerSoft} />
          <Pill icon="time-outline" value={c.proyectos_sin_hitos} text="Sin hitos" color={colors.warning} soft={colors.warningSoft} />
        </Row>

        <Muted style={{ fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Hitos</Muted>
        <Row gap={6}>
          <Badge text={`${c.aprobados} aprobados`} tone="success" icon="checkmark" />
          <Badge text={`${c.en_revision} en revisión`} tone="primary" icon="eye-outline" />
          <Badge text={`${c.pendientes} pendientes`} tone="neutral" icon="ellipse-outline" />
          <Badge text={`${c.con_cambios} con cambios`} tone="warning" icon="create-outline" />
          <Badge text={`${c.vencidos} vencidos`} tone="danger" icon="alert-circle-outline" />
        </Row>
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------- Estado de los proyectos
function EstadoProyectos({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  return (
    <Section title="Estado de los proyectos">
      <Card>
        {!total ? <Muted>Tus alumnos todavía no se postulan a ninguna problemática.</Muted> : (
          <>
            <Row style={{ alignItems: 'baseline' }} gap={6}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{total}</Text>
              <Muted>postulaciones y proyectos de tus alumnos</Muted>
            </Row>
            {/* Barra apilada: cada color es un estado */}
            <View style={{ flexDirection: 'row', height: 16, borderRadius: 999, overflow: 'hidden', marginVertical: 12 }}>
              {entries.map(([k, v]) => <View key={k} style={{ flex: v, backgroundColor: ESTADOS[k].color }} />)}
            </View>
            <Row gap={8}>
              {/* Los estados poco comunes (retirados, cancelados) solo aparecen si hay alguno */}
              {Object.entries(data).filter(([k, v]) => v > 0 || !['retirado', 'cancelado'].includes(k)).map(([k, v]) => (
                <Pill key={k} icon={ESTADOS[k].icon} value={v} text={ESTADOS[k].label} color={ESTADOS[k].color} soft={ESTADOS[k].soft} />
              ))}
            </Row>
          </>
        )}
      </Card>
    </Section>
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
            text={`${a.full_name}${a.career ? ` · ${a.career.replace(/^(Ingeniería|Licenciatura)( en)? /, '')}` : ''}`} />
        ))}
      </Row>

      {p.state === 'en_curso' && (
        <View style={{ marginTop: 12 }}>
          {m.total ? (
            <>
              <Row style={{ flexWrap: 'nowrap' }} gap={10}>
                <ProgressBar value={p.progress} color={p.compliance === 'con_atraso' ? colors.danger : colors.success} />
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

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Title>Hola, {user.full_name.split(' ')[0]}</Title>
      <Muted>Tablero de vinculación: cumplimiento y proyectos de los alumnos de tu institución.</Muted>

      {q.isLoading ? <Loading /> : q.error || !d ? <ErrorView error={q.error} onRetry={q.refetch} /> : (
        <>
          <Row style={{ marginTop: 16 }} gap={10}>
            <Stat value={d.resumen.estudiantes} text="Alumnos registrados" icon="school-outline" />
            <Stat value={d.resumen.estudiantes_en_proyectos} text="Alumnos en proyectos" icon="people-outline" />
            <Stat value={d.proyectos_por_estado.en_curso} text="Proyectos en curso" icon="construct-outline" />
            <Stat value={d.resumen.empresas_atendidas} text="Empresas atendidas" icon="business-outline" />
          </Row>

          <Cumplimiento c={d.cumplimiento} />
          <EstadoProyectos data={d.proyectos_por_estado} />

          <Section title="Proyectos de tus alumnos">
            <Row gap={6} style={{ marginBottom: 12 }}>
              {FILTROS.map((k) => {
                const on = filtro === k;
                const n = k === 'todos' ? d.proyectos.length : d.proyectos_por_estado[k] ?? 0;
                return (
                  <Pressable key={k} onPress={() => setFiltro(k)}
                    style={{ borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : colors.text }}>{FILTRO_LABEL[k]} ({n})</Text>
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
        <Row>
          <Button title="Publicar capacidad" icon="add-circle-outline" onPress={() => router.push('/capacidad')} />
          <Button title="Ver problemáticas abiertas" variant="secondary" onPress={() => router.push('/retos')} />
          <Button title="Indicadores globales" variant="secondary" onPress={() => router.push('/indicadores')} />
        </Row>
      </Section>
    </Screen>
  );
}
