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
const TOAST_STYLE: Record<ToastKind, { icon: IconName; color: string; soft: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success, soft: colors.successSoft },
  error: { icon: 'alert-circle', color: colors.danger, soft: colors.dangerSoft },
  info: { icon: 'information-circle', color: colors.primary, soft: colors.primarySoft },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const [anim] = useState(() => new Animated.Value(0));
  const st = TOAST_STYLE[toast.kind];

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    const t = setTimeout(() => onClose(toast.id), toast.kind === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [anim, onClose, toast.id, toast.kind]);

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, width: '100%', maxWidth: 440,
      backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, marginBottom: 8,
      borderLeftWidth: 5, borderLeftColor: st.color, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    }}>
      <View style={{ backgroundColor: st.soft, borderRadius: 999, padding: 6 }}>
        <Ionicons name={st.icon} size={20} color={st.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{toast.title}</Text>
        {toast.message ? <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{toast.message}</Text> : null}
      </View>
      <Pressable onPress={() => onClose(toast.id)} hitSlop={8} accessibilityLabel="Cerrar aviso">
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
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
