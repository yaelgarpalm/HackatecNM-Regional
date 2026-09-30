import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { useApi } from '@/components/hooks';
import { Badge, Body, Button, Card, Empty, ErrorView, Loading, Muted, Row, Screen, Section, Stars, Tags, Title } from '@/components/ui';
import { useUser } from '@/lib/auth';
import { label, shortDate } from '@/lib/format';
import type { Organization, Review, User, UserPublic } from '@/lib/types';

export default function Usuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUser();
  const q = useApi<UserPublic>(`/users/${id}`);
  const reviews = useApi<Review[]>(`/users/${id}/reviews`);
  const org = useApi<Organization>(q.data?.organization_id ? `/organizations/${q.data.organization_id}` : null);
  const full = me.id === Number(id) ? (me as User) : null; // datos privados solo del propio perfil

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorView error={q.error} /></Screen>;
  const u = q.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Perfil' }} />
      <Card>
        <Title>{u.full_name}</Title>
        <Row gap={6}>
          <Badge text={label(u.role)} tone="primary" />
          {org.data && <Badge text={org.data.name} icon={org.data.verified ? 'shield-checkmark' : undefined} tone={org.data.verified ? 'success' : 'neutral'} />}
        </Row>
        {!!u.career && <Body style={{ marginTop: 8 }}>{u.career}</Body>}
        <Tags items={u.skills} />
        <Row style={{ marginTop: 10 }}>
          <Stars value={u.rating_avg} />
          <Muted>{u.rating_count ? `${u.rating_avg.toFixed(1)} de 5 · ${u.rating_count} evaluaciones` : 'Sin evaluaciones todavía'}</Muted>
        </Row>
        {!!full?.portfolio_url && (
          <Button small variant="ghost" icon="link-outline" title="Portafolio" style={{ alignSelf: 'flex-start' }}
            onPress={() => Linking.openURL(full.portfolio_url!)} />
        )}
      </Card>

      <Section title="Evaluaciones y experiencia en proyectos">
        {reviews.isLoading ? <Loading /> : !reviews.data?.length ? <Empty text="Aún no hay evaluaciones ni proyectos concluidos registrados." icon="star-outline" /> :
          reviews.data.map((r) => (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Stars value={r.score} size={16} />
                <Muted>Proyecto #{r.challenge_id} · {shortDate(r.created_at)}</Muted>
              </Row>
              {!!r.comment && <Body style={{ marginTop: 6, fontStyle: 'italic' }}>“{r.comment}”</Body>}
              <Button small variant="ghost" title={`Ver detalle del proyecto #${r.challenge_id}`} icon="folder-open-outline"
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
                onPress={() => router.push(`/reto/${r.challenge_id}`)} />
            </Card>
          ))}
      </Section>
    </Screen>
  );
}

