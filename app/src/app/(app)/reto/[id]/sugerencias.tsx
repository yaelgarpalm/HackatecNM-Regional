import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useApi } from '@/components/hooks';
import { Badge, Body, Card, ChipSelect, Empty, ErrorView, H2, Loading, Muted, Row, ScoreBar, Screen, Section, Stars, Tags } from '@/components/ui';
import { label } from '@/lib/format';
import type { CapabilityMatch, Challenge, UserMatch } from '@/lib/types';

export default function Sugerencias() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [role, setRole] = useState<'estudiante' | 'academico'>('estudiante');
  const ch = useApi<Challenge>(`/challenges/${id}`);
  const caps = useApi<CapabilityMatch[]>(`/challenges/${id}/matches/capabilities`);
  const talent = useApi<UserMatch[]>(`/challenges/${id}/matches/talent`, { role });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sugerencias' }} />
      <H2>{ch.data?.title}</H2>
      <Muted>Coincidencias calculadas con las etiquetas y disciplinas del reto. Cada una explica por qué se sugiere.</Muted>

      <Section title="Laboratorios, equipo y expertos">
        {caps.isLoading ? <Loading /> : caps.error ? <ErrorView error={caps.error} /> :
          !caps.data?.length ? <Empty text="Sin coincidencias. Prueba agregar más etiquetas al reto." icon="flask-outline" /> :
          caps.data.map((m) => (
            <Card key={m.capability.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>{m.capability.name}</H2>
                <Badge text={label(m.capability.type)} tone="primary" />
              </Row>
              <Muted>{m.organization_name}</Muted>
              {m.capability.description && <Body style={{ marginTop: 4 }}>{m.capability.description}</Body>}
              <ScoreBar score={m.score} />
              {m.reasons.map((r) => <Muted key={r}>• {r}</Muted>)}
            </Card>
          ))}
      </Section>

      <Section title="Talento afín">
        <ChipSelect options={['estudiante', 'academico'] as const} value={role} onChange={(v) => v && setRole(v)} />
        {talent.isLoading ? <Loading /> : talent.error ? <ErrorView error={talent.error} /> :
          !talent.data?.length ? <Empty text="Sin coincidencias por ahora." icon="people-outline" /> :
          talent.data.map((m) => (
            <Card key={m.user.id} onPress={() => router.push(`/usuario/${m.user.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>{m.user.full_name}</H2>
                {m.user.rating_count > 0 && <Stars value={m.user.rating_avg} size={14} />}
              </Row>
              <Muted>{m.user.career}</Muted>
              <Tags items={m.user.skills} tone="neutral" />
              <ScoreBar score={m.score} />
              {m.reasons.map((r) => <Muted key={r}>• {r}</Muted>)}
            </Card>
          ))}
      </Section>
    </Screen>
  );
}
