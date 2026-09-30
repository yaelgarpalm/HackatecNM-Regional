import { Ionicons } from '@expo/vector-icons';
import { router, Stack, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAction, useApi } from '@/components/hooks';
import { colors, radius } from '@/components/theme';
import { Button, Empty, ErrorView, Loading, Muted, Row, Screen, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Notification, Page } from '@/lib/types';

/** El backend genera rutas en español (/retos/5/hitos); aquí se traducen a las pantallas de la app. */
function toRoute(link: string | null): Href | null {
  if (!link) return null;
  let m = link.match(/^\/retos\/(\d+)(?:\/(\w+))?/);
  if (m) {
    const sub = ['postulaciones', 'hitos', 'videollamada', 'chat'].includes(m[2]) ? `/${m[2]}` : '';
    return `/reto/${m[1]}${sub}` as Href;
  }
  if ((m = link.match(/^\/equipos\/(\d+)/))) return `/equipo/${m[1]}` as Href;
  if ((m = link.match(/^\/perfil\/(\d+)/))) return `/usuario/${m[1]}` as Href;
  return null;
}

/** Ícono y color según de qué trata la notificación. */
function kindOf(n: Notification): { icon: IconName; color: string; soft: string } {
  const t = n.title.toLowerCase();
  if (t.includes('aceptada') || t.includes('aprobado') || t.includes('finalizó'))
    return { icon: 'trophy-outline', color: colors.success, soft: colors.successSoft };
  if (t.includes('no fue seleccionada') || t.includes('rechazada') || t.includes('cancelada') || t.includes('cambios'))
    return { icon: 'alert-circle-outline', color: colors.danger, soft: colors.dangerSoft };
  if (t.includes('postulación')) return { icon: 'paper-plane-outline', color: colors.primary, soft: colors.primarySoft };
  if (t.includes('entrega') || t.includes('hito')) return { icon: 'flag-outline', color: colors.accent, soft: colors.accentSoft };
  if (t.includes('evaluación')) return { icon: 'star-outline', color: colors.warning, soft: colors.warningSoft };
  if (t.includes('equipo')) return { icon: 'people-outline', color: colors.primary, soft: colors.primarySoft };
  return { icon: 'notifications-outline', color: colors.primary, soft: colors.primarySoft };
}

function NotificationCard({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const k = kindOf(n);
  const route = toRoute(n.link);
  return (
    <Pressable onPress={() => onOpen(n)}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, marginBottom: 8,
        borderRadius: radius.lg, borderWidth: 1,
        borderColor: !n.read ? k.color : hovered ? colors.primary : colors.border,
        backgroundColor: pressed ? colors.bg : colors.card,
      })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: k.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={k.icon} size={22} color={k.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: n.read ? '500' : '800' }}>{n.title}</Text>
          {!n.read && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.color, marginTop: 5 }} />}
        </Row>
        {n.body ? <Text style={{ fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 }}>{n.body}</Text> : null}
        <Row gap={6} style={{ marginTop: 8 }}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Muted style={{ fontSize: 12 }}>{timeAgo(n.created_at)}</Muted>
          {route && <Muted style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}> · Ver detalle ›</Muted>}
        </Row>
      </View>
    </Pressable>
  );
}

export default function Notificaciones() {
  const q = useApi<Page<Notification>>('/users/me/notifications', { size: 50 });
  const readAll = useAction(() => api.post('/users/me/notifications/read-all'), {
    successMessage: 'Todo al día', successDetail: 'Marcaste todas las notificaciones como leídas.',
  });
  const readOne = useAction((nid: number) => api.post(`/users/me/notifications/${nid}/read`));

  const open = (n: Notification) => {
    if (!n.read) readOne.mutate(n.id);
    const route = toRoute(n.link);
    if (route) router.push(route);
  };

  const items = q.data?.items ?? [];
  const nuevas = items.filter((n) => !n.read);
  const anteriores = items.filter((n) => n.read);

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />

      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Tus notificaciones</Text>
          {q.data && <Muted>{nuevas.length ? `Tienes ${nuevas.length} sin leer` : 'Estás al día'}</Muted>}
        </View>
        {nuevas.length > 0 && (
          <Button small variant="secondary" title="Marcar todas como leídas" icon="checkmark-done" loading={readAll.isPending}
            onPress={() => readAll.mutate(undefined)} />
        )}
      </Row>

      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
        !items.length ? <Empty text="Aquí verás las novedades de tus problemáticas, postulaciones y equipos." icon="notifications-off-outline" /> : (
          <>
            {nuevas.length > 0 && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.muted, marginBottom: 8, letterSpacing: 0.5 }}>NUEVAS</Text>
                {nuevas.map((n) => <NotificationCard key={n.id} n={n} onOpen={open} />)}
              </>
            )}
            {anteriores.length > 0 && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.muted, marginVertical: 8, letterSpacing: 0.5 }}>ANTERIORES</Text>
                {anteriores.map((n) => <NotificationCard key={n.id} n={n} onOpen={open} />)}
              </>
            )}
          </>
        )}
    </Screen>
  );
}
