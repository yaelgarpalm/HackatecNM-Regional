import { Combobox, MultiCombobox } from '@/components/Combobox';
import { useCatalogs } from '@/components/hooks';

/** Carrera del estudiante: escribe y elige de la lista (o deja tu carrera si no aparece). */
export function CareerPicker({ label = 'Carrera', value, onChange }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const carreras = useCatalogs().data?.carreras ?? [];
  return (
    <Combobox label={label} options={carreras} value={value} onChange={onChange} allowCustom
      placeholder="Escribe tu carrera, p. ej. informática"
      hint="Solo verás las problemáticas que piden tu carrera." />
  );
}

/** Carreras que pide una problemática: se buscan y se agregan una por una. */
export function CareersPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const carreras = useCatalogs().data?.carreras ?? [];
  return (
    <MultiCombobox label="Carreras que necesitas" options={carreras} value={value} onChange={onChange} allowCustom
      placeholder="Escribe una carrera, p. ej. contaduría"
      hint="Solo los estudiantes de estas carreras verán la problemática; si no agregas ninguna, la ven todos." />
  );
}
