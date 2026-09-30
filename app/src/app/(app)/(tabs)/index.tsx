import { router } from 'expo-router';

import { ChallengeCard } from '@/components/ChallengeCard';
import { UniversityDashboard } from '@/components/UniversityDashboard';
import { useApi } from '@/components/hooks';
import {
  Body, Button, Card, Empty, ErrorView, H2, Loading, Muted, Row, ScoreBar, Screen, Section, Stat, StatusBadge, Title,
} from '@/components/ui';
import { isAcademic, useUser } from '@/lib/auth';
import { label } from '@/lib/format';
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

  return (
    <Screen onRefresh={refresh} refreshing={recs.isRefetching}>
      <Hello user={user} text={`${label(user.role)} · ${user.career ?? 'Completa tu carrera en el perfil'}`} />

      {!user.skills.length && (
        <Card style={{ marginTop: 12 }}>
          <Body>Agrega tus habilidades en tu perfil para recibir mejores recomendaciones.</Body>
          <Button small title="Completar perfil" variant="secondary" onPress={() => router.push('/editar-perfil')}
            style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Card>
      )}

      <Section title="Mis postulaciones" action={<Button small variant="ghost" title="Mis equipos" onPress={() => router.push('/equipos')} />}>
        {mine.isLoading ? <Loading /> : mine.error ? <ErrorView error={mine.error} onRetry={mine.refetch} /> :
          !mine.data?.length ? <Muted>Aún no te postulas a ninguna problemática.</Muted> :
          mine.data.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/reto/${p.challenge_id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2 style={{ flex: 1 }}>{p.challenge_title ?? `Problemática #${p.challenge_id}`}</H2>
                <StatusBadge status={p.status} />
              </Row>
              <Muted>Equipo {p.team?.name}</Muted>
              {!!p.feedback && <Muted style={{ marginTop: 4 }}>“{p.feedback}”</Muted>}
            </Card>
          ))}
      </Section>

      <Section title="Problemáticas recomendadas para ti">
        {recs.isLoading ? <Loading /> : recs.error ? <ErrorView error={recs.error} onRetry={recs.refetch} /> :
          !recs.data?.length ? <Empty text="No hay problemáticas que coincidan con tu perfil todavía. Revisa el tablero completo." icon="bulb-outline" /> :
          recs.data.map((m) => (
            <ChallengeCard key={m.challenge.id} ch={m.challenge}>
              <Card style={{ marginTop: 10, marginBottom: 0, backgroundColor: '#F8FAFC' }}>
                <Muted style={{ fontWeight: '700', marginBottom: 4 }}>Afinidad contigo</Muted>
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

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Hello user={user} text="Publica los problemas de tu organización y recibe propuestas de equipos universitarios." />
      <Button title="Publicar una problemática" icon="add-circle-outline" onPress={() => router.push('/publicar')}
        style={{ marginTop: 14, alignSelf: 'flex-start' }} />

      <Row style={{ marginTop: 16 }} gap={10}>
        <Stat value={count('abierto')} text="Abiertas" icon="megaphone-outline" />
        <Stat value={count('en_progreso')} text="En progreso" icon="construct-outline" />
        <Stat value={count('finalizado')} text="Finalizadas" icon="checkmark-done-outline" />
        <Stat value={items.reduce((a, c) => a + c.proposals_count, 0)} text="Postulaciones" icon="people-outline" />
      </Row>

      <Section title="Mis problemáticas">
        {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
          !items.length ? <Empty text="Todavía no publicas problemáticas." /> :
          items.map((c) => <ChallengeCard key={c.id} ch={c} />)}
      </Section>
    </Screen>
  );
}

// ---------------------------------------------------------------- Admin
function AdminHome({ user }: { user: User }) {
  return (
    <Screen>
      <Hello user={user} text="Administración de la plataforma." />
      <Row style={{ marginTop: 16 }}>
        <Button title="Verificar organizaciones" icon="shield-checkmark-outline" onPress={() => router.push('/organizaciones')} />
        <Button title="Indicadores" variant="secondary" icon="stats-chart-outline" onPress={() => router.push('/indicadores')} />
      </Row>
    </Screen>
  );
}
