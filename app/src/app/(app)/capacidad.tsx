import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi, useCatalogs } from '@/components/hooks';
import { Button, Card, ChipSelect, confirm, Field, Loading, Row, Screen, Switch } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { goBack, splitList } from '@/lib/format';
import type { Capability } from '@/lib/types';

/** Carga la capacidad (si se edita) y luego monta el formulario con sus valores iniciales. */
export default function CapacidadPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useApi<Capability>(id ? `/capabilities/${id}` : null);
  if (id && !existing.data) return <Loading />;
  return <CapacidadForm id={id} initial={existing.data} />;
}

function CapacidadForm({ id, initial }: { id?: string; initial?: Capability }) {
  const user = useUser();
  const { data: cat } = useCatalogs();
  const [f, setF] = useState({
    type: initial?.type ?? 'laboratorio',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    tags: initial?.tags.join(', ') ?? '',
    available: initial?.available ?? true,
  });

  const body = () => ({ ...f, tags: splitList(f.tags), contact_user_id: user.id });
  const save = useAction(
    () => (id ? api.put(`/capabilities/${id}`, body()) : api.post(`/organizations/${user.organization_id}/capabilities`, body())),
    { onSuccess: () => goBack('/capacidades') },
  );
  const remove = useAction(() => api.del(`/capabilities/${id}`), { onSuccess: () => goBack('/capacidades') });

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar capacidad' : 'Publicar capacidad' }} />
      <Card>
        <ChipSelect label="Tipo" options={cat?.tipos_capacidad ?? []} value={f.type} onChange={(v) => v && setF({ ...f, type: v })} />
        <Field label="Nombre" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Laboratorio de IoT" />
        <Field label="Descripción" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline
          placeholder="Equipo disponible, horarios, condiciones de uso…" />
        <Field label="Etiquetas" value={f.tags} onChangeText={(v) => setF({ ...f, tags: v })} placeholder="IoT, sensores, automatización"
          hint="Separadas por comas. Se usan para sugerir esta capacidad a las empresas." />
        <Switch label="Disponible actualmente" value={f.available} onChange={(v) => setF({ ...f, available: v })} />
        <Row>
          <Button title="Guardar" icon="save-outline" loading={save.isPending} disabled={f.name.trim().length < 2} onPress={() => save.mutate(undefined)} />
          {id && (
            <Button title="Eliminar" variant="danger" icon="trash-outline"
              onPress={async () => { if (await confirm('¿Eliminar esta capacidad?', 'Dejará de aparecer en las sugerencias para las empresas.', { confirmText: 'Eliminar', danger: true, icon: 'trash-outline' })) remove.mutate(undefined); }} />
          )}
        </Row>
      </Card>
    </Screen>
  );
}
