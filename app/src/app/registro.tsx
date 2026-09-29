import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { CareerPicker } from '@/components/CareerPicker';
import { useApi, useCatalogs } from '@/components/hooks';
import { colors } from '@/components/theme';
import { Button, Card, ChipSelect, ErrorView, Field, H2, Muted, Row, Screen, Switch } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { splitList } from '@/lib/format';
import type { Organization, Page, Role } from '@/lib/types';

const ORG_FOR_ROLE: Record<string, 'empresa' | 'universidad' | 'gobierno'> = {
  empresa: 'empresa', gobierno: 'gobierno', universidad: 'universidad', estudiante: 'universidad', academico: 'universidad',
};
const ROLE_HELP: Record<string, string> = {
  estudiante: 'Forma equipos multidisciplinarios y resuelve problemáticas reales (residencia, servicio social, tesis…).',
  academico: 'Asesora equipos y ofrece tu experiencia como consultor.',
  empresa: 'Publica los problemas de tu negocio y recibe propuestas de equipos universitarios.',
  gobierno: 'Publica problemáticas públicas del municipio o dependencia.',
  universidad: 'Oficina de vinculación: publica laboratorios, equipo y expertos; mide tus indicadores.',
};

export default function Registro() {
  const { login } = useAuth();
  const { data: cat } = useCatalogs();
  const [role, setRole] = useState<Role | null>('estudiante');
  const [f, setF] = useState({ full_name: '', email: '', password: '', career: '', semester: '', skills: '' });
  const [newOrg, setNewOrg] = useState(false);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [org, setOrg] = useState({ name: '', size: null as string | null, sector: '', city: '', state: '' });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const orgType = role ? ORG_FOR_ROLE[role] : null;
  const { data: orgs } = useApi<Page<Organization>>(orgType ? '/organizations' : null, { type: orgType, size: 100 });
  const academic = role === 'estudiante' || role === 'academico';
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const body: any = {
        email: f.email.trim(), password: f.password, full_name: f.full_name, role,
        career: f.career || null, semester: f.semester ? Number(f.semester) : null, skills: splitList(f.skills),
      };
      if (newOrg) body.organization = { ...org, type: orgType, size: org.size || null };
      else body.organization_id = orgId;
      await api.post('/auth/register', body);
      await login(body.email, f.password);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <ChipSelect label="¿Quién eres?" options={(cat?.roles ?? Object.keys(ROLE_HELP)) as Role[]} value={role}
          onChange={(r) => { setRole(r); setOrgId(null); }} />
        {role && <Muted style={{ marginBottom: 12 }}>{ROLE_HELP[role]}</Muted>}
        <Field label="Nombre completo" value={f.full_name} onChangeText={set('full_name')} />
        <Field label="Correo" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Contraseña" value={f.password} onChangeText={set('password')} secureTextEntry hint="Mínimo 8 caracteres" />
        {academic && (
          <>
            <CareerPicker value={f.career} onChange={set('career')} />
            {role === 'estudiante' && (
              <Field label="Semestre" value={f.semester} onChangeText={set('semester')} keyboardType="number-pad" />
            )}
            <Field label="Habilidades" value={f.skills} onChangeText={set('skills')} placeholder="Python, IoT, Diseño"
              hint="Separadas por comas. Se usan para recomendarte problemáticas." />
          </>
        )}
      </Card>

      {orgType && (
        <Card>
          <H2>{orgType === 'universidad' ? 'Tu institución' : 'Tu organización'}</H2>
          {!newOrg && (
            <Row gap={6} style={{ marginVertical: 10 }}>
              {(orgs?.items ?? []).map((o) => (
                <Pressable key={o.id} onPress={() => setOrgId(o.id)}
                  style={{
                    borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
                    borderColor: orgId === o.id ? colors.primary : colors.border,
                    backgroundColor: orgId === o.id ? colors.primary : '#fff',
                  }}>
                  <Text style={{ color: orgId === o.id ? '#fff' : colors.text, fontWeight: '600' }}>{o.name}</Text>
                </Pressable>
              ))}
              {!orgs?.items.length && <Muted>No hay registradas todavía.</Muted>}
            </Row>
          )}
          <Switch label={`Registrar una ${orgType === 'universidad' ? 'institución' : 'organización'} nueva`}
            value={newOrg} onChange={setNewOrg} />
          {newOrg && (
            <>
              <Field label="Nombre" value={org.name} onChangeText={(v) => setOrg({ ...org, name: v })} />
              {orgType === 'empresa' && (
                <ChipSelect label="Tamaño" options={cat?.tamanos_organizacion ?? []} value={org.size}
                  onChange={(v) => setOrg({ ...org, size: v })} />
              )}
              <Field label="Sector / giro" value={org.sector} onChangeText={(v) => setOrg({ ...org, sector: v })} />
              <Row gap={10} style={{ alignItems: 'flex-start' }}>
                <Field grow label="Ciudad" value={org.city} onChangeText={(v) => setOrg({ ...org, city: v })} />
                <Field grow label="Estado" value={org.state} onChangeText={(v) => setOrg({ ...org, state: v })} />
              </Row>
            </>
          )}
        </Card>
      )}

      {!!error && <ErrorView error={error} />}
      <Button title="Crear cuenta" onPress={submit} loading={loading} icon="person-add-outline" />
    </Screen>
  );
}
