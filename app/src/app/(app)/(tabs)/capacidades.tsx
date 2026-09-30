import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useApi, useCatalogs } from '@/components/hooks';
import {
  Badge, Body, Button, Card, ChipSelect, Empty, ErrorView, Field, H2, Loading, Muted, Row, Screen, Tags,
} from '@/components/ui';
import { useUser } from '@/lib/auth';
import { label } from '@/lib/format';
import type { Capability, Organization, Page } from '@/lib/types';

const ICON: Record<string, any> = { laboratorio: 'flask-outline', equipo: 'hardware-chip-outline', experto: 'person-outline', servicio: 'construct-outline' };

export default function Capacidades() {
  const user = useUser();
  const { data: cat } = useCatalogs();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  // Desde el mapa de la empresa: ver solo las capacidades de una universidad
  const params = useLocalSearchParams<{ org?: string }>();
  const orgFilter = params.org ? Number(params.org) : null;

  const canManage = (user.role === 'universidad' || user.role === 'academico' || user.role === 'admin') && !!user.organization_id;
  const r = useApi<Page<Capability>>('/capabilities', {
    q: search, type, size: 100, organization_id: onlyMine ? user.organization_id : orgFilter ?? undefined, available: onlyMine ? undefined : true,
  });
  const orgs = useApi<Page<Organization>>('/organizations', { type: 'universidad', size: 100 });
  const orgName = (id: number) => orgs.data?.items.find((o) => o.id === id)?.name ?? '';

  return (
    <Screen onRefresh={r.refetch} refreshing={r.isRefetching}>
      <Muted>Laboratorios, equipo especializado, expertos y servicios que ofrecen las universidades.</Muted>
      {canManage && (
        <Row style={{ marginTop: 10 }}>
          <Button small title="Publicar capacidad" icon="add" onPress={() => router.push('/capacidad')} />
          {user.role === 'universidad' && (
            <Button small variant="secondary" title="Subir carreras" icon="school-outline" onPress={() => router.push('/mis-carreras')} />
          )}
          <Button small variant={onlyMine ? 'primary' : 'secondary'} title="Solo de mi institución" onPress={() => setOnlyMine(!onlyMine)} />
        </Row>
      )}
      {!!orgFilter && !onlyMine && (
        <Row style={{ marginTop: 10 }} gap={6}>
          <Badge text={`De: ${orgName(orgFilter) || 'universidad seleccionada'}`} tone="primary" icon="school-outline" />
          <Button small variant="ghost" title="Ver todas" icon="close" onPress={() => router.setParams({ org: undefined })} />
        </Row>
      )}
      <Field label="Buscar" value={q} onChangeText={setQ} placeholder="sensores, impresión 3D, diseño…"
        onSubmitEditing={() => setSearch(q)} returnKeyType="search" style={{ marginTop: 10 }} />
      <Button small title="Buscar" icon="search" onPress={() => setSearch(q)} style={{ alignSelf: 'flex-start', marginBottom: 10, marginTop: -4 }} />
      <ChipSelect label="Tipo" options={cat?.tipos_capacidad ?? []} value={type} onChange={setType} />

      {r.isLoading ? <Loading /> : r.error ? <ErrorView error={r.error} onRetry={r.refetch} /> :
        !r.data?.items.length ? <Empty text="Sin resultados." icon="flask-outline" /> :
        r.data.items.map((c) => {
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
    </Screen>
  );
}
