import { router } from 'expo-router';

import { ChallengeCard } from '@/components/ChallengeCard';
import { NearbyUniversities } from '@/components/NearbyUniversities';
import { UniversityDashboard } from '@/components/UniversityDashboard';
import { useApi } from '@/components/hooks';
import {
  Badge, Body, Button, Card, Empty, ErrorView, H2, Loading, Muted, Row, ScoreBar, Screen, Section, Stat, StatusBadge, Title,
} from '@/components/ui';
import { isAcademic, useUser } from '@/lib/auth';
import type { Challenge, ChallengeMatch, Page, Proposal, User } from '@/lib/types';

export default function Inicio() {
  const user = useUser();
  return (
    <>
      {isAcademic(user) ? <AcademicHome user={user} />
        : user.role === 'universidad' ? <UniversityDashboard user={user} />
        : user.role === 'admin' ? <AdminHome user={user} />
        : <PublisherHome user={user} />}
    </>
  );
}

const Hello = ({ user, text }: { user: User; text: string }) => (
  <>
    <Title>Hola, {user.full_name.split(' ')[0]}</Title>
    <Muted>{text}</Muted>
  </>
);

// ---------------------------------------------------------------- Estudiante / académico
function AcademicHome({ user }: { user: User }) {
  const recs = useApi<ChallengeMatch[]>('/recommendations/challenges');
  const mine = useApi<Proposal[]>('/proposals/mine');
  const refresh = () => { recs.refetch(); mine.refetch(); };
  const acceptedProposals = mine.data?.filter((p) => p.status === 'aceptada') ?? [];
  const pendingProposals = mine.data?.filter((p) => p.status === 'enviada') ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={recs.isRefetching}>
      <Hello user={user} text="Encuentra proyectos reales para aplicar tus habilidades en equipos multidisciplinarios." />

      <Button
        title="Explorar oportunidades y retos"
        icon="bulb-outline"
        onPress={() => router.push('/retos')}
        style={{ marginTop: 14, alignSelf: 'flex-start' }}
      />

      {!user.skills.length && (
        <Card style={{ marginTop: 12 }}>
          <Body>Agrega tus habilidades y carrera en tu perfil para recibir mejores recomendaciones de proyectos.</Body>
          <Button small title="Completar perfil" variant="secondary" onPress={() => router.push('/editar-perfil')}
            style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Card>
      )}

      {acceptedProposals.length > 0 && (
        <Section title="Mis proyectos activos" action={<Button small variant="ghost" title="Ver portafolio" onPress={() => router.push(`/usuario/${user.id}`)} />}>
          {acceptedProposals.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/reto/${p.challenge_id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2 style={{ flex: 1 }}>{p.challenge_title ?? `Proyecto #${p.challenge_id}`}</H2>
                <Badge text="Proyecto Activo" tone="success" icon="rocket-outline" />
              </Row>
              <Muted>Equipo {p.team?.name}</Muted>
              <Row gap={8} style={{ marginTop: 8 }}>
                <Button small title="Entregar hitos" icon="flag-outline" onPress={() => router.push(`/reto/${p.challenge_id}/hitos`)} />
                <Button small variant="secondary" title="Chat del equipo" icon="chatbubbles-outline" onPress={() => router.push(`/reto/${p.challenge_id}/chat`)} />
              </Row>
            </Card>
          ))}
        </Section>
      )}

      <Section title="Mis postulaciones enviadas" action={<Button small variant="ghost" title="Mi equipo" onPress={() => router.push('/equipos')} />}>
        {mine.isLoading ? <Loading /> : mine.error ? <ErrorView error={mine.error} onRetry={mine.refetch} /> :
          !pendingProposals.length ? <Muted>No tienes postulaciones en espera.</Muted> :
          pendingProposals.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/reto/${p.challenge_id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2 style={{ flex: 1 }}>{p.challenge_title ?? `Reto #${p.challenge_id}`}</H2>
                <StatusBadge status={p.status} />
              </Row>
              <Muted>Equipo {p.team?.name}</Muted>
              {!!p.feedback && <Muted style={{ marginTop: 4 }}>“{p.feedback}”</Muted>}
            </Card>
          ))}
      </Section>

      <Section title="Retos y proyectos compatibles recomendados">
        {recs.isLoading ? <Loading /> : recs.error ? <ErrorView error={recs.error} onRetry={recs.refetch} /> :
          !recs.data?.length ? <Empty text="No hay retos que coincidan con tu perfil todavía. Revisa el catálogo completo." icon="bulb-outline" /> :
          recs.data.map((m) => (
            <ChallengeCard key={m.challenge.id} ch={m.challenge}>
              <Card style={{ marginTop: 10, marginBottom: 0, backgroundColor: '#F8FAFC' }}>
                <Muted style={{ fontWeight: '700', marginBottom: 4 }}>Afinidad con tu perfil</Muted>
                <ScoreBar score={m.score} />
                {m.reasons.map((r) => <Muted key={r}>• {r}</Muted>)}
              </Card>
            </ChallengeCard>
          ))}
      </Section>
    </Screen>
  );
}

// ---------------------------------------------------------------- Empresa / gobierno
function PublisherHome({ user }: { user: User }) {
  const q = useApi<Page<Challenge>>('/challenges', { mine: true, size: 50 });
  const items = q.data?.items ?? [];
  const count = (s: string) => items.filter((c) => c.status === s).length;
  const inProgress = items.filter((c) => c.status === 'en_progreso');

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Hello user={user} text="¿Qué problema u oportunidad tecnológica necesitas resolver en tu organización?" />
      <Button title="Crear un reto" icon="add-circle-outline" onPress={() => router.push('/publicar')}
        style={{ marginTop: 14, alignSelf: 'flex-start' }} />

      <Row style={{ marginTop: 16 }} gap={10}>
        <Stat value={count('abierto')} text="Retos abiertos" icon="megaphone-outline" />
        <Stat value={count('en_progreso')} text="Proyectos activos" icon="construct-outline" />
        <Stat value={count('finalizado')} text="Completados" icon="checkmark-done-outline" />
        <Stat value={items.reduce((a, c) => a + c.proposals_count, 0)} text="Propuestas recibidas" icon="people-outline" />
      </Row>

      {inProgress.length > 0 && (
        <Section title="Proyectos en progreso activo">
          {inProgress.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/reto/${c.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2 style={{ flex: 1 }}>{c.title}</H2>
                <Badge text="En progreso" tone="success" icon="rocket-outline" />
              </Row>
              <Muted>{c.category}</Muted>
              <Row gap={8} style={{ marginTop: 8 }}>
                <Button small title="Revisar entregables" icon="flag-outline" onPress={() => router.push(`/reto/${c.id}/hitos`)} />
                <Button small variant="secondary" title="Chat con el equipo" icon="chatbubbles-outline" onPress={() => router.push(`/reto/${c.id}/chat`)} />
              </Row>
            </Card>
          ))}
        </Section>
      )}

      <Section title="Mis convocatorias y problemáticas">
        {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
          !items.length ? <Empty text="Todavía no publicas retos o problemáticas." /> :
          items.map((c) => <ChallengeCard key={c.id} ch={c} />)}
      </Section>
      {!!user.organization_id && <NearbyUniversities orgId={user.organization_id} />}
    </Screen>
  );
}

// ---------------------------------------------------------------- Admin
function AdminHome({ user }: { user: User }) {
  return (
    <Screen>
      <Hello user={user} text="Panel de control administrativo y auditoría de vinculación." />
      <Row style={{ marginTop: 16 }}>
        <Button title="Verificar organizaciones" icon="shield-checkmark-outline" onPress={() => router.push('/organizaciones')} />
        <Button title="Indicadores de impacto" variant="secondary" icon="stats-chart-outline" onPress={() => router.push('/indicadores')} />
      </Row>
    </Screen>
  );
}
