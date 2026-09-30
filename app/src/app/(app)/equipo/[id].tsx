import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi } from '@/components/hooks';
import {
  Badge, Body, Button, Card, ChipSelect, confirm, Empty, ErrorView, Field, H2, Loading, Muted, Row, Screen, Section, Tags,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { label } from '@/lib/format';
import type { Page, Team, UserPublic } from '@/lib/types';

export default function EquipoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const q = useApi<Team>(`/teams/${id}`);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'estudiante' | 'academico'>('estudiante');
  const results = useApi<Page<UserPublic>>(search ? '/users' : null, { q: search, role, size: 20 });

  const add = useAction((b: { user_id: number; role: string }) => api.post(`/teams/${id}/members`, b), {
    successMessage: 'Integrante agregado', successDetail: 'Le avisamos con una notificación.',
  });
  const remove = useAction((uid: number) => api.del(`/teams/${id}/members/${uid}`), { successMessage: 'Integrante quitado del equipo' });
  const leave = useAction(() => api.del(`/teams/${id}/members/${user.id}`), { successMessage: 'Saliste del equipo', onSuccess: () => router.replace('/equipos') });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorView error={q.error} /></Screen>;
  const t = q.data;
  const me = t.members.find((m) => m.user_id === user.id);
  const manager = me && me.role !== 'integrante';
  const inTeam = new Set(t.members.map((m) => m.user_id));

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: t.name }} />
      {!!t.description && <Body>{t.description}</Body>}
      <Row style={{ marginTop: 8 }} gap={6}>
        <Badge text={`${t.disciplines.length} carrera(s)`} tone={t.disciplines.length >= 2 ? 'success' : 'warning'} icon="school-outline" />
      </Row>
      <Tags items={t.disciplines} tone="accent" />

      <Section title="Integrantes">
        {t.members.map((m) => (
          <Card key={m.user_id} onPress={() => router.push(`/usuario/${m.user_id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{m.user.full_name}</H2>
              <Badge text={label(m.role)} tone={m.role === 'integrante' ? 'neutral' : 'primary'} />
            </Row>
            <Muted>{m.user.career ?? label(m.user.role)}</Muted>
            <Tags items={m.user.skills} tone="neutral" />
            {(manager || m.user_id === user.id) && (
              <Button small variant="ghost" title={m.user_id === user.id ? 'Salir del equipo' : 'Quitar'} icon="person-remove-outline"
                style={{ alignSelf: 'flex-start', marginTop: 6 }}
                onPress={async () => {
                  if (await confirm(m.user_id === user.id ? '¿Salir del equipo?' : `¿Quitar a ${m.user.full_name}?`, undefined,
                    { confirmText: m.user_id === user.id ? 'Salir' : 'Quitar', danger: true })) {
                    if (m.user_id === user.id) leave.mutate(undefined);
                    else remove.mutate(m.user_id);
                  }
                }} />
            )}
          </Card>
        ))}
      </Section>

      {manager && (
        <Section title="Invitar integrantes">
          <Muted style={{ marginBottom: 8 }}>Busca por nombre, carrera o habilidad. Pueden ser de otras carreras o universidades.</Muted>
          <ChipSelect options={['estudiante', 'academico'] as const} value={role} onChange={(v) => v && setRole(v)} />
          <Field label="Buscar" value={text} onChangeText={setText} onSubmitEditing={() => setSearch(text)} placeholder="Diseño, Industrial, Marketing…" />
          <Button small title="Buscar" icon="search" onPress={() => setSearch(text)} style={{ alignSelf: 'flex-start', marginBottom: 10, marginTop: -4 }} />
          {results.isLoading && <Loading />}
          {results.data && !results.data.items.length && <Empty text="Sin resultados." />}
          {results.data?.items.filter((u) => !inTeam.has(u.id)).map((u) => (
            <Card key={u.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>{u.full_name}</H2>
                <Row gap={6}>
                  <Button small title="Agregar" icon="person-add-outline" loading={add.isPending}
                    onPress={() => add.mutate({ user_id: u.id, role: 'integrante' })} />
                  {u.role === 'academico' && (
                    <Button small variant="secondary" title="Como asesor" loading={add.isPending}
                      onPress={() => add.mutate({ user_id: u.id, role: 'asesor' })} />
                  )}
                </Row>
              </Row>
              <Muted>{u.career}</Muted>
              <Tags items={u.skills} tone="neutral" />
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
