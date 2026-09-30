import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi } from '@/components/hooks';
import { Badge, Button, Card, ErrorView, Field, H2, Loading, Muted, Row, Screen, Stars } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { label } from '@/lib/format';
import type { Challenge, UserPublic } from '@/lib/types';

function ReviewCard({ chId, person }: { chId: string; person: UserPublic }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const send = useAction(() => api.post(`/challenges/${chId}/reviews`, { reviewee_id: person.id, score, comment: comment || null }), {
    successMessage: `Evaluación enviada a ${person.full_name}`,
    successDetail: '¡Gracias! Ayuda a construir la reputación en la plataforma.',
    onSuccess: () => setDone(true),
    invalidate: [],
  });

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{person.full_name}</H2>
        <Badge text={label(person.role)} tone="primary" />
      </Row>
      {!!person.career && <Muted>{person.career}</Muted>}
      {done ? (
        <Badge text="Evaluación enviada" tone="success" icon="checkmark-circle" />
      ) : (
        <>
          <Row style={{ marginVertical: 8 }}>
            <Stars value={score} onChange={setScore} size={28} />
          </Row>
          <Field label="Comentario (aparece en su portafolio)" value={comment} onChangeText={setComment} multiline style={{ minHeight: 60 }} />
          <Button small title="Enviar evaluación" disabled={!score} loading={send.isPending}
            onPress={() => send.mutate(undefined)} style={{ alignSelf: 'flex-start' }} />
        </>
      )}
    </Card>
  );
}

export default function Evaluar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const ch = useApi<Challenge>(`/challenges/${id}`);
  const q = useApi<UserPublic[]>(`/challenges/${id}/participants`);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Evaluar' }} />
      <H2>{ch.data?.title}</H2>
      <Muted style={{ marginBottom: 12 }}>
        Las evaluaciones construyen la reputación de estudiantes y organizaciones y generan confianza para futuras problemáticas.
      </Muted>
      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> :
        q.data?.filter((p) => p.id !== user.id).map((p) => <ReviewCard key={p.id} chId={id} person={p} />)}
    </Screen>
  );
}
