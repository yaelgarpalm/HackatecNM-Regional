import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAction, useApi, useCatalogs } from '@/components/hooks';
import { Button, Card, ChipSelect, Field, Loading, Muted, Row, Screen, Section, Switch } from '@/components/ui';
import { api } from '@/lib/api';
import { splitList } from '@/lib/format';
import type { Challenge } from '@/lib/types';

const EMPTY = {
  title: '', summary: '', description: '', category: '', tags: '', required_disciplines: '',
  min_disciplines: '2', modalities: [] as string[], budget_mxn: '', offers_stipend: false,
  duration_weeks: '', deadline: '', confidentiality: 'publico', ip_model: 'compartida',
};

const fromChallenge = (c: Challenge): typeof EMPTY => ({
  title: c.title, summary: c.summary, description: c.description ?? '', category: c.category,
  tags: c.tags.join(', '), required_disciplines: c.required_disciplines.join(', '),
  min_disciplines: String(c.min_disciplines), modalities: c.modalities, budget_mxn: c.budget_mxn ? String(c.budget_mxn) : '',
  offers_stipend: c.offers_stipend, duration_weeks: c.duration_weeks ? String(c.duration_weeks) : '',
  deadline: c.deadline ?? '', confidentiality: c.confidentiality, ip_model: c.ip_model,
});

/** Si se edita, primero carga el reto y luego monta el formulario con esos valores. */
export default function PublicarPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useApi<Challenge>(id ? `/challenges/${id}` : null);
  if (id && !existing.data) return <Loading />;
  return <ChallengeForm id={id} initial={existing.data ? fromChallenge(existing.data) : EMPTY} />;
}

function ChallengeForm({ id, initial }: { id?: string; initial: typeof EMPTY }) {
  const editing = !!id;
  const { data: cat } = useCatalogs();
  const [f, setF] = useState(initial);
  const set = <K extends keyof typeof EMPTY>(k: K) => (v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  const body = () => ({
    title: f.title, summary: f.summary, description: f.description, category: f.category,
    tags: splitList(f.tags), required_disciplines: splitList(f.required_disciplines),
    min_disciplines: Number(f.min_disciplines) || 1, modalities: f.modalities,
    budget_mxn: f.budget_mxn ? Number(f.budget_mxn) : null, offers_stipend: f.offers_stipend,
    duration_weeks: f.duration_weeks ? Number(f.duration_weeks) : null, deadline: f.deadline || null,
    confidentiality: f.confidentiality, ip_model: f.ip_model,
  });

  const save = useAction(
    (publish: boolean) => editing
      ? api.patch<Challenge>(`/challenges/${id}`, body())
      : api.post<Challenge>('/challenges', { ...body(), publish }),
    { onSuccess: (c) => router.replace(`/reto/${c.id}`) },
  );


  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Editar reto' : 'Publicar reto' }} />
      <Muted>Describe el problema en lenguaje sencillo: qué pasa, cómo te afecta y qué resultado esperas.</Muted>

      <Section title="El problema">
        <Card>
          <Field label="Título" value={f.title} onChangeText={set('title')} placeholder="Monitoreo de temperatura en hornos" />
          <Field label="Resumen público" value={f.summary} onChangeText={set('summary')} multiline
            hint="Siempre visible, incluso si el reto es confidencial (10–500 caracteres)." />
          <Field label="Descripción detallada" value={f.description} onChangeText={set('description')} multiline
            hint="Si el reto es confidencial, solo la ve quien acepte el NDA." />
          <Field label="Categoría" value={f.category} onChangeText={set('category')} placeholder="IoT, Comercio electrónico, Logística…" />
          <Field label="Etiquetas" value={f.tags} onChangeText={set('tags')} placeholder="sensores, temperatura, inventarios"
            hint="Separadas por comas. Se usan para sugerir talento y laboratorios." />
        </Card>
      </Section>

      <Section title="Equipo buscado">
        <Card>
          <Field label="Disciplinas requeridas" value={f.required_disciplines} onChangeText={set('required_disciplines')}
            placeholder="Sistemas Computacionales, Industrial" hint="Separadas por comas." />
          <Field label="Mínimo de carreras distintas en el equipo" value={f.min_disciplines} onChangeText={set('min_disciplines')} keyboardType="number-pad" />
          <ChipSelect label="Válido como" options={cat?.modalidades ?? []} value={f.modalities} onChange={set('modalities')} multi />
        </Card>
      </Section>

      <Section title="Condiciones">
        <Card>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <Field grow label="Presupuesto (MXN)" value={f.budget_mxn} onChangeText={set('budget_mxn')} keyboardType="numeric" />
            <Field grow label="Duración (semanas)" value={f.duration_weeks} onChangeText={set('duration_weeks')} keyboardType="number-pad" />
            <Field grow label="Fecha límite (AAAA-MM-DD)" value={f.deadline} onChangeText={set('deadline')} placeholder="2026-12-01" />
          </Row>
          <Switch label="Ofrezco apoyo económico o beca a los estudiantes" value={f.offers_stipend} onChange={set('offers_stipend')} />
          <ChipSelect label="Confidencialidad" options={cat?.confidencialidad ?? []} value={f.confidentiality}
            onChange={(v) => v && set('confidentiality')(v)} />
          <ChipSelect label="¿De quién serán los resultados? (propiedad intelectual)" options={cat?.propiedad_intelectual ?? []}
            value={f.ip_model} onChange={(v) => v && set('ip_model')(v)} />
        </Card>
      </Section>

      <Row style={{ marginTop: 16 }}>
        {editing ? (
          <Button title="Guardar cambios" icon="save-outline" loading={save.isPending} onPress={() => save.mutate(false)} />
        ) : (
          <>
            <Button title="Publicar ahora" icon="megaphone-outline" loading={save.isPending} onPress={() => save.mutate(true)} />
            <Button title="Guardar borrador" variant="secondary" loading={save.isPending} onPress={() => save.mutate(false)} />
          </>
        )}
      </Row>
    </Screen>
  );
}
