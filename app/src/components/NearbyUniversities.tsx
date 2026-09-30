import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useApi } from '@/components/hooks';
import { OsmMap } from '@/components/OsmMap';
import { colors, radius } from '@/components/theme';
import { Badge, Button, Card, Empty, ErrorView, H2, Loading, Muted, Row, Section } from '@/components/ui';
import type { MapMarker } from '@/lib/mapHtml';
import type { NearbyOrganization, Organization } from '@/lib/types';

const RADIOS = [25, 50, 100, 250] as const;

/** Mapa (OpenStreetMap) y lista de universidades cercanas a la organización del usuario. */
export function NearbyUniversities({ orgId }: { orgId: number }) {
  const org = useApi<Organization>(`/organizations/${orgId}`);
  const located = org.data?.latitude != null && org.data?.longitude != null;
  const [radiusKm, setRadiusKm] = useState<number>(100);
  const [selected, setSelected] = useState<number | null>(null);
  const q = useApi<NearbyOrganization[]>(located ? '/organizations/nearby' : null, { radius_km: radiusKm });

  const home = org.data;
  const center = useMemo(() => (located ? { lat: home!.latitude!, lng: home!.longitude! } : undefined), [located, home]);
  const markers = useMemo<MapMarker[]>(() => {
    if (!home || !center) return [];
    return [
      { id: 'home', kind: 'home', ...center, title: home.name, subtitle: 'Tu organización' },
      ...(q.data ?? []).map((u) => ({
        id: String(u.id), kind: 'uni' as const, lat: u.latitude!, lng: u.longitude!, title: u.name,
        subtitle: `${u.distance_km} km · ${[u.city, u.state].filter(Boolean).join(', ')}`,
      })),
    ];
  }, [home, center, q.data]);

  if (org.isLoading) return <Loading />;
  if (org.error) return <ErrorView error={org.error} onRetry={org.refetch} />;

  return (
    <Section title="Universidades cerca de ti">
      {!located ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Row gap={10} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Ionicons name="location-outline" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <H2>Ubica tu organización en el mapa</H2>
              <Muted style={{ marginTop: 4 }}>
                Así verás qué universidades, laboratorios y talento tienes cerca para resolver tus problemáticas.
              </Muted>
              <Button small title="Poner mi ubicación" icon="map-outline" onPress={() => router.push('/mi-organizacion')}
                style={{ alignSelf: 'flex-start', marginTop: 10 }} />
            </View>
          </Row>
        </Card>
      ) : (
        <>
          <Row gap={6} style={{ marginBottom: 10 }}>
            <Muted style={{ fontWeight: '700' }}>Distancia:</Muted>
            {RADIOS.map((r) => {
              const on = radiusKm === r;
              return (
                <Pressable key={r} onPress={() => { setRadiusKm(r); setSelected(null); }}
                  style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1,
                    borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : colors.text }}>{r} km</Text>
                </Pressable>
              );
            })}
          </Row>

          <OsmMap markers={markers} center={center} radiusKm={radiusKm} height={340}
            onSelect={(id) => id !== 'home' && setSelected(Number(id))} />
          <Row gap={14} style={{ marginTop: 8, marginBottom: 12 }}>
            <Row gap={6}><Text style={{ color: colors.primary, fontSize: 15 }}>★</Text><Muted>Tu organización</Muted></Row>
            <Row gap={6}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#eb6834' }} /><Muted>Universidad</Muted></Row>
          </Row>

          {q.isLoading ? <Loading /> : q.error ? <ErrorView error={q.error} onRetry={q.refetch} /> :
            !q.data?.length ? (
              <Empty icon="school-outline"
                text={`No hay universidades ubicadas a menos de ${radiusKm} km. Prueba con una distancia mayor.`} />
            ) : q.data.map((u, i) => (
              <Pressable key={u.id} onPress={() => setSelected(u.id)}
                style={({ hovered }: any) => ({
                  backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 1,
                  borderColor: selected === u.id ? colors.primary : hovered ? colors.primary : colors.border,
                })}>
                <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Row gap={6}>
                      {i === 0 && <Badge text="La más cercana" tone="success" icon="navigate" />}
                      {u.verified && <Badge text="Verificada" tone="primary" icon="shield-checkmark" />}
                    </Row>
                    <H2 style={{ marginTop: 4 }}>{u.name}</H2>
                    <Muted>{[u.city, u.state].filter(Boolean).join(', ')}</Muted>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{u.distance_km}</Text>
                    <Muted>km</Muted>
                  </View>
                </Row>
                <Row gap={6} style={{ marginTop: 8 }}>
                  <Badge icon="flask-outline" text={`${u.capabilities} capacidad(es)`} tone={u.capabilities ? 'primary' : 'neutral'} />
                  {u.careers.slice(0, 3).map((c) => <Badge key={c} icon="school-outline" text={c} tone="neutral" />)}
                  {u.careers.length > 3 && <Badge text={`+${u.careers.length - 3} carreras`} tone="neutral" />}
                </Row>
                {selected === u.id && (
                  <Row style={{ marginTop: 10 }}>
                    <Button small title="Ver sus capacidades" icon="flask-outline"
                      onPress={() => router.push({ pathname: '/capacidades', params: { org: u.id } })} />
                  </Row>
                )}
              </Pressable>
            ))}
        </>
      )}
    </Section>
  );
}
