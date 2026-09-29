import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { colors, radius } from '@/components/theme';
import { Muted, Row } from '@/components/ui';

/** Minúsculas y sin acentos: "Ingeniería" y "ingenieria" se encuentran igual. */
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Filtra por todas las palabras escritas: "ing sis" encuentra "Ingeniería en Sistemas Computacionales". */
function filterOptions(options: string[], query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return options;
  return options.filter((o) => {
    const f = fold(o);
    return words.every((w) => f.includes(w));
  });
}

type Common = {
  label: string;
  options: string[];
  placeholder?: string;
  hint?: string;
  /** Permite guardar un texto que no está en la lista. */
  allowCustom?: boolean;
};

/** Campo de texto con lista desplegable que se filtra mientras escribes. */
function ComboInput({
  label, options, placeholder, hint, allowCustom, query, setQuery, onPick, exclude = [], children,
}: Common & {
  query: string;
  setQuery: (t: string) => void;
  onPick: (option: string) => void;
  exclude?: string[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const results = filterOptions(options.filter((o) => !exclude.includes(o)), query);
  const exact = options.some((o) => fold(o) === fold(query));
  const showCustom = allowCustom && query.trim() !== '' && !exact;

  const pick = (o: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    onPick(o);
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>{label}</Text>
      {children}
      <View style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1,
        borderColor: open ? colors.primary : colors.border, borderRadius: radius.md, paddingHorizontal: 12,
      }}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={(t) => { setQuery(t); setOpen(true); }}
          onFocus={() => setOpen(true)}
          // Se cierra con un pequeño retraso para que el toque en una opción alcance a registrarse
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 200); }}
          onSubmitEditing={() => { if (results.length === 1) pick(results[0]); else if (showCustom) pick(query.trim()); }}
          placeholder={placeholder}
          placeholderTextColor="#98A2AD"
          style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 10, fontSize: 15, color: colors.text }}
        />
        {query !== '' && (
          <Pressable onPress={() => { setQuery(''); setOpen(true); }} hitSlop={8} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
        <Pressable onPress={() => setOpen(!open)} hitSlop={8} style={{ marginLeft: 6 }} accessibilityLabel="Ver opciones">
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
      </View>

      {open && (
        <View style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 4,
          backgroundColor: colors.card, maxHeight: 260, overflow: 'hidden',
        }}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.map((o) => <Option key={o} text={o} onPress={() => pick(o)} />)}
            {showCustom && (
              <Option text={`Usar "${query.trim()}" (no está en la lista)`} icon="add-circle-outline" onPress={() => pick(query.trim())} />
            )}
            {!results.length && !showCustom && <Muted style={{ padding: 12 }}>Sin coincidencias.</Muted>}
          </ScrollView>
        </View>
      )}
      {hint ? <Muted style={{ marginTop: 4, fontSize: 12 }}>{hint}</Muted> : null}
    </View>
  );
}

function Option({ text, icon, onPress }: { text: string; icon?: 'add-circle-outline'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12,
        borderBottomWidth: 1, borderColor: colors.border,
        backgroundColor: pressed || hovered ? colors.primarySoft : colors.card,
      })}>
      {icon && <Ionicons name={icon} size={16} color={colors.primary} />}
      <Text style={{ fontSize: 14, color: colors.text, flex: 1 }}>{text}</Text>
    </Pressable>
  );
}

/** Una sola opción. Lo escrito se muestra en el campo; al elegir, se reemplaza por la opción. */
export function Combobox({ value, onChange, ...common }: Common & { value: string; onChange: (v: string) => void }) {
  return (
    <ComboInput {...common} query={value} setQuery={onChange} onPick={onChange} />
  );
}

/** Varias opciones: se muestran como etiquetas con botón para quitarlas. */
export function MultiCombobox({ value, onChange, ...common }: Common & { value: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState('');
  return (
    <ComboInput {...common} query={query} setQuery={setQuery} exclude={value}
      onPick={(o) => { if (!value.includes(o)) onChange([...value, o]); setQuery(''); }}>
      {value.length > 0 && (
        <Row gap={6} style={{ marginBottom: 8 }}>
          {value.map((v) => (
            <Pressable key={v} onPress={() => onChange(value.filter((x) => x !== v))} accessibilityLabel={`Quitar ${v}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary,
                borderRadius: 999, paddingVertical: 6, paddingLeft: 12, paddingRight: 8,
              }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{v}</Text>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          ))}
        </Row>
      )}
    </ComboInput>
  );
}
