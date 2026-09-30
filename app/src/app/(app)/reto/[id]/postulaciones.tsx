import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi } from '@/components/hooks';
import {
  Badge, Body, Button, Card, confirm, Empty, ErrorView, Field, H2, Loading, Muted, Row, ScoreBar, Screen, StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { label, shortDate } from '@/lib/format';
import type { Challenge, Proposal } from '@/lib/types';

function ProposalCard({ p, canDecide }: { p: Proposal; canDecide: boolean }) {
  const [feedback, setFeedback] = useState('');
  const decide = useAction((status: 'aceptada' | 'rechazada') =>
    api.patch(`/proposals/${p.id}`, { status, feedback: feedback || null }), {
    successMessage: (status) => status === 'aceptada' ? `¡Propuesta de ${p.team?.name} aceptada!` : 'Propuesta rechazada',
    successDetail: (status) => status === 'aceptada'
      ? 'La problemática pasó a "En progreso". Define los hitos para empezar.'
      : 'El equipo recibió una notificación.',
  });

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{p.team?.name}</H2>
        <StatusBadge status={p.status} />
      </Row>
      <Muted>Enviada {shortDate(p.created_at)}{p.estimated_weeks ? ` · ${p.estimated_weeks} semanas estimadas` : ''}</Muted>

      <Muted style={{ marginTop: 10, fontWeight: '700' }}>Cobertura de disciplinas requeridas</Muted>
      <ScoreBar score={p.discipline_coverage ?? 0} />

      <Row gap={6} style={{ marginTop: 8 }}>
        {p.team?.members.map((m) => (
          <Badge key={m.user_id} tone={m.role === 'asesor' ? 'accent' : 'neutral'}
            text={`${m.user.full_name}${m.user.career ? ` · ${m.user.career}` : ''}${m.role !== 'integrante' ? ` (${label(m.role)})` : ''}`} />
        ))}
      </Row>
      <Row style={{ marginTop: 4 }}>
        {p.team?.members.map((m) => (
          <Button key={m.user_id} small variant="ghost" title={`Ver perfil: ${m.user.full_name}`}
            onPress={() => router.push(`/usuario/${m.user_id}`)} />
        ))}
      </Row>

      <Muted style={{ marginTop: 10, fontWeight: '700' }}>Enfoque</Muted>
      <Body>{p.approach}</Body>
      {p.work_plan && (
        <>
          <Muted style={{ marginTop: 8, fontWeight: '700' }}>Plan de trabajo</Muted>
          <Body>{p.work_plan}</Body>
        </>
      )}
      {p.feedback && <Muted style={{ marginTop: 8 }}>Comentario: “{p.feedback}”</Muted>}

      {canDecide && p.status === 'enviada' && (
        <>
          <Field label="Comentario para el equipo (opcional)" value={feedback} onChangeText={setFeedback} multiline style={{ minHeight: 60 }} />
          <Row>
            <Button title="Aceptar" variant="success" icon="checkmark" loading={decide.isPending}
              onPress={async () => {
                if (await confirm('¿Aceptar esta propuesta?', 'La problemática pasará a "En progreso" y las demás postulaciones se rechazarán automáticamente.', { confirmText: 'Aceptar propuesta', icon: 'checkmark-circle-outline' })) decide.mutate('aceptada');
              }} />
            <Button title="Rechazar" variant="secondary" icon="close" loading={decide.isPending}
              onPress={async () => { if (await confirm('¿Rechazar esta propuesta?', 'El equipo recibirá una notificación con tu comentario.', { confirmText: 'Rechazar', danger: true })) decide.mutate('rechazada'); }} />
          </Row>
        </>
      )}
    </Card>
  );
}

export default function Postulaciones() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ch = useApi<Challenge>(`/challenges/${id}`);
  const q = useApi<Proposal[]>(`/challenges/${id}/proposals`);

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'Postulaciones' }} />
      <H2>{ch.data?.title}</H2>
      <Muted style={{ marginBottom: 12 }}>Compara enfoques, perfiles y la cobertura de disciplinas de cada equipo.</Muted>
      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
        !q.data?.length ? <Empty text="Todavía no hay postulaciones." icon="people-outline" /> :
        q.data.map((p) => <ProposalCard key={p.id} p={p} canDecide={ch.data?.status === 'abierto'} />)}
    </Screen>
  );
}
