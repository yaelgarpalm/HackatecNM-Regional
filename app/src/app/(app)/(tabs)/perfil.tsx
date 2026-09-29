import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import {
  Badge, Body, Button, Card, confirm, Empty, ErrorView, H2, Loading, Muted, Row, Screen, Section, Stars, StatusBadge, Tags, Title,
  type IconName,
} from '@/components/ui';
import { useAuth, useUser } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { label, shortDate } from '@/lib/format';
import type { Organization, Proposal } from '@/lib/types';

function LinkRow({ icon, text, href }: { icon: IconName; text: string; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

/** Postulaciones que los equipos de estudiantes enviaron a las problemáticas de la organización. */
function PostulacionesRecibidas() {
  const q = useApi<Proposal[]>('/proposals/received');
  return (
    <Section title={`Postulaciones recibidas${q.data ? ` (${q.data.length})` : ''}`}>
      {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
        !q.data?.length ? <Empty text="Todavía no recibes postulaciones en tus problemáticas." icon="people-outline" /> :
        q.data.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/reto/${p.challenge_id}/postulaciones`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2 style={{ flex: 1 }}>{p.challenge_title ?? `Problemática #${p.challenge_id}`}</H2>
              <StatusBadge status={p.status} />
            </Row>
            <Muted>Equipo {p.team?.name} · enviada {shortDate(p.created_at)}</Muted>
            <Row gap={6} style={{ marginTop: 6 }}>
              {p.team?.members.filter((m) => m.role !== 'asesor').map((m) => (
                <Badge key={m.user_id} tone="neutral"
                  text={`${m.user.full_name}${m.user.career ? ` · ${m.user.career}` : ''}`} />
              ))}
            </Row>
          </Card>
        ))}
    </Section>
  );
}

export default function Perfil() {
  const user = useUser();
  const { logout } = useAuth();
  const org = useApi<Organization>(user.organization_id ? `/organizations/${user.organization_id}` : null);

  return (
    <Screen>
      <Card>
        <Title>{user.full_name}</Title>
        <Row gap={6}>
          <Badge text={label(user.role)} tone="primary" />
          {org.data && <Badge text={org.data.name} icon={org.data.verified ? 'shield-checkmark' : 'business-outline'} tone={org.data.verified ? 'success' : 'neutral'} />}
        </Row>
        <Muted style={{ marginTop: 6 }}>{user.email}</Muted>
        {user.career && <Body style={{ marginTop: 8 }}>{user.career}{user.semester ? ` · ${user.semester}° semestre` : ''}</Body>}
        {user.bio && <Body style={{ marginTop: 6 }}>{user.bio}</Body>}
        <Tags items={user.skills} />
        {user.rating_count > 0 && (
          <Row style={{ marginTop: 8 }}>
            <Stars value={user.rating_avg} />
            <Muted>{user.rating_avg.toFixed(1)} · {user.rating_count} evaluaciones</Muted>
          </Row>
        )}
        <Button small variant="secondary" title="Editar perfil" icon="create-outline" onPress={() => router.push('/editar-perfil')}
          style={{ alignSelf: 'flex-start', marginTop: 12 }} />
      </Card>

      {(user.role === 'empresa' || user.role === 'gobierno') && <PostulacionesRecibidas />}

      <Section title="Accesos">
        <Card style={{ paddingVertical: 0 }}>
          <LinkRow icon="notifications-outline" text="Notificaciones" href="/notificaciones" />
          <LinkRow icon="ribbon-outline" text="Mi portafolio y evaluaciones" href={`/usuario/${user.id}`} />
          {user.organization_id && <LinkRow icon="business-outline" text="Mi organización" href="/mi-organizacion" />}
          <LinkRow icon="stats-chart-outline" text="Indicadores de la plataforma" href="/indicadores" />
          <LinkRow icon="globe-outline" text={user.role === 'admin' ? 'Verificar organizaciones' : 'Directorio de organizaciones'} href="/organizaciones" />
        </Card>
      </Section>

      <Button title="Cerrar sesión" variant="danger" icon="log-out-outline" style={{ marginTop: 20 }}
        onPress={async () => { if (await confirm('¿Cerrar sesión?')) logout(); }} />
      <Muted style={{ textAlign: 'center', marginTop: 16, fontSize: 11 }}>Servidor: {API_URL}</Muted>
    </Screen>
  );
}

