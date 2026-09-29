import { Stack } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi, useCatalogs } from '@/components/hooks';
import { Badge, Body, Button, Card, ChipSelect, Empty, ErrorView, Field, H2, Loading, Muted, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { label } from '@/lib/format';
import type { Organization, Page } from '@/lib/types';

export default function Organizaciones() {
  const user = useUser();
  const admin = user.role === 'admin';
  const { data: cat } = useCatalogs();
  const [type, setType] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(admin);
  const r = useApi<Page<Organization>>('/organizations', { type, q, size: 100, verified: pending ? false : undefined });
  const verify = useAction((id: number) => api.post(`/organizations/${id}/verify`));

  return (
    <Screen onRefresh={r.refetch} refreshing={r.isRefetching}>
      <Stack.Screen options={{ title: admin ? 'Verificar organizaciones' : 'Organizaciones' }} />
      <Field label="Buscar por nombre o sector" value={q} onChangeText={setQ} />
      <ChipSelect label="Tipo" options={cat?.tipos_organizacion ?? []} value={type} onChange={setType} />
      <Button small variant={pending ? 'primary' : 'secondary'} title="Solo sin verificar" onPress={() => setPending(!pending)}
        style={{ alignSelf: 'flex-start', marginBottom: 12 }} />

      {r.isLoading ? <Loading /> : r.error ? <ErrorView error={r.error} /> :
        !r.data?.items.length ? <Empty text="Sin resultados." icon="business-outline" /> :
        r.data.items.map((o) => (
          <Card key={o.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{o.name}</H2>
              <Row gap={6}>
                <Badge text={label(o.type)} tone="primary" />
                {o.verified ? <Badge text="Verificada" tone="success" icon="shield-checkmark" /> : <Badge text="Sin verificar" tone="warning" />}
              </Row>
            </Row>
            <Muted>{[label(o.size), o.sector, o.city, o.state].filter(Boolean).join(' · ')}</Muted>
            {o.description && <Body style={{ marginTop: 4 }}>{o.description}</Body>}
            {admin && !o.verified && (
              <Button small variant="success" title="Verificar" icon="shield-checkmark-outline" loading={verify.isPending}
                onPress={() => verify.mutate(o.id)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            )}
          </Card>
        ))}
    </Screen>
  );
}
