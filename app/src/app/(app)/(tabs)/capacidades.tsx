import { router } from 'expo-router';
import { useState } from 'react';

import { useApi, useCatalogs, useDebounced } from '@/components/hooks';
import {
  Badge, Body, Button, Card, ChipSelect, Empty, ErrorView, H2, Loading, Muted, Row, Screen, SearchBar, Tags,
} from '@/components/ui';
import { useUser } from '@/lib/auth';
import { label, plural } from '@/lib/format';
import type { Capability, Organization, Page } from '@/lib/types';

const ICON: Record<string, any> = { laboratorio: 'flask-outline', equipo: 'hardware-chip-outline', experto: 'person-outline', servicio: 'construct-outline' };

export default function Capacidades() {
  const user = useUser();
  const { data: cat } = useCatalogs();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const [type, setType] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const canManage = (user.role === 'universidad' || user.role === 'academico' || user.role === 'admin') && !!user.organization_id;
  const r = useApi<Page<Capability>>('/capabilities', {
    q: search, type, size: 100, organization_id: onlyMine ? user.organization_id : undefined, available: onlyMine ? undefined : true,
  });
  const orgs = useApi<Page<Organization>>('/organizations', { type: 'universidad', size: 100 });
  const orgName = (id: number) => orgs.data?.items.find((o) => o.id === id)?.name ?? '';

  return (
    <Screen onRefresh={r.refetch} refreshing={r.isRefetching}>
      <Muted style={{ marginBottom: 10 }}>Laboratorios, equipo especializado, expertos y servicios que ofrecen las universidades.</Muted>
      {canManage && (
        <Row style={{ marginBottom: 12 }}>
          <Button small title="Publicar capacidad" icon="add" onPress={() => router.push('/capacidad')} />
          {user.role === 'universidad' && (
            <Button small variant="secondary" title="Subir carreras" icon="school-outline" onPress={() => router.push('/mis-carreras')} />
          )}
        </Row>
      )}
      <SearchBar value={q} onChangeText={setQ} placeholder="Buscar: sensores, impresión 3D, diseño…" label="Buscar capacidades" />
      <ChipSelect options={cat?.tipos_capacidad ?? []} value={type} onChange={setType} />
      {canManage && (
        <ChipSelect options={['todas', 'mi_institucion'] as const} value={onlyMine ? 'mi_institucion' : 'todas'}
          onChange={(v) => setOnlyMine(v === 'mi_institucion')} />
      )}

      {r.isLoading ? <Loading /> : r.error ? <ErrorView error={r.error} onRetry={r.refetch} /> :
        !r.data?.items.length ? (
          <Empty icon="flask-outline"
            text={search || type ? 'Nada coincide con tu búsqueda. Prueba otras palabras o quita el tipo.' : 'Todavía no hay capacidades publicadas.'}
            actionTitle={search || type ? 'Quitar búsqueda y filtros' : undefined}
            onAction={() => { setQ(''); setType(null); }} />
        ) : (
        <>
        <Muted style={{ marginBottom: 8 }}>{plural(r.data.total, 'resultado')}</Muted>
        {r.data.items.map((c) => {
          const mine = canManage && c.organization_id === user.organization_id;
          return (
            <Card key={c.id} onPress={mine ? () => router.push({ pathname: '/capacidad', params: { id: c.id } }) : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>{c.name}</H2>
                <Row gap={6}>
                  <Badge text={label(c.type)} tone="primary" icon={ICON[c.type]} />
                  {!c.available && <Badge text="No disponible" tone="danger" />}
                </Row>
              </Row>
              <Muted>{orgName(c.organization_id)}</Muted>
              {!!c.description && <Body style={{ marginTop: 6 }}>{c.description}</Body>}
              <Tags items={c.tags} tone="neutral" />
              {mine && <Muted style={{ marginTop: 6 }}>Toca para editar</Muted>}
            </Card>
          );
        })}
        </>
        )}
    </Screen>
  );
}
