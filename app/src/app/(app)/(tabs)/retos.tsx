import { router } from 'expo-router';
import { useState } from 'react';

import { ChallengeCard } from '@/components/ChallengeCard';
import { useApi, useCatalogs, useDebounced } from '@/components/hooks';
import { colors } from '@/components/theme';
import {
  Button, Card, ChipSelect, Empty, ErrorView, Field, Filters, Loading, Muted, Row, Screen, SearchBar, Switch,
} from '@/components/ui';
import { isOrgPublisher, useUser } from '@/lib/auth';
import { plural } from '@/lib/format';
import type { Challenge, Page } from '@/lib/types';

export default function Retos() {
  const user = useUser();
  const publisher = isOrgPublisher(user);
  const { data: cat } = useCatalogs();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>('abierto');
  const [modality, setModality] = useState<string | null>(null);
  const [state, setState] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);

  // Busca mientras se escribe; cualquier cambio de filtro regresa a la página 1.
  const search = useDebounced(q.trim());
  const stateQ = useDebounced(state.trim());
  const r = useApi<Page<Challenge>>('/challenges', {
    q: search, status, modality, state: stateQ, mine: mine || undefined, page, size: 20,
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const statuses = (cat?.estados_reto ?? []).filter((s) => mine || s !== 'borrador');
  const active = [status !== 'abierto', !!modality, !!state.trim(), mine].filter(Boolean).length;
  const clearFilters = () => { setStatus('abierto'); setModality(null); setState(''); setMine(false); setPage(1); };
  const pages = r.data?.pages ?? 0;

  return (
    <Screen onRefresh={r.refetch} refreshing={r.isRefetching}>
      {publisher && (
        <Button title="Publicar problemática" icon="add-circle-outline" onPress={() => router.push('/publicar')}
          style={{ marginBottom: 12 }} />
      )}

      {user.role === 'estudiante' && !user.career && (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Muted>Registra tu carrera para ver las problemáticas que buscan estudiantes como tú.</Muted>
          <Button small variant="secondary" title="Completar perfil" onPress={() => router.push('/editar-perfil')}
            style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Card>
      )}

      <SearchBar value={q} onChangeText={reset(setQ)} placeholder="Buscar: IoT, comercio electrónico, agua…"
        label="Buscar problemáticas" />

      <Filters active={active} onClear={clearFilters}>
        {publisher && (
          <Switch label="Solo mis problemáticas" value={mine}
            onChange={(v) => { setMine(v); setStatus(v ? null : 'abierto'); setPage(1); }} />
        )}
        <ChipSelect label="Estado" options={statuses} value={status} onChange={reset(setStatus)} />
        <ChipSelect label="Válido como" options={cat?.modalidades ?? []} value={modality} onChange={reset(setModality)} />
        <Field label="Estado de la República" value={state} onChangeText={reset(setState)} placeholder="Estado de México" />
      </Filters>

      {r.isLoading ? <Loading /> : r.error ? <ErrorView error={r.error} onRetry={r.refetch} /> : (
        <>
          <Muted style={{ marginBottom: 8 }}>
            {plural(r.data?.total ?? 0, 'problemática')}
            {user.role === 'estudiante' && user.career ? ` para ${user.career} o cualquier carrera` : ''}
          </Muted>
          {!r.data?.items.length ? (
            <Empty
              text={search || active ? 'Nada coincide con tu búsqueda. Prueba otras palabras o quita filtros.' : 'Todavía no hay problemáticas publicadas.'}
              icon="search-outline"
              actionTitle={search || active ? 'Quitar búsqueda y filtros' : undefined}
              onAction={() => { setQ(''); clearFilters(); }}
            />
          ) : r.data.items.map((c) => <ChallengeCard key={c.id} ch={c} />)}
          {pages > 1 && (
            <Row style={{ justifyContent: 'center', marginTop: 8 }}>
              <Button small variant="secondary" icon="chevron-back" title="Anterior" disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Muted>Página {page} de {pages}</Muted>
              <Button small variant="secondary" title="Siguiente" disabled={page >= pages} onPress={() => setPage(page + 1)} />
            </Row>
          )}
        </>
      )}
    </Screen>
  );
}
