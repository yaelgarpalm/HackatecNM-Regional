import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { useApi } from '@/components/hooks';
import { Badge, Body, Button, Card, Empty, ErrorView, Field, H2, Loading, Muted, Row, Screen, Stat } from '@/components/ui';
import { useUser } from '@/lib/auth';
import { shortDate } from '@/lib/format';
import type { AdminUniversity, AdminUser, Page } from '@/lib/types';

type Vista = 'universidades' | 'alumnos';

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Panel del administrador: universidades registradas y sus alumnos. */
export default function Registrados() {
  const user = useUser();
  const admin = user.role === 'admin';
  const [vista, setVista] = useState<Vista>('universidades');
  const [q, setQ] = useState('');
  // Al tocar una universidad se muestran solo sus alumnos
  const [uni, setUni] = useState<AdminUniversity | null>(null);

  const unis = useApi<AdminUniversity[]>(admin && vista === 'universidades' ? '/admin/universities' : null, { q });
  const alumnos = useApi<Page<AdminUser>>(admin && vista === 'alumnos' ? '/admin/users' : null,
    { role: 'estudiante', organization_id: uni?.id, q, size: 100 });
  const actual = vista === 'universidades' ? unis : alumnos;

  const cambiar = (v: Vista) => {
    setVista(v);
    setQ('');
  };

  if (!admin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Universidades y alumnos' }} />
        <Empty text="Solo el administrador puede ver esta sección." icon="lock-closed-outline" />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={actual.refetch} refreshing={actual.isRefetching}>
      <Stack.Screen options={{ title: 'Universidades y alumnos' }} />
      <Row gap={8} style={{ marginBottom: 12 }}>
        <Button small title="Universidades" icon="school-outline" variant={vista === 'universidades' ? 'primary' : 'secondary'}
          onPress={() => cambiar('universidades')} />
        <Button small title="Alumnos" icon="people-outline" variant={vista === 'alumnos' ? 'primary' : 'secondary'}
          onPress={() => cambiar('alumnos')} />
      </Row>

      <Field
        label={vista === 'universidades' ? 'Buscar universidad, ciudad o estado' : 'Buscar por nombre, correo, carrera o universidad'}
        value={q} onChangeText={setQ} autoCapitalize="none"
      />

      {vista === 'universidades' ? (
        unis.isLoading ? <Loading /> : unis.error ? <ErrorView error={unis.error} onRetry={unis.refetch} /> :
        !unis.data?.length ? <Empty text="No hay universidades registradas con esa búsqueda." icon="school-outline" /> : (
          <>
            <Row gap={10} style={{ marginBottom: 12 }}>
              <Stat value={unis.data.length} text="Universidades" icon="school-outline" />
              <Stat value={unis.data.reduce((a, o) => a + o.students, 0)} text="Alumnos" icon="people-outline" />
              <Stat value={unis.data.reduce((a, o) => a + o.academics, 0)} text="Académicos" icon="person-outline" />
            </Row>
            {unis.data.map((o) => (
              <Card key={o.id} onPress={() => { setUni(o); cambiar('alumnos'); }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <H2>{o.name}</H2>
                  {o.verified ? <Badge text="Verificada" tone="success" icon="shield-checkmark" /> : <Badge text="Sin verificar" tone="warning" />}
                </Row>
                <Muted>{[o.city, o.state].filter(Boolean).join(', ') || 'Sin ubicación'} · Registrada el {shortDate(o.created_at)}</Muted>
                <Row gap={6} style={{ marginTop: 8 }}>
                  <Badge text={cuenta(o.students, 'alumno', 'alumnos')} tone="primary" icon="people-outline" />
                  <Badge text={cuenta(o.academics, 'académico', 'académicos')} icon="person-outline" />
                  <Badge text={cuenta(o.careers, 'carrera', 'carreras')} icon="book-outline" />
                </Row>
                <Muted style={{ marginTop: 6, fontSize: 12 }}>Toca para ver sus alumnos</Muted>
              </Card>
            ))}
          </>
        )
      ) : (
        <>
          {uni && (
            <Row gap={8} style={{ marginBottom: 12, alignItems: 'center' }}>
              <Badge text={uni.name} tone="primary" icon="school-outline" />
              <Button small variant="ghost" title="Ver alumnos de todas" icon="close-outline" onPress={() => setUni(null)} />
            </Row>
          )}
          {alumnos.isLoading ? <Loading /> : alumnos.error ? <ErrorView error={alumnos.error} onRetry={alumnos.refetch} /> :
            !alumnos.data?.items.length ? <Empty text="No hay alumnos registrados con esa búsqueda." icon="people-outline" /> : (
              <>
                <Muted style={{ marginBottom: 8 }}>{cuenta(alumnos.data.total, 'alumno registrado', 'alumnos registrados')}</Muted>
                {alumnos.data.items.map((u) => (
                  <Card key={u.id} onPress={() => router.push(`/usuario/${u.id}`)}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <H2>{u.full_name}</H2>
                      {!u.is_active && <Badge text="Inactivo" tone="warning" />}
                    </Row>
                    <Muted>{u.email}</Muted>
                    <Body style={{ marginTop: 4 }}>
                      {[u.career, u.semester ? `${u.semester}° semestre` : null].filter(Boolean).join(' · ') || 'Sin carrera registrada'}
                    </Body>
                    <Muted style={{ marginTop: 4 }}>{u.organization_name ?? 'Sin universidad'} · Registro: {shortDate(u.created_at)}</Muted>
                  </Card>
                ))}
              </>
            )}
        </>
      )}
    </Screen>
  );
}
