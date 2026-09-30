import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { DateField } from '@/components/DateField';
import { useAction, useApi } from '@/components/hooks';
import { Body, Button, Card, Empty, ErrorView, Field, H2, Loading, Muted, Row, Screen, Section, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { isAcademic, useUser } from '@/lib/auth';
import { shortDate } from '@/lib/format';
import type { Challenge, Milestone } from '@/lib/types';

function MilestoneCard({ m, isOwner, isTeam }: { m: Milestone; isOwner: boolean; isTeam: boolean }) {
  const [url, setUrl] = useState(m.deliverable_url ?? '');
  const [comment, setComment] = useState('');
  const deliver = useAction(() => api.post(`/milestones/${m.id}/deliver`, { deliverable_url: url }), {
    successMessage: 'Entrega registrada', successDetail: 'La empresa recibió una notificación para revisarla.',
  });
  const review = useAction((status: string) => api.post(`/milestones/${m.id}/review`, { status, company_comment: comment || null }), {
    successMessage: (status) => status === 'aprobado' ? 'Entrega aprobada' : 'Cambios solicitados',
    successDetail: 'El equipo recibió tu respuesta.',
  });

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{m.title}</H2>
        <StatusBadge status={m.status} />
      </Row>
      {!!m.due_date && <Muted>Fecha compromiso: {shortDate(m.due_date)}</Muted>}
      {!!m.description && <Body style={{ marginTop: 6 }}>{m.description}</Body>}
      {!!m.deliverable_url && (
        <Button small variant="ghost" icon="link-outline" title="Abrir entregable" style={{ alignSelf: 'flex-start' }}
          onPress={() => Linking.openURL(m.deliverable_url!)} />
      )}
      {!!m.company_comment && <Muted style={{ marginTop: 4 }}>Comentario de la empresa: “{m.company_comment}”</Muted>}

      {isTeam && m.status !== 'aprobado' && (
        <>
          <Field label="Enlace del entregable" value={url} onChangeText={setUrl} autoCapitalize="none"
            placeholder="https://github.com/… o https://drive.google.com/…" />
          <Button small title={m.status === 'pendiente' ? 'Entregar' : 'Volver a entregar'} icon="cloud-upload-outline"
            disabled={!url.trim()} loading={deliver.isPending} onPress={() => deliver.mutate(undefined)} style={{ alignSelf: 'flex-start' }} />
        </>
      )}

      {isOwner && m.status === 'entregado' && (
        <>
          <Field label="Comentario (opcional)" value={comment} onChangeText={setComment} multiline style={{ minHeight: 60 }} />
          <Row>
            <Button small variant="success" title="Aprobar" icon="checkmark" loading={review.isPending} onPress={() => review.mutate('aprobado')} />
            <Button small variant="secondary" title="Pedir cambios" icon="refresh" loading={review.isPending} onPress={() => review.mutate('cambios_solicitados')} />
          </Row>
        </>
      )}
    </Card>
  );
}

export default function Hitos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const ch = useApi<Challenge>(`/challenges/${id}`);
  const q = useApi<Milestone[]>(`/challenges/${id}/milestones`);
  const [f, setF] = useState({ title: '', description: '', due_date: '' });
  const create = useAction(() => api.post(`/challenges/${id}/milestones`, {
    title: f.title, description: f.description || null, due_date: f.due_date || null,
  }), {
    successMessage: (_a: undefined) => `Hito "${f.title}" creado`, successDetail: 'El equipo ya puede verlo y entregar.',
    onSuccess: () => setF({ title: '', description: '', due_date: '' }),
  });

  const isOwner = !!ch.data && (user.role === 'admin' || user.organization_id === ch.data.organization_id);
  const isTeam = isAcademic(user) && !isOwner;
  const done = (q.data ?? []).filter((m) => m.status === 'aprobado').length;

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'Hitos y entregas' }} />
      <H2>{ch.data?.title}</H2>
      <Muted>{done} de {q.data?.length ?? 0} hitos aprobados</Muted>

      <Section title="Hitos">
        {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> :
          !q.data?.length ? <Empty text="Aún no se definen hitos. Acuerden entregables parciales para dar seguimiento." icon="flag-outline" /> :
          q.data.map((m) => <MilestoneCard key={m.id} m={m} isOwner={isOwner} isTeam={isTeam} />)}
      </Section>

      {ch.data?.status === 'en_progreso' && (
        <Section title="Nuevo hito">
          <Card>
            <Field label="Título" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} placeholder="Prototipo funcional" />
            <Field label="Descripción" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline />
            <DateField label="Fecha compromiso" value={f.due_date} onChange={(v) => setF({ ...f, due_date: v })} />
            <Button title="Agregar hito" icon="add" disabled={f.title.trim().length < 3} loading={create.isPending} onPress={() => create.mutate(undefined)} />
          </Card>
        </Section>
      )}
    </Screen>
  );
}
