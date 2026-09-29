import { useState } from 'react';

import { useCatalogs } from '@/components/hooks';
import { ChipSelect, Field } from '@/components/ui';
import { splitList } from '@/lib/format';

/** Carrera del estudiante: se elige del catálogo o se escribe si no aparece. */
export function CareerPicker({ label = 'Carrera', value, onChange }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const carreras = useCatalogs().data?.carreras ?? [];
  const inList = carreras.includes(value);
  return (
    <>
      <ChipSelect label={label} options={carreras} value={inList ? value : null} onChange={(v) => onChange(v ?? '')} />
      <Field label="¿No aparece tu carrera? Escríbela" value={inList ? '' : value} onChangeText={onChange}
        hint="Solo verás las problemáticas que piden tu carrera." />
    </>
  );
}

/** Carreras que pide una problemática: varias del catálogo y, opcionalmente, otras escritas a mano. */
export function CareersPicker(props: { value: string[]; onChange: (v: string[]) => void }) {
  const carreras = useCatalogs().data?.carreras;
  // Espera el catálogo para separar bien las carreras de la lista de las escritas a mano
  return carreras ? <CareersPickerInner {...props} carreras={carreras} /> : null;
}

function CareersPickerInner({ value, onChange, carreras }: {
  value: string[]; onChange: (v: string[]) => void; carreras: string[];
}) {
  const selected = value.filter((v) => carreras.includes(v));
  const [otras, setOtras] = useState(value.filter((v) => !carreras.includes(v)).join(', '));
  return (
    <>
      <ChipSelect label="Carreras que necesitas" options={carreras} value={selected} multi
        onChange={(v: string[]) => onChange([...v, ...splitList(otras)])} />
      <Field label="Otras carreras (si no están en la lista)" value={otras}
        onChangeText={(t) => { setOtras(t); onChange([...selected, ...splitList(t)]); }}
        hint="Separadas por comas. Solo los estudiantes de estas carreras verán la problemática; sin ninguna, la ven todos." />
    </>
  );
}
