import { Stack } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi, useCatalogs } from '@/components/hooks';
import { Badge, Button, Card, ChipSelect, Field, Loading, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { goBack, label } from '@/lib/format';
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
    successMessage: 'Datos actualizados', onSuccess: () => goBack('/perfil'),
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
    </Screen>
  );
}
