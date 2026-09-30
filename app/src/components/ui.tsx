import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch as RNSwitch, Text,
  TextInput, View, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';

import { label } from '@/lib/format';
import { colors, MAX_WIDTH, radius } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Diálogos (ventanas propias de la app)
export { confirm, notify } from './dialogs';

// ---------------------------------------------------------------- Layout
export function Screen({
  children, onRefresh, refreshing = false, scroll = true, style,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = <View style={[s.inner, style]}>{children}</View>;
  if (!scroll) return <View style={s.screen}>{inner}</View>;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {inner}
    </ScrollView>
  );
}

export const Row = ({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap }, style]}>{children}</View>
);

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: any) => [s.card, (pressed || hovered) && s.cardHover, style]}
    >
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Texto
export const Title = ({ children, style }: { children: ReactNode; style?: any }) => <Text style={[s.title, style]}>{children}</Text>;
export const H2 = ({ children, style }: { children: ReactNode; style?: any }) => <Text style={[s.h2, style]}>{children}</Text>;
export const Body = ({ children, style, numberOfLines }: { children: ReactNode; style?: any; numberOfLines?: number }) => (
  <Text style={[s.body, style]} numberOfLines={numberOfLines}>{children}</Text>
);
export const Muted = ({ children, style }: { children: ReactNode; style?: any }) => <Text style={[s.muted, style]}>{children}</Text>;

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <H2>{title}</H2>
        {action}
      </Row>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Controles
type Variant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'ghost' | 'success';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, icon, small, style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.7 }, disabled && { opacity: 0.45 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Row gap={6} style={{ flexWrap: 'nowrap' }}>
          {icon && <Ionicons name={icon} size={small ? 15 : 18} color={v.fg} />}
          <Text style={[s.btnText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.card, fg: colors.primary, border: colors.border },
  danger: { bg: colors.danger, fg: '#fff', border: colors.danger },
  // Acción destructiva que no es la principal de la pantalla (p. ej. Cerrar sesión): texto rojo, sin relleno
  destructive: { bg: colors.card, fg: colors.danger, border: colors.border },
  success: { bg: colors.success, fg: '#fff', border: colors.success },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Field({
  label: lbl, hint, style, grow, ...props
}: TextInputProps & { label: string; hint?: string; grow?: boolean }) {
  // grow: para poner varios campos en una fila que se acomoda en pantallas angostas
  return (
    <View style={[{ marginBottom: 12 }, grow && { flexGrow: 1, flexBasis: 160 }]}>
      <Text style={s.label}>{lbl}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={lbl}
        style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]}
        {...props}
      />
      {hint ? <Muted style={{ marginTop: 4 }}>{hint}</Muted> : null}
    </View>
  );
}

/** Campo de búsqueda: busca mientras se escribe (con useDebounced) y tiene botón para borrar. */
export function SearchBar({
  value, onChangeText, placeholder, label: lbl = 'Buscar',
}: { value: string; onChangeText: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={lbl}
        returnKeyType="search"
        autoCorrect={false}
        style={s.searchInput}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar búsqueda">
          <Ionicons name="close-circle" size={20} color={colors.subtle} />
        </Pressable>
      )}
    </View>
  );
}

/** Filtros plegables: ocupan una sola línea hasta que el usuario los necesita. */
export function Filters({
  active, onClear, children, initiallyOpen = false,
}: { active: number; onClear: () => void; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ marginBottom: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}
          accessibilityLabel={`Filtros${active ? `, ${active} activos` : ''}`}
          style={({ pressed }) => [s.filterBtn, (open || active > 0) && s.filterBtnOn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
          <Text style={s.filterText}>Filtros</Text>
          {active > 0 && <View style={s.filterCount}><Text style={s.filterCountText}>{active}</Text></View>}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </Pressable>
        {active > 0 && <Button small variant="ghost" title="Limpiar filtros" onPress={onClear} />}
      </Row>
      {open && <View style={s.filterPanel}>{children}</View>}
    </View>
  );
}

/** Fila de lista que lleva a otra pantalla (con flecha, como en Ajustes). */
export function ListRow({
  icon, text, detail, onPress, last,
}: { icon: IconName; text: string; detail?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={detail ? `${text}, ${detail}` : text}
      style={({ pressed, hovered }: any) => [s.listRow, !last && s.listRowBorder, (pressed || hovered) && { backgroundColor: colors.bg }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={s.listRowText}>{text}</Text>
      {!!detail && <Text style={s.muted}>{detail}</Text>}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function ChipSelect<T extends string>({
  label: lbl, options, value, onChange, multi,
}: {
  label?: string;
  options: readonly T[];
  value: T | T[] | null;
  onChange: (v: any) => void;
  multi?: boolean;
}) {
  const selected = (o: T) => (multi ? (value as T[]).includes(o) : value === o);
  const toggle = (o: T) => {
    if (!multi) return onChange(value === o ? null : o);
    const arr = value as T[];
    onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
  };
  return (
    <View style={{ marginBottom: 12 }}>
      {lbl && <Text style={s.label}>{lbl}</Text>}
      <Row gap={6}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => toggle(o)} hitSlop={4} accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ selected: selected(o), checked: selected(o) }} style={[s.chip, selected(o) && s.chipOn]}>
            <Text style={[s.chipText, selected(o) && { color: '#fff' }]}>{label(o)}</Text>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

export function Switch({ label: lbl, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, minHeight: 44 }}>
      <Text style={[s.body, { flex: 1 }]}>{lbl}</Text>
      <RNSwitch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }}
        accessibilityLabel={lbl} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Indicadores
type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'accent';
const TONES: Record<Tone, [string, string]> = {
  neutral: ['#EEF1F4', colors.muted],
  primary: [colors.primarySoft, colors.primary],
  success: [colors.successSoft, colors.success],
  danger: [colors.dangerSoft, colors.danger],
  warning: [colors.warningSoft, colors.warning],
  accent: [colors.accentSoft, colors.accentText],
};

export function Badge({ text, tone = 'neutral', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  borrador: 'neutral', abierto: 'success', en_progreso: 'primary', finalizado: 'neutral', cancelado: 'danger',
  enviada: 'warning', aceptada: 'success', rechazada: 'danger', retirada: 'neutral',
  pendiente: 'neutral', entregado: 'warning', aprobado: 'success', cambios_solicitados: 'danger',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge text={label(status)} tone={STATUS_TONE[status] ?? 'neutral'} />;

export function Tags({ items, tone = 'primary' }: { items: string[]; tone?: Tone }) {
  if (!items?.length) return null;
  return (
    <Row gap={6} style={{ marginTop: 6 }}>
      {items.map((t) => <Badge key={t} text={t} tone={tone} />)}
    </Row>
  );
}

export function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <Row gap={2}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={6}
          accessibilityRole={onChange ? 'button' : 'image'} accessibilityLabel={`${n} de 5 estrellas`}>
          <Ionicons name={value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star-half' : 'star-outline'} size={size} color={colors.star} />
        </Pressable>
      ))}
    </Row>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <Row gap={8} style={{ flexWrap: 'nowrap' }}>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.round(score * 100)}%` }]} />
      </View>
      <Text style={[s.muted, { fontWeight: '700', color: colors.primary }]}>{Math.round(score * 100)}%</Text>
    </Row>
  );
}

export function Stat({ value, text, icon }: { value: number | string; text: string; icon: IconName }) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.muted}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Estados
export const Loading = () => (
  <View style={{ padding: 40, alignItems: 'center' }} accessibilityRole="progressbar" accessibilityLabel="Cargando">
    <ActivityIndicator color={colors.primary} size="large" />
  </View>
);

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={[s.card, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
      <Row gap={8} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 15, flex: 1 }}>{(error as Error)?.message ?? 'Ocurrió un error'}</Text>
      </Row>
      {onRetry && <Button title="Reintentar" variant="secondary" small onPress={onRetry} style={{ marginTop: 10, alignSelf: 'flex-start' }} />}
    </View>
  );
}

export function Empty({
  text, icon = 'file-tray-outline', actionTitle, onAction,
}: { text: string; icon?: IconName; actionTitle?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 28, gap: 8 }}>
      <Ionicons name={icon} size={36} color={colors.subtle} />
      <Muted style={{ textAlign: 'center' }}>{text}</Muted>
      {actionTitle && onAction && <Button small variant="secondary" title={actionTitle} onPress={onAction} style={{ marginTop: 4 }} />}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />;

// ---------------------------------------------------------------- Estilos
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: 16 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHover: { borderColor: colors.primary },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, minHeight: 44,
  },
  btn: {
    borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, minHeight: 44,
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12, minHeight: 40 },
  btnText: { fontSize: 15, fontWeight: '700' },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.primarySoft, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 999 },
  stat: {
    flexGrow: 1, flexBasis: 140, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 44, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  filterBtnOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  filterCount: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5,
  },
  filterCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  filterPanel: {
    marginTop: 10, padding: 12, paddingBottom: 0, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 12, paddingHorizontal: 4 },
  listRowBorder: { borderBottomWidth: 1, borderColor: colors.border },
  listRowText: { flex: 1, fontSize: 16, color: colors.text },
});
