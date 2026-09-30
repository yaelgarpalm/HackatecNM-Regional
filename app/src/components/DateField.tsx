import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, radius } from '@/components/theme';
import { Muted } from '@/components/ui';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const pad = (n: number) => String(n).padStart(2, '0');
/** Fecha local como 'AAAA-MM-DD' (el formato que guarda el backend). */
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
export const longDate = (iso: string) => {
  const d = fromIso(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

/** Campo de fecha con calendario: se elige el día con un toque, sin escribir. */
export function DateField({ label, value, onChange, minDate = 'today', hint }: {
  label: string;
  /** 'AAAA-MM-DD' o '' si no hay fecha */
  value: string;
  onChange: (iso: string) => void;
  /** Por defecto no se pueden elegir días pasados */
  minDate?: 'today' | null;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const base = value ? fromIso(value) : today();
  const [month, setMonth] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const min = minDate === 'today' ? today() : null;

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // la semana empieza en lunes
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const canGoBack = !min || new Date(month.getFullYear(), month.getMonth(), 0) >= min;
  const moveMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>{label}</Text>
      <Pressable onPress={() => setOpen(!open)} accessibilityLabel={`${label}: ${value ? longDate(value) : 'sin fecha'}`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1,
          borderColor: open ? colors.primary : colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
        }}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={{ flex: 1, fontSize: 15, color: value ? colors.text : '#98A2AD' }}>
          {value ? longDate(value) : 'Elegir fecha'}
        </Text>
        {value !== '' && (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Quitar fecha">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>

      {open && (
        <View style={{
          marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
          backgroundColor: colors.card, padding: 10, maxWidth: 340,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Pressable onPress={() => canGoBack && moveMonth(-1)} hitSlop={8} accessibilityLabel="Mes anterior"
              style={{ padding: 4, opacity: canGoBack ? 1 : 0.3 }}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text }}>
              {MESES[month.getMonth()][0].toUpperCase() + MESES[month.getMonth()].slice(1)} {month.getFullYear()}
            </Text>
            <Pressable onPress={() => moveMonth(1)} hitSlop={8} accessibilityLabel="Mes siguiente" style={{ padding: 4 }}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {DIAS.map((d, i) => (
              <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: colors.muted, marginBottom: 4 }}>{d}</Text>
            ))}
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 38 }} />;
              const iso = toIso(d);
              const disabled = !!min && d < min;
              const selected = iso === value;
              const isToday = iso === toIso(today());
              return (
                <View key={i} style={{ width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable disabled={disabled} onPress={() => { onChange(iso); setOpen(false); }}
                    accessibilityLabel={longDate(iso)}
                    style={({ hovered }: any) => ({
                      width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: selected ? colors.primary : hovered && !disabled ? colors.primarySoft : 'transparent',
                      borderWidth: isToday && !selected ? 1 : 0, borderColor: colors.primary,
                    })}>
                    <Text style={{
                      fontSize: 14, color: selected ? '#fff' : disabled ? '#C3CBD3' : colors.text,
                      fontWeight: selected ? '700' : '400',
                    }}>{d.getDate()}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
      {hint ? <Muted style={{ marginTop: 4, fontSize: 12 }}>{hint}</Muted> : null}
    </View>
  );
}
