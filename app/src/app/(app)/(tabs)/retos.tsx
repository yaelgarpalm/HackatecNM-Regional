import { router } from 'expo-router';
import { useState } from 'react';

import { ChallengeCard } from '@/components/ChallengeCard';
import { useApi, useCatalogs } from '@/components/hooks';
import { colors } from '@/components/theme';
import { Button, Card, ChipSelect, Empty, ErrorView, Field, Loading, Muted, Row, Screen } from '@/components/ui';
import { isOrgPublisher, useUser } from '@/lib/auth';
import type { Challenge, Page } from '@/lib/types';

export default function Retos() {
  const user = useUser();
  const { data: cat } = useCatalogs();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  // Por defecto todas (abiertas, en progreso, finalizadas…); los chips filtran por estado
  const [status, setStatus] = useState<string | null>(null);
  const [modality, setModality] = useState<string | null>(null);
  const [state, setState] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);

  const query = {
    q: search, status, modality, state, mine: mine || undefined, page, size: 20,
  };
  const r = useApi<Page<Challenge>>('/challenges', query);

  const statuses = (cat?.estados_reto ?? []).filter((s) => mine || s !== 'borrador');

  return (
    <Screen onRefresh={r.refetch} refreshing={r.isRefetching}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Muted>Problemáticas reales publicadas por empresas y gobierno</Muted>
        {isOrgPublisher(user) && (
          <Button small title="Publicar problemática" icon="add" onPress={() => router.push('/publicar')} />
        )}
      </Row>

      {user.role === 'estudiante' && (
        <Card style={{ backgroundColor: colors.primarySoft }}>
          {user.career ? (
            <Muted>Ves las problemáticas que piden tu carrera ({user.career}) o que aceptan cualquier carrera.</Muted>
          ) : (
            <>
              <Muted>Registra tu carrera para ver las problemáticas que buscan estudiantes como tú.</Muted>
              <Button small variant="secondary" title="Completar perfil" onPress={() => router.push('/editar-perfil')}
                style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            </>
          )}
        </Card>
      )}

      <Field label="Buscar" value={q} onChangeText={setQ} placeholder="IoT, comercio electrónico, agua…"
        returnKeyType="search" onSubmitEditing={() => { setSearch(q); setPage(1); }} />
      <Row gap={8} style={{ marginTop: -4, marginBottom: 8 }}>
        <Button small title="Buscar" icon="search" onPress={() => { setSearch(q); setPage(1); }} />
        {isOrgPublisher(user) && (
          <Button small variant={mine ? 'primary' : 'secondary'} title="Solo mis problemáticas"
            onPress={() => { setMine(!mine); setStatus(null); setPage(1); }} />
        )}
      </Row>

      <ChipSelect label="Estado" options={statuses} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <ChipSelect label="Válido como" options={cat?.modalidades ?? []} value={modality} onChange={(v) => { setModality(v); setPage(1); }} />
      <Field label="Estado de la República" value={state} onChangeText={(v) => { setState(v); setPage(1); }} placeholder="Estado de México" />

      {r.isLoading ? <Loading /> : r.error ? <ErrorView error={r.error} onRetry={r.refetch} /> : (
        <>
          <Muted style={{ marginBottom: 8 }}>{r.data?.total ?? 0} resultado(s)</Muted>
          {!r.data?.items.length ? <Empty text="No hay problemáticas con esos filtros." icon="search-outline" /> :
            r.data.items.map((c) => <ChallengeCard key={c.id} ch={c} />)}
          {(r.data?.pages ?? 0) > 1 && (
            <Row style={{ justifyContent: 'center', marginTop: 8 }}>
              <Button small variant="secondary" title="Anterior" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Muted>Página {page} de {r.data?.pages}</Muted>
              <Button small variant="secondary" title="Siguiente" disabled={page >= (r.data?.pages ?? 1)} onPress={() => setPage(page + 1)} />
            </Row>
          )}
        </>
      )}
    </Screen>
  );
}
