import { useState } from 'react';
import { View } from 'react-native';

import { CareerPicker } from '@/components/CareerPicker';
import { Combobox } from '@/components/Combobox';
import { useApi, useCatalogs } from '@/components/hooks';
import { colors } from '@/components/theme';
import { Badge, Body, Button, Card, ChipSelect, ErrorView, Field, H2, Muted, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { splitList } from '@/lib/format';
import type { Organization, Page, Role } from '@/lib/types';

type OrgType = 'empresa' | 'universidad' | 'gobierno';

const ORG_FOR_ROLE: Record<string, OrgType> = {
  empresa: 'empresa', gobierno: 'gobierno', universidad: 'universidad', estudiante: 'universidad', academico: 'universidad',
};
const ROLE_HELP: Record<string, string> = {
  estudiante: 'Forma equipos multidisciplinarios y resuelve problemáticas reales (residencia, servicio social, tesis…).',
  academico: 'Asesora equipos y ofrece tu experiencia como consultor.',
  empresa: 'Publica las problemáticas de tu negocio y recibe propuestas de equipos universitarios.',
  gobierno: 'Publica problemáticas públicas del municipio o dependencia.',
  universidad: 'Oficina de vinculación: publica laboratorios, equipo y expertos; mide tus indicadores.',
};
/** Cómo se llama la organización según el rol ("el nombre de tu empresa", "de tu institución"…). */
const ORG_WORD: Record<OrgType, { noun: string; example: string }> = {
  empresa: { noun: 'empresa', example: 'Panadería La Espiga' },
  gobierno: { noun: 'dependencia', example: 'H. Ayuntamiento de San Felipe del Progreso' },
  universidad: { noun: 'institución', example: 'TES San Felipe del Progreso' },
};
const ESTADOS = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán',
  'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function Step({ n, title, text }: { n: number; title: string; text?: string }) {
  return (
    <View style={{ marginTop: n > 1 ? 18 : 4, marginBottom: 10, paddingTop: n > 1 ? 16 : 0,
      borderTopWidth: n > 1 ? 1 : 0, borderColor: colors.border }}>
      <Row gap={8}>
        <Badge text={String(n)} tone="primary" />
        <H2>{title}</H2>
      </Row>
      {text && <Muted style={{ marginTop: 4 }}>{text}</Muted>}
    </View>
  );
}

export default function Registro() {
  const { login } = useAuth();
  const { data: cat } = useCatalogs();
  const [role, setRole] = useState<Role | null>('estudiante');
  const [f, setF] = useState({ full_name: '', email: '', password: '', career: '', semester: '', skills: '' });
  const [org, setOrg] = useState({ name: '', size: null as string | null, sector: '', city: '', state: '' });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const orgType = role ? ORG_FOR_ROLE[role] : null;
  const word = orgType ? ORG_WORD[orgType] : null;
  const { data: orgs } = useApi<Page<Organization>>(orgType ? '/organizations' : null, { type: orgType, size: 100 });
  const existing = (orgs?.items ?? []).find((o) => fold(o.name) === fold(org.name));
  const isNewOrg = !!org.name.trim() && !existing;
  const academic = role === 'estudiante' || role === 'academico';
  // Empresa, gobierno y universidad dan de alta su organización; estudiantes y académicos solo eligen su institución
  const registersOrg = role === 'empresa' || role === 'gobierno' || role === 'universidad';
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const setO = (k: keyof typeof org) => (v: string | null) => setOrg({ ...org, [k]: v });

  /** Revisa el formulario y devuelve qué falta, en palabras claras. */
  const missing = (): string[] => {
    const m: string[] = [];
    if (!role) m.push('Elige quién eres');
    if (word && !org.name.trim()) m.push(`Escribe el nombre de tu ${word.noun}`);
    if (isNewOrg && registersOrg && !org.state) m.push(`Elige el estado donde está tu ${word?.noun}`);
    if (f.full_name.trim().length < 2) m.push('Escribe tu nombre completo');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) m.push('Escribe un correo válido');
    if (f.password.length < 8) m.push('La contraseña debe tener al menos 8 caracteres');
    if (role === 'estudiante' && !f.career.trim()) m.push('Elige tu carrera');
    return m;
  };

  const submit = async () => {
    const m = missing();
    if (m.length) {
      setError(new Error(`Antes de crear tu cuenta:\n• ${m.join('\n• ')}`));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const body: any = {
        email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), role,
        career: f.career || null, semester: f.semester ? Number(f.semester) : null, skills: splitList(f.skills),
      };
      if (existing) body.organization_id = existing.id;
      else if (word) body.organization = { ...org, name: org.name.trim(), type: orgType, size: org.size || null };
      await api.post('/auth/register', body);
      await login(body.email, f.password);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  let step = 0;
  return (
    <Screen>
      <Card>
        <ChipSelect label="¿Quién eres?" options={(cat?.roles ?? Object.keys(ROLE_HELP)) as Role[]} value={role}
          onChange={(r) => { setRole(r); setOrg({ ...org, name: '' }); setError(null); }} />
        {role && <Muted>{ROLE_HELP[role]}</Muted>}

        {/* ---------- 1. Organización ---------- */}
        {word && (
          <>
            <Step n={++step} title={`Datos de tu ${word.noun}`}
              text={registersOrg
                ? `Si tu ${word.noun} ya está en VinculaTec, elígela de la lista; si no, escribe su nombre y se registrará.`
                : `Elige la ${word.noun} donde estudias o trabajas. Si no aparece, escribe su nombre.`} />
            <Combobox label={`Nombre de la ${word.noun}`} value={org.name} onChange={setO('name')} allowCustom
              options={(orgs?.items ?? []).map((o) => o.name)} placeholder={`Ej. ${word.example}`} />

            {existing && (
              <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.success }}>
                <Body>Tu cuenta quedará vinculada a <Body style={{ fontWeight: '700' }}>{existing.name}</Body>
                  {existing.verified ? ' (verificada)' : ''}.</Body>
              </Card>
            )}
            {isNewOrg && (
              <>
                <Muted style={{ marginBottom: 10 }}>
                  “{org.name.trim()}” no está registrada: se creará como {word.noun} nueva. Completa sus datos:
                </Muted>
                {orgType === 'empresa' && (
                  <ChipSelect label="Tamaño de la empresa" options={cat?.tamanos_organizacion ?? []} value={org.size}
                    onChange={setO('size')} />
                )}
                <Field label={orgType === 'empresa' ? 'Giro o sector (a qué se dedica)' : 'Área o sector'} value={org.sector}
                  onChangeText={setO('sector')} placeholder={orgType === 'empresa' ? 'Ej. Alimentos, Textil, Construcción' : ''} />
                <Row gap={10} style={{ alignItems: 'flex-start' }}>
                  <View style={{ flexGrow: 1, flexBasis: 200 }}>
                    <Field label="Municipio o ciudad" value={org.city} onChangeText={setO('city')} placeholder="Ej. San Felipe del Progreso" />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 200 }}>
                    <Combobox label="Estado" value={org.state} onChange={setO('state')} options={ESTADOS} placeholder="Escribe el estado" />
                  </View>
                </Row>
              </>
            )}
          </>
        )}

        {/* ---------- 2. Persona ---------- */}
        <Step n={++step} title={registersOrg ? 'Tus datos (responsable de la cuenta)' : 'Tus datos'}
          text={registersOrg ? `La persona que administrará la cuenta de la ${word?.noun}. Con este correo iniciarás sesión.`
            : 'Con este correo y contraseña iniciarás sesión.'} />
        <Field label="Tu nombre completo" value={f.full_name} onChangeText={set('full_name')} placeholder="Ej. Laura Pérez García" />
        <Field label="Correo electrónico" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address"
          placeholder="tu@correo.mx" />
        <Field label="Contraseña" value={f.password} onChangeText={set('password')} secureTextEntry hint="Mínimo 8 caracteres" />

        {/* ---------- 3. Perfil académico ---------- */}
        {academic && (
          <>
            <Step n={++step} title="Tu perfil académico" text="Con esto te mostramos las problemáticas que buscan tu carrera." />
            <CareerPicker value={f.career} onChange={set('career')} />
            {role === 'estudiante' && (
              <Field label="Semestre" value={f.semester} onChangeText={set('semester')} keyboardType="number-pad" placeholder="Ej. 6" />
            )}
            <Field label="Habilidades" value={f.skills} onChangeText={set('skills')} placeholder="Python, IoT, Diseño"
              hint="Separadas por comas. Se usan para recomendarte problemáticas." />
          </>
        )}
      </Card>

      {!!error && <ErrorView error={error} />}
      <Button title="Crear cuenta" onPress={submit} loading={loading} icon="person-add-outline" />
    </Screen>
  );
}
