/**
 * Confirmaciones y avisos con el diseño de la app (en lugar de window.confirm/alert del navegador
 * o Alert.alert del teléfono). <DialogHost /> se monta una vez en el layout raíz.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ConfirmOptions = {
  /** Texto del botón principal; por defecto "Aceptar" */
  confirmText?: string;
  cancelText?: string;
  /** Acción destructiva (eliminar, salir…): botón e ícono en rojo */
  danger?: boolean;
  icon?: IconName;
};
type ConfirmRequest = ConfirmOptions & { title: string; message?: string; resolve: (ok: boolean) => void };

export type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; title: string; message?: string; kind: ToastKind };

// ---------------------------------------------------------------- Estado compartido (sin librerías)
let showConfirm: ((r: ConfirmRequest) => void) | null = null;
let showToast: ((t: Toast) => void) | null = null;
let nextId = 1;

/** Pide confirmación con una ventana propia. Resuelve true si la persona acepta. */
export function confirm(title: string, message?: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!showConfirm) return resolve(false);
    showConfirm({ title, message, resolve, ...opts });
  });
}

/** Aviso breve arriba de la pantalla que desaparece solo. */
export function notify(title: string, message?: string, kind: ToastKind = 'success') {
  showToast?.({ id: nextId++, title, message, kind });
}

// ---------------------------------------------------------------- Componentes
const TOAST_STYLE: Record<ToastKind, { icon: IconName; color: string; soft: string; label: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success, soft: colors.successSoft, label: 'Listo' },
  error: { icon: 'alert-circle', color: colors.danger, soft: colors.dangerSoft, label: 'Error' },
  info: { icon: 'information-circle', color: colors.primary, soft: colors.primarySoft, label: 'Aviso' },
};
const DURATION: Record<ToastKind, number> = { success: 4000, info: 4500, error: 7000 };

function ToastCard({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(1));
  const st = TOAST_STYLE[toast.kind];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: false }).start();
    // Barra inferior que se vacía mientras el aviso sigue en pantalla
    Animated.timing(progress, { toValue: 0, duration: DURATION[toast.kind], useNativeDriver: false }).start();
    const t = setTimeout(() => onClose(toast.id), DURATION[toast.kind]);
    return () => clearTimeout(t);
  }, [anim, progress, onClose, toast.id, toast.kind]);

  return (
    <Animated.View accessibilityRole="alert" style={{
      opacity: anim,
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
      width: '100%', maxWidth: 460, backgroundColor: colors.card, borderRadius: 16, marginBottom: 10,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
      shadowColor: '#0F1E32', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View style={{
          width: 42, height: 42, borderRadius: 21, backgroundColor: st.soft, alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={st.icon} size={26} color={st.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: st.color, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {st.label}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 1 }}>{toast.title}</Text>
          {toast.message ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 }}>{toast.message}</Text>
          ) : null}
        </View>
        <Pressable onPress={() => onClose(toast.id)} hitSlop={10} accessibilityLabel="Cerrar aviso"
          style={({ pressed }) => ({ padding: 4, borderRadius: 999, backgroundColor: pressed ? colors.bg : 'transparent' })}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <View style={{ height: 4, backgroundColor: st.soft }}>
        <Animated.View style={{
          height: 4, backgroundColor: st.color,
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
    </Animated.View>
  );
}

function DialogButton({ text, onPress, variant }: { text: string; onPress: () => void; variant: 'primary' | 'danger' | 'ghost' }) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.card;
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1, flexBasis: 120, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
        backgroundColor: bg, borderWidth: 1, borderColor: variant === 'ghost' ? colors.border : bg, opacity: pressed ? 0.85 : 1,
      })}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: variant === 'ghost' ? colors.text : '#fff' }}>{text}</Text>
    </Pressable>
  );
}

export function DialogHost() {
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  useEffect(() => {
    showConfirm = setReq;
    showToast = (t) => setToasts((ts) => [...ts.slice(-2), t]);
    return () => { showConfirm = null; showToast = null; };
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  const danger = !!req?.danger;

  return (
    <>
      <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable onPress={() => close(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15, 30, 50, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {/* Evita que un toque dentro de la tarjeta la cierre */}
          <Pressable onPress={() => {}} style={{
            width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 18, padding: 22, alignItems: 'center',
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10,
          }}>
            <View style={{
              backgroundColor: danger ? colors.dangerSoft : colors.primarySoft, borderRadius: 999, padding: 14, marginBottom: 12,
            }}>
              <Ionicons name={req?.icon ?? (danger ? 'warning-outline' : 'help-circle-outline')} size={30}
                color={danger ? colors.danger : colors.primary} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{req?.title}</Text>
            {req?.message ? (
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{req.message}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, width: '100%' }}>
              <DialogButton text={req?.cancelText ?? 'Cancelar'} variant="ghost" onPress={() => close(false)} />
              <DialogButton text={req?.confirmText ?? 'Aceptar'} variant={danger ? 'danger' : 'primary'} onPress={() => close(true)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 12, left: 12, right: 12, alignItems: 'center', zIndex: 1000 }}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={dismiss} />
        ))}
      </View>
    </>
  );
}
