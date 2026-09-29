import { router, Stack, type Href } from 'expo-router';

import { useAction, useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import { Body, Button, Card, Empty, ErrorView, Loading, Muted, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Notification, Page } from '@/lib/types';

/** El backend genera rutas en español (/retos/5/hitos); aquí se traducen a las pantallas de la app. */
function toRoute(link: string | null): Href | null {
  if (!link) return null;
  let m = link.match(/^\/retos\/(\d+)(?:\/(\w+))?/);
  if (m) {
    const sub = m[2] === 'postulaciones' || m[2] === 'hitos' ? `/${m[2]}` : '';
    return `/reto/${m[1]}${sub}` as Href;
  }
  if ((m = link.match(/^\/equipos\/(\d+)/))) return `/equipo/${m[1]}` as Href;
  if ((m = link.match(/^\/perfil\/(\d+)/))) return `/usuario/${m[1]}` as Href;
  return null;
}

export default function Notificaciones() {
  const q = useApi<Page<Notification>>('/users/me/notifications', { size: 50 });
  const readAll = useAction(() => api.post('/users/me/notifications/read-all'));

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />
      <Row style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button small variant="secondary" title="Marcar todas como leídas" icon="checkmark-done" loading={readAll.isPending}
          onPress={() => readAll.mutate(undefined)} />
      </Row>
      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} /> :
        !q.data?.items.length ? <Empty text="No tienes notificaciones." icon="notifications-off-outline" /> :
        q.data.items.map((n) => {
          const route = toRoute(n.link);
          return (
            <Card key={n.id} onPress={route ? () => router.push(route) : undefined}
              style={!n.read ? { borderLeftWidth: 4, borderLeftColor: colors.accent } : undefined}>
              <Body style={{ fontWeight: n.read ? '400' : '700' }}>{n.title}</Body>
              {n.body && <Muted>{n.body}</Muted>}
              <Muted style={{ fontSize: 11, marginTop: 4 }}>{timeAgo(n.created_at)}</Muted>
            </Card>
          );
        })}
    </Screen>
  );
}
