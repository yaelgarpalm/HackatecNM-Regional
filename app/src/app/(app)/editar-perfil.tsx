import { Stack } from 'expo-router';
import { useState } from 'react';

import { useAction } from '@/components/hooks';
import { Button, Card, Field, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { isAcademic, useAuth, useUser } from '@/lib/auth';
import { splitList, goBack } from '@/lib/format';

export default function EditarPerfil() {
  const user = useUser();
  const { reload } = useAuth();
  const [f, setF] = useState({
    full_name: user.full_name, career: user.career ?? '', semester: user.semester ? String(user.semester) : '',
    skills: user.skills.join(', '), bio: user.bio ?? '', portfolio_url: user.portfolio_url ?? '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const save = useAction(() => api.patch('/users/me', {
    full_name: f.full_name, career: f.career || null, semester: f.semester ? Number(f.semester) : null,
    skills: splitList(f.skills), bio: f.bio || null, portfolio_url: f.portfolio_url || null,
  }), { onSuccess: async () => { await reload(); goBack('/perfil'); } });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Editar perfil' }} />
      <Card>
        <Field label="Nombre completo" value={f.full_name} onChangeText={set('full_name')} />
        {isAcademic(user) && (
          <>
            <Field label="Carrera" value={f.career} onChangeText={set('career')} />
            {user.role === 'estudiante' && <Field label="Semestre" value={f.semester} onChangeText={set('semester')} keyboardType="number-pad" />}
            <Field label="Habilidades" value={f.skills} onChangeText={set('skills')} hint="Separadas por comas" />
            <Field label="Portafolio (GitHub, Behance, sitio…)" value={f.portfolio_url} onChangeText={set('portfolio_url')} autoCapitalize="none" />
          </>
        )}
        <Field label="Sobre mí" value={f.bio} onChangeText={set('bio')} multiline />
        <Button title="Guardar" icon="save-outline" loading={save.isPending} onPress={() => save.mutate(undefined)} />
      </Card>
    </Screen>
  );
}
