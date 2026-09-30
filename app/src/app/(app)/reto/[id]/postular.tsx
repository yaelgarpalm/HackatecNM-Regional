import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

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
          const reqs = ch.data?.required_disciplines ?? [];
          const studentMembers = t.members.filter((m) => m.role !== 'asesor');
          // Validar carreras requeridas si el reto las especifica
          const invalidStudents = reqs.length
            ? studentMembers.filter((m) => !m.user.career || !reqs.some((r) => m.user.career?.toLowerCase().includes(r.toLowerCase())))
            : [];
          const hasRequiredDisciplines = invalidStudents.length === 0;
          const meetsMinDisciplines = t.disciplines.length >= min;
          const canSubmitTeam = hasRequiredDisciplines && meetsMinDisciplines;
          const on = teamId === t.id;

          return (
            <Pressable key={t.id} onPress={() => setTeamId(t.id)}>
              <Card style={on ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <H2>{t.name}</H2>
                  <Badge
                    text={canSubmitTeam ? 'Equipo listo' : !meetsMinDisciplines ? `Faltan ${min - t.disciplines.length} carrera(s)` : 'Carrera no requerida'}
                    tone={canSubmitTeam ? 'success' : 'danger'}
                  />
                </Row>
                <Muted>{t.disciplines.join(' · ') || 'Sin carreras registradas'}</Muted>
                <Muted>{t.members.length} integrante(s) (mínimo exigido: {min} carreras distintas)</Muted>

                {reqs.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Muted style={{ fontSize: 12 }}>Disciplinas que busca este reto: {reqs.join(', ')}</Muted>
                    {invalidStudents.length > 0 && (
                      <Muted style={{ color: colors.danger, fontSize: 12, marginTop: 2 }}>
                        ⚠️ Integrantes que no coinciden con las carreras requeridas: {invalidStudents.map((m) => m.user.full_name).join(', ')}
                      </Muted>
                    )}
                  </View>
                )}
                {!canSubmitTeam && (
                  <Button small variant="ghost" title="Completar equipo" icon="person-add-outline"
                    onPress={() => router.push(`/equipo/${t.id}`)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
                )}
              </Card>
            </Pressable>
          );
        })}
      </Section>

      <Section title="2. Propuesta formal">
        <Card>
          <Field label="Enfoque de solución" value={approach} onChangeText={setApproach} multiline
            hint="¿Cómo resolverían el problema real? Mínimo 20 caracteres." />
          <Field label="Plan de trabajo (opcional)" value={plan} onChangeText={setPlan} multiline
            hint="Metodología, fases o etapas estimadas." />
          <Field label="Semanas estimadas para completar la solución" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />
          <Body style={{ marginBottom: 10, fontSize: 13, color: colors.muted }}>
            🔒 Al postular, todos los integrantes quedan formalmente cubiertos por el acuerdo de confidencialidad de la problemática.
          </Body>
          <Button title="Enviar postulación formal" icon="paper-plane-outline" loading={submit.isPending}
            disabled={!teamId || approach.trim().length < 20} onPress={() => submit.mutate(undefined)} />
        </Card>
      </Section>
    </Screen>
  );
}
