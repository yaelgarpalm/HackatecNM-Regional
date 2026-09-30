import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { useAction, useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import { Badge, Body, Button, Card, Empty, Field, H2, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import type { Challenge, Team } from '@/lib/types';

export default function Postular() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const ch = useApi<Challenge>(`/challenges/${id}`);
  const teams = useApi<Team[]>('/teams/mine');
  const [teamId, setTeamId] = useState<number | null>(null);
  const [approach, setApproach] = useState('');
  const [plan, setPlan] = useState('');
  const [weeks, setWeeks] = useState('');

  const submit = useAction(
    () => api.post(`/challenges/${id}/proposals`, {
      team_id: teamId, approach, work_plan: plan || null, estimated_weeks: weeks ? Number(weeks) : null,
    }),
    {
      successMessage: '¡Postulación enviada!',
      successDetail: 'La empresa la revisará y te avisaremos con una notificación.',
      onSuccess: () => router.replace(`/reto/${id}`) },
  );

  if (ch.isLoading || teams.isLoading) return <Loading />;
  const eligible = (teams.data ?? []).filter((t) => t.members.some((m) => m.user_id === user.id && m.role !== 'integrante'));
  const min = ch.data?.min_disciplines ?? 1;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Postular equipo' }} />
      <H2>{ch.data?.title}</H2>
      <Muted>Se requiere un equipo con al menos {min} carrera(s) distintas.</Muted>

      <Section title="1. Elige el equipo">
        {!eligible.length ? (
          <Card>
            <Empty text="Debes ser líder o asesor de un equipo para postularlo." icon="people-outline" />
            <Button title="Ir a mis equipos" variant="secondary" onPress={() => router.push('/equipos')} />
          </Card>
        ) : eligible.map((t) => {
          const ok = t.disciplines.length >= min;
          const on = teamId === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTeamId(t.id)}>
              <Card style={on ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <H2>{t.name}</H2>
                  <Badge text={ok ? 'Cumple' : `Faltan ${min - t.disciplines.length} carrera(s)`} tone={ok ? 'success' : 'danger'} />
                </Row>
                <Muted>{t.disciplines.join(' · ') || 'Sin carreras registradas'}</Muted>
                <Muted>{t.members.length} integrante(s)</Muted>
              </Card>
            </Pressable>
          );
        })}
      </Section>

      <Section title="2. Propuesta">
        <Card>
          <Field label="Enfoque de solución" value={approach} onChangeText={setApproach} multiline
            hint="¿Cómo resolverían el problema? Mínimo 20 caracteres." />
          <Field label="Plan de trabajo (opcional)" value={plan} onChangeText={setPlan} multiline />
          <Field label="Semanas estimadas" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />
          <Body style={{ marginBottom: 10, fontSize: 13, color: colors.muted }}>
            Al postular, todos los integrantes quedan cubiertos por el acuerdo de confidencialidad de la problemática.
          </Body>
          <Button title="Enviar postulación" icon="paper-plane-outline" loading={submit.isPending}
            disabled={!teamId || approach.trim().length < 20} onPress={() => submit.mutate(undefined)} />
        </Card>
      </Section>
    </Screen>
  );
}
