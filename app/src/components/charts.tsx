/**
 * Gráficas ligeras hechas con View (funcionan igual en web, Android e iOS, sin librerías).
 *
 * Colores de datos validados con el script de la skill dataviz sobre superficie blanca:
 * categóricos azul/naranja/aqua (CVD ΔE ≥ 9) + gris neutro; los estados (aprobado, vencido…)
 * usan la paleta de estado y siempre van con ícono y texto, nunca solo color.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors, radius } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const VIZ = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  neutral: '#B0B8C1',
  track: '#E7EFF7',
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  violet: '#4a3aa7',
  neutralDark: '#8A96A3',
};

/** Colores para rebanadas categóricas: 4 validados con todos los pares (en un pastel todos se tocan). */
export const PIE_COLORS = [VIZ.blue, VIZ.orange, VIZ.aqua, VIZ.violet];

// ---------------------------------------------------------------- Animación de entrada
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Avance 0 → 1 con aceleración suave; vuelve a empezar cuando cambia `key`. Respeta "reducir movimiento". */
export function useGrow(key: string, duration = 900) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) return setP(1);
      const start = Date.now();
      setP(0);
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        setP(easeOut(t));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }).catch(() => setP(1));
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [key, duration]);
  return p;
}

// Textos siempre en tinta de texto (nunca del color de la serie)
const ink = { primary: colors.text, secondary: colors.muted };

export type Segment = { key: string; label: string; value: number; color: string; icon?: IconName };

/** Pastilla de "tooltip" que aparece al pasar el mouse o tocar una marca. */
function Tip({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.text, borderRadius: 8, paddingVertical: 6,
      paddingHorizontal: 10, marginTop: 8 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- KPI
export function Kpi({ label, value, icon, hint, meter, delta, tone = 'default' }: {
  label: string;
  value: string;
  icon: IconName;
  hint?: string;
  /** 0–1: barra de avance debajo del número */
  meter?: number | null;
  /** Cambio respecto al periodo anterior */
  delta?: { value: number; text: string } | null;
  tone?: 'default' | 'critical' | 'good';
}) {
  const accent = tone === 'critical' ? VIZ.critical : tone === 'good' ? VIZ.good : VIZ.blue;
  const grow = useGrow(`${label}:${meter}`, 1000);
  return (
    // 3 por fila en pantallas anchas, 2 en el celular (minWidth hace que bajen de fila)
    <View style={{ flexGrow: 1, flexBasis: '30%', minWidth: 150, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
      borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={16} color={accent} />
        <Text style={{ fontSize: 12, color: ink.secondary, fontWeight: '600', flex: 1 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: '800', color: ink.primary, marginTop: 6 }}>{value}</Text>
      {meter != null && (
        <View style={{ height: 6, backgroundColor: VIZ.track, borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(1, meter) * grow * 100}%`, height: 6, backgroundColor: accent, borderRadius: 999 }} />
        </View>
      )}
      {delta && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <Ionicons name={delta.value > 0 ? 'arrow-up' : delta.value < 0 ? 'arrow-down' : 'remove'} size={13}
            color={delta.value > 0 ? VIZ.good : delta.value < 0 ? VIZ.critical : ink.secondary} />
          <Text style={{ fontSize: 12, color: ink.secondary }}>{delta.text}</Text>
        </View>
      )}
      {!!hint && <Text style={{ fontSize: 12, color: ink.secondary, marginTop: 4 }}>{hint}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------- Barra apilada (parte de un todo)
export function StackedBar({ segments, unit = '' }: { segments: Segment[]; unit?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const sel = segments.find((s) => s.key === active);
  if (!total) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 22, gap: 2 }}>
        {visible.map((s, i) => (
          <Pressable key={s.key} onHoverIn={() => setActive(s.key)} onHoverOut={() => setActive(null)}
            onPress={() => setActive(active === s.key ? null : s.key)} accessibilityLabel={`${s.label}: ${s.value}`}
            style={{
              flex: s.value, backgroundColor: s.color, opacity: active && active !== s.key ? 0.35 : 1,
              borderTopLeftRadius: i === 0 ? 6 : 0, borderBottomLeftRadius: i === 0 ? 6 : 0,
              borderTopRightRadius: i === visible.length - 1 ? 6 : 0, borderBottomRightRadius: i === visible.length - 1 ? 6 : 0,
            }} />
        ))}
      </View>
      {sel && <Tip text={`${sel.label}: ${sel.value}${unit} (${Math.round((sel.value / total) * 100)}%)`} />}
      {/* Leyenda con valores: la identidad nunca depende solo del color */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {segments.map((s) => (
          <Pressable key={s.key} onHoverIn={() => setActive(s.key)} onHoverOut={() => setActive(null)}
            onPress={() => setActive(active === s.key ? null : s.key)}
            style={{ flexGrow: 1, flexBasis: 130, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8,
              borderRadius: radius.md, borderWidth: 1, borderColor: active === s.key ? s.color : colors.border,
              opacity: s.value ? 1 : 0.55 }}>
            {s.icon ? <Ionicons name={s.icon} size={18} color={s.color} />
              : <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: ink.primary }}>{s.value}</Text>
              <Text style={{ fontSize: 12, color: ink.secondary }}>
                {s.label}{total ? ` · ${Math.round((s.value / total) * 100)}%` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Columnas por mes (tendencia)
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesCorto = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1];

export function MonthlyColumns({ data }: { data: { mes: string; postulaciones: number; aceptadas: number }[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.postulaciones));
  const H = 140;
  const sel = data.find((d) => d.mes === active);
  const grow = useGrow(data.map((d) => `${d.mes}${d.postulaciones}${d.aceptadas}`).join('|'), 1000);

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <Legend color={VIZ.blue} text="Aceptadas" />
        <Legend color={VIZ.neutral} text="Otras postulaciones" />
        <Pressable onPress={() => setTable(!table)} style={{ marginLeft: 'auto' }} accessibilityRole="button">
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{table ? 'Ver gráfica' : 'Ver como tabla'}</Text>
        </Pressable>
      </View>

      {table ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
          {[{ mes: 'Mes', postulaciones: 'Postulaciones', aceptadas: 'Aceptadas' }, ...data].map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', padding: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.border,
              backgroundColor: i ? colors.card : colors.bg }}>
              {[i ? mesCorto(d.mes as string) : d.mes, String(d.postulaciones), String(d.aceptadas)].map((c, j) => (
                <Text key={j} style={{ flex: 1, fontSize: 13, color: ink.primary, fontWeight: i ? '400' : '700',
                  textAlign: j ? 'right' : 'left' }}>{c}</Text>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H + 20, gap: 10,
            borderBottomWidth: 1, borderColor: colors.border }}>
            {data.map((d) => {
              const h = (d.postulaciones / max) * H * grow;
              const acc = (d.aceptadas / max) * H * grow;
              const dim = active && active !== d.mes;
              return (
                <Pressable key={d.mes} onHoverIn={() => setActive(d.mes)} onHoverOut={() => setActive(null)}
                  onPress={() => setActive(active === d.mes ? null : d.mes)}
                  accessibilityLabel={`${mesCorto(d.mes)}: ${d.postulaciones} postulaciones, ${d.aceptadas} aceptadas`}
                  style={{ flex: 1, height: H + 20, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {d.postulaciones > 0 && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: ink.primary, marginBottom: 4 }}>{d.postulaciones}</Text>
                  )}
                  <View style={{ width: '70%', maxWidth: 44, opacity: dim ? 0.35 : 1 }}>
                    {h - acc > 0 && (
                      <View style={{ height: h - acc, backgroundColor: VIZ.neutral, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                        marginBottom: acc > 0 ? 2 : 0 }} />
                    )}
                    {acc > 0 && (
                      <View style={{ height: acc, backgroundColor: VIZ.blue,
                        borderTopLeftRadius: h - acc > 0 ? 0 : 4, borderTopRightRadius: h - acc > 0 ? 0 : 4 }} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            {data.map((d) => (
              <Text key={d.mes} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: ink.secondary,
                fontWeight: d.mes === active ? '800' : '400' }}>{mesCorto(d.mes)}</Text>
            ))}
          </View>
          {sel && <Tip text={`${mesCorto(sel.mes)} ${sel.mes.slice(0, 4)}: ${sel.postulaciones} postulaciones · ${sel.aceptadas} aceptadas`} />}
        </>
      )}
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: ink.secondary }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Barras horizontales (comparar)
export type HBar = { key: string; label: string; value: number; display: string; color?: string; icon?: IconName; note?: string };

export function HBars({ rows, max, onPress }: { rows: HBar[]; max?: number; onPress?: (key: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  const grow = useGrow(rows.map((r) => `${r.key}${r.value}`).join('|'), 1000);
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => (
        <Pressable key={r.key} onHoverIn={() => setActive(r.key)} onHoverOut={() => setActive(null)}
          onPress={() => onPress?.(r.key)} accessibilityLabel={`${r.label}: ${r.display}`}
          style={{ opacity: active && active !== r.key ? 0.5 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {r.icon && <Ionicons name={r.icon} size={14} color={r.color ?? VIZ.blue} />}
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: ink.primary, fontWeight: '600' }}>{r.label}</Text>
            <Text style={{ fontSize: 13, color: ink.primary, fontWeight: '800' }}>{r.display}</Text>
          </View>
          <View style={{ height: 10, backgroundColor: VIZ.track, borderRadius: 999, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100) * grow}%`, height: 10,
              backgroundColor: r.color ?? VIZ.blue, borderRadius: 999 }} />
          </View>
          {!!r.note && <Text style={{ fontSize: 12, color: ink.secondary, marginTop: 3 }}>{r.note}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Pastel (dona) animado
/** Trazo SVG de una rebanada de dona entre los ángulos a0 y a1 (radianes, 0 = arriba). */
function arc(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  const p = (rad: number, ang: number) => `${cx + rad * Math.sin(ang)} ${cy - rad * Math.cos(ang)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
}

export function PieChart({ segments, unit = '', centerLabel = 'Total', size = 190 }: {
  segments: Segment[];
  /** Texto después del número en el detalle, p. ej. " hitos" */
  unit?: string;
  centerLabel?: string;
  size?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const grow = useGrow(segments.map((s) => `${s.key}${s.value}`).join('|'), 1100);
  const sel = segments.find((s) => s.key === active);
  if (!total) return null;

  const cx = size / 2;
  const R = size / 2 - 8; // deja espacio para que la rebanada activa "salga"
  const r = R * 0.6;
  const sweep = Math.PI * 2 * grow;
  // Ángulo de inicio y fin de cada rebanada (proporcional a su valor)
  const slices = segments.filter((s) => s.value > 0).map((s, i, arr) => {
    const before = arr.slice(0, i).reduce((t, x) => t + x.value, 0);
    return { s, a0: (before / total) * sweep, a1: ((before + s.value) / total) * sweep };
  });
  const toggle = (key: string) => setActive(active === key ? null : key);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cx} r={(R + r) / 2} stroke={VIZ.track} strokeWidth={R - r} fill="none" />
          <G>
            {slices.map(({ s, a0, a1: end }) => {
              let a1 = end;
              if (a1 - a0 < 0.0001) return null;
              if (a1 - a0 >= Math.PI * 2 - 0.0001) a1 = a0 + Math.PI * 2 - 0.0001; // una sola rebanada = anillo completo
              const on = active === s.key;
              return (
                <Path key={s.key} d={arc(cx, cx, on ? R + 6 : R, r, a0, a1)} fill={s.color}
                  opacity={active && !on ? 0.35 : 1} stroke="#fff" strokeWidth={2}
                  accessibilityLabel={`${s.label}: ${s.value}${unit}`}
                  // En web react-native-svg convierte onPress en props desconocidas del DOM: ahí se usan eventos del mouse
                  {...(Platform.OS === 'web'
                    ? { onClick: () => toggle(s.key), onMouseEnter: () => setActive(s.key), onMouseLeave: () => setActive(null) } as object
                    : { onPress: () => toggle(s.key) })} />
              );
            })}
          </G>
        </Svg>
        {/* Centro: total, o la rebanada seleccionada */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: size, height: size,
          alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: ink.primary }}>
            {sel ? sel.value : Math.round(total * grow)}
          </Text>
          {/* El texto cabe dentro del hueco de la dona */}
          <Text numberOfLines={2} style={{ width: r * 1.5, fontSize: 11, lineHeight: 14, color: ink.secondary, textAlign: 'center' }}>
            {sel ? `${sel.label} · ${Math.round((sel.value / total) * 100)}%` : centerLabel}
          </Text>
        </View>
      </View>

      {/* Leyenda con valores: la identidad nunca depende solo del color */}
      <View style={{ flexGrow: 1, flexBasis: 170, gap: 6 }}>
        {segments.map((s) => (
          <Pressable key={s.key} onHoverIn={() => setActive(s.key)} onHoverOut={() => setActive(null)}
            onPress={() => setActive(s.key)} accessibilityRole="button" accessibilityLabel={`${s.label}: ${s.value}${unit}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8,
              borderRadius: radius.md, backgroundColor: active === s.key ? colors.bg : 'transparent',
              opacity: s.value ? 1 : 0.5 }}>
            {s.icon ? <Ionicons name={s.icon} size={16} color={s.color} />
              : <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />}
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: ink.primary }}>{s.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: ink.primary }}>{s.value}</Text>
            <Text style={{ width: 40, textAlign: 'right', fontSize: 12, color: ink.secondary }}>
              {Math.round((s.value / total) * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
