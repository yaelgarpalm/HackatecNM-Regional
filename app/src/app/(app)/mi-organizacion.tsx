import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';

import { useAction, useApi, useCatalogs } from '@/components/hooks';
import { OsmMap } from '@/components/OsmMap';
import { Badge, Button, Card, ChipSelect, Field, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { goBack, label } from '@/lib/format';
import type { MapMarker } from '@/lib/mapHtml';
import type { Organization } from '@/lib/types';

export default function MiOrganizacionPage() {
  const user = useUser();
  const q = useApi<Organization>(`/organizations/${user.organization_id}`);
  if (!q.data) return <Loading />;
  return <OrgForm org={q.data} />;
}

function OrgForm({ org }: { org: Organization }) {
  const { data: cat } = useCatalogs();
  const [f, setF] = useState({
    name: org.name, size: org.size, sector: org.sector ?? '', description: org.description ?? '',
    city: org.city ?? '', state: org.state ?? '', website: org.website ?? '',
  });
  const set = (k: keyof typeof f) => (v: any) => setF({ ...f, [k]: v });
  const save = useAction(() => api.patch(`/organizations/${org.id}`, f), {
    successMessage: 'Datos de la organización actualizados', onSuccess: () => goBack('/perfil'),
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mi organización' }} />
      <Row gap={6} style={{ marginBottom: 10 }}>
        <Badge text={label(org.type)} tone="primary" />
        {org.verified ? <Badge text="Verificada" tone="success" icon="shield-checkmark" /> : <Badge text="Pendiente de verificación" tone="warning" />}
      </Row>
      <Card>
        <Field label="Nombre" value={f.name} onChangeText={set('name')} />
        {org.type === 'empresa' && (
          <ChipSelect label="Tamaño" options={cat?.tamanos_organizacion ?? []} value={f.size} onChange={set('size')} />
        )}
        <Field label="Sector / giro" value={f.sector} onChangeText={set('sector')} />
        <Field label="Descripción" value={f.description} onChangeText={set('description')} multiline />
        <Field label="Ciudad" value={f.city} onChangeText={set('city')} />
        <Field label="Estado" value={f.state} onChangeText={set('state')} />
        <Field label="Sitio web" value={f.website} onChangeText={set('website')} autoCapitalize="none" />
        <Button title="Guardar" icon="save-outline" loading={save.isPending} onPress={() => save.mutate(undefined)} />
      </Card>

      <Location org={org} />
    </Screen>
  );
}

/** Ubicación de la organización en el mapa: por su ciudad (OpenStreetMap) o tocando el mapa. */
function Location({ org }: { org: Organization }) {
  const [current, setCurrent] = useState(
    org.latitude != null && org.longitude != null ? { lat: org.latitude, lng: org.longitude } : null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  const locate = useAction(() => api.post<Organization>(`/organizations/${org.id}/geocode`), {
    successMessage: 'Ubicación encontrada', successDetail: 'Te ubicamos por tu ciudad. Si no es exacta, toca el mapa.',
    onSuccess: (o) => { setCurrent({ lat: o.latitude!, lng: o.longitude! }); setPicked(null); },
  });
  const savePin = useAction((p: { lat: number; lng: number }) =>
    api.patch<Organization>(`/organizations/${org.id}`, { latitude: p.lat, longitude: p.lng }), {
    successMessage: 'Ubicación guardada', successDetail: 'Ya apareces en el mapa de VinculaTec.',
    onSuccess: (o) => { setCurrent({ lat: o.latitude!, lng: o.longitude! }); setPicked(null); },
  });

  const markers = useMemo<MapMarker[]>(
    () => (current ? [{ id: 'home', kind: 'home', ...current, title: org.name, subtitle: 'Ubicación guardada' }] : []),
    [current, org.name]);

  return (
    <Section title="Ubicación en el mapa">
      <Card>
        <Muted style={{ marginBottom: 10 }}>
          {current ? 'Así te ven las demás organizaciones en el mapa. Toca el mapa si quieres corregirla.'
            : 'Aún no tienes ubicación. Te ubicamos por tu ciudad o toca el mapa en el lugar exacto.'}
        </Muted>
        <OsmMap markers={markers} center={current ?? undefined} pickable height={300}
          onPick={(lat, lng) => setPicked({ lat, lng })} />
        <Row style={{ marginTop: 10 }}>
          {picked && (
            <Button title="Guardar esta ubicación" icon="location" loading={savePin.isPending} onPress={() => savePin.mutate(picked)} />
          )}
          <Button title="Ubicar por mi ciudad" variant="secondary" icon="navigate-outline" loading={locate.isPending}
            onPress={() => locate.mutate(undefined)} />
        </Row>
        {picked && <Muted style={{ marginTop: 6 }}>Punto elegido: {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}</Muted>}
      </Card>
    </Section>
  );
}
