import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';

import { label } from '@/lib/format';
import { colors, MAX_WIDTH, radius } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function blurFocusedElementOnWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

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
  const { width } = useWindowDimensions();
  const [entranceOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let mounted = true;
    const applyMotionPreference = (reduceMotion: boolean) => {
      if (!mounted) return;
      if (reduceMotion) {
        entranceOpacity.stopAnimation();
        entranceOpacity.setValue(1);
        return;
      }
      entranceOpacity.setValue(0);
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };

    AccessibilityInfo.isReduceMotionEnabled().then(applyMotionPreference).catch(() => entranceOpacity.setValue(1));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', applyMotionPreference);
    return () => {
      mounted = false;
      subscription.remove();
      entranceOpacity.stopAnimation();
    };
  }, [entranceOpacity]);

  const inner = (
    <Animated.View style={{ opacity: entranceOpacity }}>
      <View style={[s.inner, { paddingHorizontal: width < 420 ? 18 : 24, paddingVertical: width < 760 ? 18 : 28 }, style]}>
        {children}
      </View>
    </Animated.View>
  );
  if (!scroll) return <View style={s.screen}>{inner}</View>;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingBottom: width < 760 ? 116 : 40 }}
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
      onPress={() => { blurFocusedElementOnWeb(); onPress(); }}
      style={({ pressed, hovered }: any) => [s.card, hovered && s.cardHover, pressed && s.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Texto
export const Title = ({ children, style }: { children: ReactNode; style?: any }) => <Text style={[s.title, style]}>{children}</Text>;
export const H2 = ({ children, style, numberOfLines }: { children: ReactNode; style?: any; numberOfLines?: number }) => (
  <Text style={[s.h2, style]} numberOfLines={numberOfLines}>{children}</Text>
);
export const Body = ({ children, style, numberOfLines }: { children: ReactNode; style?: any; numberOfLines?: number }) => (
  <Text style={[s.body, style]} numberOfLines={numberOfLines}>{children}</Text>
);
export const Muted = ({ children, style, numberOfLines }: { children: ReactNode; style?: any; numberOfLines?: number }) => (
  <Text style={[s.muted, style]} numberOfLines={numberOfLines}>{children}</Text>
);

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
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, icon, small, blurOnPress = false, style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  /** Clears browser focus before actions that navigate, so inactive Expo Router screens don't retain focus. */
  blurOnPress?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const handlePress = () => {
    if (blurOnPress) blurFocusedElementOnWeb();
    onPress?.();
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border },
        pressed && s.btnPressed, (disabled || loading) && { opacity: 0.58 }, style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Row gap={6} style={{ flexWrap: 'nowrap' }}>
          {icon && <Ionicons name={icon} size={small ? 15 : 18} color={v.fg} />}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.card, fg: colors.primary, border: colors.border },
  danger: { bg: colors.danger, fg: '#fff', border: colors.danger },
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
        placeholderTextColor="#98A2AD"
        style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]}
        {...props}
      />
      {hint ? <Muted style={{ marginTop: 4, fontSize: 12 }}>{hint}</Muted> : null}
    </View>
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
      {[...new Set(options)].map((o) => (
          <Pressable key={o} onPress={() => toggle(o)} accessibilityRole="button"
            accessibilityState={{ selected: selected(o) }} style={[s.chip, selected(o) && s.chipOn]}>
            <Text style={[s.chipText, selected(o) && { color: '#fff' }]}>{label(o)}</Text>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

export function Switch({ label: lbl, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 12 }}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
      <Text style={s.body}>{lbl}</Text>
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
  accent: [colors.accentSoft, colors.accent],
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
      {[...new Set(items)].map((t) => <Badge key={t} text={t} tone={tone} />)}
    </Row>
  );
}

export function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <Row gap={2}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={8}
          accessibilityRole="button" accessibilityLabel={`${n} de 5 estrellas`} accessibilityState={{ selected: value >= n }}>
          <Ionicons name={value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star-half' : 'star-outline'} size={size} color="#E0A100" />
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
  <View style={{ padding: 40, alignItems: 'center' }}>
    <ActivityIndicator color={colors.primary} size="large" />
  </View>
);

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={[s.card, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
      <Text style={{ color: colors.danger, fontWeight: '600' }}>{(error as Error)?.message ?? 'Ocurrió un error'}</Text>
      {onRetry && <Button title="Reintentar" variant="secondary" small onPress={onRetry} style={{ marginTop: 10, alignSelf: 'flex-start' }} />}
    </View>
  );
}

export function Empty({ text, icon = 'file-tray-outline' }: { text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', padding: 28, gap: 8 }}>
      <Ionicons name={icon} size={36} color="#A8B3BE" />
      <Muted style={{ textAlign: 'center' }}>{text}</Muted>
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />;

// ---------------------------------------------------------------- Estilos
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    boxShadow: '0px 5px 14px rgba(23, 61, 58, 0.05)',
  },
  cardHover: { borderColor: '#B4D8D2' },
  cardPressed: { backgroundColor: '#FCFEFD' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text, marginBottom: 4, letterSpacing: -0.4 },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: colors.text, letterSpacing: -0.15 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 7 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 15, paddingVertical: 12, minHeight: 48, fontSize: 15, color: colors.text,
  },
  btn: {
    borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, minHeight: 48,
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 13, minHeight: 44 },
  btnPressed: { opacity: 0.84 },
  btnText: { fontSize: 15, fontWeight: '700' },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 999,
    minHeight: 44, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 14,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.primarySoft, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 999 },
  stat: {
    flexGrow: 1, flexBasis: 140, backgroundColor: colors.card, borderRadius: radius.lg, padding: 17,
    borderWidth: 1, borderColor: colors.border, gap: 3,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
});
