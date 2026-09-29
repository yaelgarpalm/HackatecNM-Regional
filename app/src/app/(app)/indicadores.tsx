import { Stack } from 'expo-router';
import { View } from 'react-native';

import { useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import { Card, ErrorView, Loading, Muted, Row, Screen, Section, Stat } from '@/components/ui';
import { label } from '@/lib/format';

interface Stats {
  organizaciones: Record<string, number>;
  usuarios: Record<string, number>;
  retos: Record<string, number>;
  postulaciones: number;
  equipos: number;
  capacidades_publicadas: number;
  hitos_aprobados: number;
  calificacion_promedio: number;
}

/** Barra horizontal simple: una sola serie, etiquetas directas, sin librerías extra. */
function Bars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <Card>
      {entries.map(([k, v]) => (
        <Row key={k} gap={10} style={{ flexWrap: 'nowrap', marginBottom: 8 }}>
          <Muted style={{ width: 110 }}>{label(k)}</Muted>
          <View style={{ flex: 1, height: 14, backgroundColor: colors.primarySoft, borderRadius: 4 }}>
            <View style={{ width: `${(v / max) * 100}%`, height: 14, backgroundColor: colors.primary, borderRadius: 4 }} />
          </View>
          <Muted style={{ width: 30, textAlign: 'right', fontWeight: '700', color: colors.text }}>{v}</Muted>
        </Row>
      ))}
    </Card>
  );
}

export default function Indicadores() {
  const q = useApi<Stats>('/stats');
  const s = q.data;
  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'Indicadores' }} />
      <Muted>Indicadores de vinculación de toda la plataforma.</Muted>
      {q.isLoading ? <Loading /> : q.error || !s ? <ErrorView error={q.error} /> : (
        <>
          <Row gap={10} style={{ marginTop: 12 }}>
            <Stat value={Object.values(s.retos).reduce((a, b) => a + b, 0)} text="Problemáticas" icon="bulb-outline" />
            <Stat value={s.postulaciones} text="Postulaciones" icon="paper-plane-outline" />
            <Stat value={s.equipos} text="Equipos" icon="people-outline" />
            <Stat value={s.capacidades_publicadas} text="Capacidades" icon="flask-outline" />
            <Stat value={s.hitos_aprobados} text="Hitos aprobados" icon="flag-outline" />
            <Stat value={s.calificacion_promedio ? s.calificacion_promedio.toFixed(1) : '—'} text="Calificación promedio" icon="star-outline" />
          </Row>
          <Section title="Problemáticas por estado"><Bars data={s.retos} /></Section>
          <Section title="Organizaciones por tipo"><Bars data={s.organizaciones} /></Section>
          <Section title="Usuarios por rol"><Bars data={s.usuarios} /></Section>
        </>
      )}
    </Screen>
  );
}
