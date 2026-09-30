import { router } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi } from '@/components/hooks';
import { Badge, Button, Card, Empty, ErrorView, Field, H2, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { label } from '@/lib/format';
import type { Team } from '@/lib/types';

export default function Equipos() {
  const q = useApi<Team[]>('/teams/mine');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useAction((b: { name: string; description: string }) => api.post<Team>('/teams', b), {
    successMessage: (b) => `Equipo "${b.name}" creado`,
    successDetail: 'Ahora invita a compañeros de otras carreras.',
    onSuccess: (t) => { setName(''); setDescription(''); router.push(`/equipo/${t.id}`); },
  });

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Muted>Las problemáticas piden equipos con varias carreras. Invita a compañeros de otras ingenierías o licenciaturas y a un asesor.</Muted>

      <Section title="Mis equipos">
        {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
          !q.data?.length ? <Empty text="Aún no perteneces a ningún equipo." icon="people-outline" /> :
          q.data.map((t) => (
            <Card key={t.id} onPress={() => router.push(`/equipo/${t.id}`)}>
              <H2>{t.name}</H2>
              {t.description && <Muted>{t.description}</Muted>}
              <Row gap={6} style={{ marginTop: 8 }}>
                <Badge text={`${t.members.length} integrantes`} icon="people-outline" />
                <Badge text={`${t.disciplines.length} carreras`} tone={t.disciplines.length >= 2 ? 'success' : 'warning'} icon="school-outline" />
                {t.members.filter((m) => m.role !== 'integrante').map((m) => (
                  <Badge key={m.user_id} text={`${label(m.role)}: ${m.user.full_name}`} tone="primary" />
                ))}
              </Row>
            </Card>
          ))}
      </Section>

      <Section title="Crear equipo">
        <Card>
          <Field label="Nombre del equipo" value={name} onChangeText={setName} />
          <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} multiline />
          <Button title="Crear" icon="add" loading={create.isPending} disabled={name.trim().length < 2}
            onPress={() => create.mutate({ name, description })} />
        </Card>
      </Section>
    </Screen>
  );
}
