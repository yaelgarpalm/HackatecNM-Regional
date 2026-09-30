import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useAction, useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import {
  Badge, Body, Button, Card, confirm, ErrorView, H2, Loading, Muted, Row, Screen, Section, StatusBadge, Tags, Title,
} from '@/components/ui';
import { api } from '@/lib/api';
import { isAcademic, useUser } from '@/lib/auth';
import { label, money, shortDate, goBack } from '@/lib/format';
import type { Challenge, ChallengeStatus, Proposal } from '@/lib/types';

const TRANSITIONS: Record<ChallengeStatus, ChallengeStatus[]> = {
  borrador: ['abierto', 'cancelado'],
  abierto: ['borrador', 'cancelado'],
  en_progreso: ['finalizado', 'cancelado'],
  finalizado: [],
  cancelado: [],
};
const TRANSITION_TEXT: Record<string, string> = {
  abierto: 'Publicar', borrador: 'Volver a borrador', cancelado: 'Cancelar problemática', finalizado: 'Marcar como finalizado',
};

function Info({ icon, title, value }: { icon: any; title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Row gap={10} style={{ flexWrap: 'nowrap', marginBottom: 8, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginTop: 1 }} />
      <Body style={{ flex: 1 }}>
        <Body style={{ fontWeight: '700' }}>{title}: </Body>
        {value}
      </Body>
    </Row>
  );
}

export default function RetoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const q = useApi<Challenge>(`/challenges/${id}`);
  const ch = q.data;
  const isOwner = !!ch && (user.role === 'admin' || user.organization_id === ch.organization_id);
  const academic = isAcademic(user);
  const props = useApi<Proposal[]>(ch && (isOwner || academic) ? `/challenges/${id}/proposals` : null);

  const nda = useAction(() => api.post(`/challenges/${id}/nda`));
  const setStatus = useAction((status: ChallengeStatus) => api.patch(`/challenges/${id}/status`, { status }));
  const withdraw = useAction((pid: number) => api.patch(`/proposals/${pid}`, { status: 'retirada' }));
  const remove = useAction(() => api.del(`/challenges/${id}`), { onSuccess: () => goBack('/') });

  if (q.isLoading) return <Loading />;
  if (q.error || !ch) return <Screen><ErrorView error={q.error} onRetry={q.refetch} /></Screen>;

  const accepted = props.data?.find((p) => p.status === 'aceptada');
  const participant = isOwner || (academic && !!accepted);
  const active = ch.status === 'en_progreso' || ch.status === 'finalizado';

  return (
    <Screen onRefresh={() => { q.refetch(); props.refetch(); }} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: `Problemática #${ch.id}` }} />

      <Row gap={6}>
        <StatusBadge status={ch.status} />
        {ch.confidentiality === 'confidencial' && <Badge text="Confidencial" tone="warning" icon="lock-closed" />}
        <Badge text={ch.category} tone="primary" />
      </Row>
      <Title>{ch.title}</Title>
      <Muted>{ch.organization_name} · publicada {shortDate(ch.created_at)}</Muted>
      <Body style={{ marginTop: 10, fontSize: 16 }}>{ch.summary}</Body>

      <Section title="Descripción del problema">
        {ch.nda_required ? (
          <Card style={{ backgroundColor: colors.warningSoft, borderColor: '#F0D48A' }}>
            <Row gap={8}>
              <Ionicons name="lock-closed" size={20} color={colors.warning} />
              <H2>Información confidencial</H2>
            </Row>
            <Body style={{ marginTop: 6 }}>
              La organización protege los detalles de esta problemática. Para verlos debes aceptar el acuerdo de confidencialidad
              (NDA): te comprometes a no divulgar la información fuera de la plataforma ni del equipo.
            </Body>
            <Button title="Acepto el acuerdo de confidencialidad" icon="document-lock-outline" loading={nda.isPending}
              onPress={() => nda.mutate(undefined)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          </Card>
        ) : (
          <Card><Body>{ch.description}</Body></Card>
        )}
      </Section>

      <Section title="Condiciones">
        <Card>
          <Info icon="school-outline" title="Disciplinas requeridas" value={ch.required_disciplines.join(', ') || 'Cualquiera'} />
          <Info icon="git-merge-outline" title="Equipo mínimo" value={`${ch.min_disciplines} carrera(s) distintas`} />
          <Info icon="ribbon-outline" title="Válido como" value={ch.modalities.map(label).join(', ')} />
          <Info icon="cash-outline" title="Apoyo económico"
            value={ch.budget_mxn ? money(ch.budget_mxn) : ch.offers_stipend ? 'Sí' : 'No especificado'} />
          <Info icon="time-outline" title="Duración estimada" value={ch.duration_weeks ? `${ch.duration_weeks} semanas` : null} />
          <Info icon="calendar-outline" title="Fecha límite para postularse" value={ch.deadline ? shortDate(ch.deadline) : null} />
          <Info icon="bulb-outline" title="Propiedad intelectual de los resultados" value={label(ch.ip_model)} />
          <Tags items={ch.tags} tone="neutral" />
        </Card>
      </Section>

      {/* ---------- Estudiante / académico ---------- */}
      {academic && (
        <Section title="Participación">
          {(props.data ?? []).map((p) => (
            <Card key={p.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>Equipo {p.team?.name}</H2>
                <StatusBadge status={p.status} />
              </Row>
              {p.feedback && <Muted style={{ marginTop: 4 }}>Comentario de la empresa: “{p.feedback}”</Muted>}
              {p.status === 'enviada' && (
                <Button small variant="secondary" title="Retirar postulación" style={{ alignSelf: 'flex-start', marginTop: 8 }}
                  loading={withdraw.isPending}
                  onPress={async () => { if (await confirm('¿Retirar la postulación?', 'La empresa ya no podrá revisarla. No podrás volver a postular con este equipo.', { confirmText: 'Retirar', danger: true })) withdraw.mutate(p.id); }} />
              )}
            </Card>
          ))}
          {ch.status === 'abierto' && (
            <Button title="Postularme con mi equipo" icon="paper-plane-outline" disabled={ch.nda_required}
              onPress={() => router.push(`/reto/${id}/postular`)} />
          )}
          {ch.status === 'abierto' && ch.nda_required && <Muted style={{ marginTop: 6 }}>Primero acepta el acuerdo de confidencialidad.</Muted>}
        </Section>
      )}

      {/* ---------- Dueño del reto ---------- */}
      {isOwner && (
        <Section title="Administrar problemática">
          <Row>
            <Button title={`Postulaciones (${ch.proposals_count})`} icon="people-outline" onPress={() => router.push(`/reto/${id}/postulaciones`)} />
            <Button title="Sugerencias de talento y laboratorios" variant="secondary" icon="sparkles-outline"
              onPress={() => router.push(`/reto/${id}/sugerencias`)} />
            {(ch.status === 'borrador' || ch.status === 'abierto') && (
              <Button title="Editar" variant="secondary" icon="create-outline"
                onPress={() => router.push({ pathname: '/publicar', params: { id } })} />
            )}
          </Row>
          <Row style={{ marginTop: 10 }}>
            {TRANSITIONS[ch.status].map((s) => (
              <Button key={s} small variant={s === 'cancelado' ? 'danger' : s === 'finalizado' ? 'success' : 'secondary'}
                title={TRANSITION_TEXT[s]} loading={setStatus.isPending}
                onPress={async () => { if (await confirm(`¿${TRANSITION_TEXT[s]}?`, undefined, { confirmText: TRANSITION_TEXT[s], danger: s === 'cancelado' })) setStatus.mutate(s); }} />
            ))}
            {ch.status === 'borrador' && (
              <Button small variant="danger" title="Eliminar borrador" icon="trash-outline"
                onPress={async () => { if (await confirm('¿Eliminar este borrador?', 'Se borrará por completo y no se puede deshacer.', { confirmText: 'Eliminar', danger: true, icon: 'trash-outline' })) remove.mutate(undefined); }} />
            )}
          </Row>
        </Section>
      )}

      {/* ---------- Colaboración (dueño + equipo aceptado) ---------- */}
      {participant && active && (
        <Section title="Colaboración">
          {accepted && <Muted style={{ marginBottom: 8 }}>Equipo asignado: {accepted.team?.name}</Muted>}
          <Row>
            <Button title="Hitos y entregas" icon="flag-outline" onPress={() => router.push(`/reto/${id}/hitos`)} />
            <Button title="Mensajes" variant="secondary" icon="chatbubbles-outline" onPress={() => router.push(`/reto/${id}/chat`)} />
            {ch.status === 'finalizado' && (
              <Button title="Evaluar participantes" variant="success" icon="star-outline" onPress={() => router.push(`/reto/${id}/evaluar`)} />
            )}
          </Row>
        </Section>
      )}
    </Screen>
  );
}
