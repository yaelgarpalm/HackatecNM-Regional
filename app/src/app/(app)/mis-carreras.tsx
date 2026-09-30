import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Combobox } from '@/components/Combobox';
import { useAction, useApi, useCatalogs } from '@/components/hooks';
import { colors, radius } from '@/components/theme';
import { Badge, Button, Card, confirm, Empty, ErrorView, H2, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';

type Career = { id: number; name: string; universities: number };
type LinkResult = { career: Career; created: boolean; already_linked: boolean };

export default function MisCarreras() {
  const user = useUser();
  const orgId = user.organization_id;
  const q = useApi<Career[]>(orgId ? `/organizations/${orgId}/careers` : null);
  const catalogo = useCatalogs().data?.carreras ?? [];
  const [name, setName] = useState('');

  const mine = new Set((q.data ?? []).map((c) => c.name));
  const typed = name.trim();
  // El backend dice si ya existe (entiende sinónimos: "contador público" = "Licenciatura en Contaduría")
  const preview = useApi<{ exists: boolean; name: string }>(typed.length >= 3 ? '/careers/resolve' : null, { name: typed });
  const existing = preview.data?.exists ? preview.data.name : undefined;

  const add = useAction((n: string) => api.post<LinkResult>(`/organizations/${orgId}/careers`, { name: n }), {
    successMessage: (_n, r) => r.already_linked ? 'Ya la tenías registrada' : r.created ? '¡Carrera creada!' : 'Carrera agregada',
    successDetail: (_n, r) => r.already_linked ? r.career.name
      : r.created ? `"${r.career.name}" ya está disponible para toda la plataforma.`
      : `"${r.career.name}" ya forma parte de tu oferta.`,
    onSuccess: () => setName(''),
  });
  const remove = useAction((c: Career) => api.del(`/organizations/${orgId}/careers/${c.id}`), {
    successMessage: 'Carrera quitada de tu oferta',
  });

  if (!orgId) return <Screen><ErrorView error={new Error('Tu cuenta no está vinculada a una institución')} /></Screen>;

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'Carreras que ofrecemos' }} />
      <Muted>
        Registra las carreras de tu institución. Si otra universidad ya dio de alta la carrera, solo selecciónala;
        si no existe, escríbela y se creará para toda la plataforma.
      </Muted>

      <Section title="Agregar carrera">
        <Card>
          <Combobox label="Carrera" value={name} onChange={setName} allowCustom
            options={catalogo.filter((c) => !mine.has(c))} placeholder="Escribe o busca, p. ej. contaduría" />

          {/* Aviso de qué va a pasar antes de guardar */}
          {typed.length >= 3 && !!preview.data && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, marginBottom: 12,
              backgroundColor: mine.has(existing ?? typed) ? colors.warningSoft : existing ? colors.primarySoft : colors.successSoft }}>
              <Ionicons size={18}
                name={mine.has(existing ?? typed) ? 'information-circle' : existing ? 'link-outline' : 'sparkles-outline'}
                color={mine.has(existing ?? typed) ? colors.warning : existing ? colors.primary : colors.success} />
              <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>
                {mine.has(existing ?? typed) ? 'Esta carrera ya está en tu oferta.'
                  : existing ? `Ya existe en VinculaTec: se agregará "${existing}" a tu oferta.`
                  : `Carrera nueva: se creará "${typed}" y quedará disponible para estudiantes, empresas y otras universidades.`}
              </Text>
            </View>
          )}

          <Button title={existing || !typed ? 'Agregar a mi oferta' : 'Crear y agregar'} icon="add-circle-outline"
            disabled={typed.length < 3 || mine.has(existing ?? typed)} loading={add.isPending}
            onPress={() => add.mutate(existing ?? typed)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      </Section>

      <Section title={`Nuestra oferta educativa${q.data ? ` (${q.data.length})` : ''}`}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
          !q.data?.length ? <Empty text="Aún no registras carreras. Agrega la primera arriba." icon="school-outline" /> :
          q.data.map((c) => (
            <Card key={c.id}>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <View style={{ flex: 1 }}>
                  <H2>{c.name}</H2>
                  <Row gap={6} style={{ marginTop: 6 }}>
                    <Badge icon="business-outline" tone={c.universities > 1 ? 'primary' : 'neutral'}
                      text={c.universities > 1 ? `También la ofrecen ${c.universities - 1} institución(es) más` : 'Solo tu institución la ofrece'} />
                  </Row>
                </View>
                <Button small variant="ghost" title="Quitar" icon="trash-outline" loading={remove.isPending}
                  onPress={async () => {
                    if (await confirm(`¿Quitar "${c.name}" de tu oferta?`,
                      'La carrera seguirá existiendo en VinculaTec; solo dejará de aparecer como parte de tu institución.',
                      { confirmText: 'Quitar', danger: true })) remove.mutate(c);
                  }} />
              </Row>
            </Card>
          ))}
      </Section>
    </Screen>
  );
}
