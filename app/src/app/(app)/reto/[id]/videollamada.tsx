import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useAction, useApi } from '@/components/hooks';
import { MeetingFrame } from '@/components/MeetingFrame';
import { colors } from '@/components/theme';
import { Body, Button, Card, ErrorView, Loading, Muted, Screen, Section, Title } from '@/components/ui';
import { useUser } from '@/lib/auth';
import { api } from '@/lib/api';

type Room = { room: string; url: string; display_name: string; active: boolean };

export default function Videollamada() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const isCompany = user.role === 'empresa';
  const q = useApi<Room>(`/challenges/${id}/videocall`, undefined, { refetchInterval: 5_000 });
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const startCall = useAction(() => api.post<Room>(`/challenges/${id}/videocall/start`), {
    successMessage: 'Videollamada iniciada',
    successDetail: 'Se notificó al equipo del proyecto.',
    onSuccess: () => { setError(false); setLoading(true); setStarted(true); },
  });
  const endCall = useAction(() => api.post(`/challenges/${id}/videocall/end`));

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorView error={q.error} onRetry={q.refetch} /></Screen>;
  const { room, url, display_name, active } = q.data;
  const meetingUrl = `${url}#userInfo.displayName=${encodeURIComponent(JSON.stringify(display_name))}`
    + '&config.prejoinPageEnabled=false&config.defaultLanguage="es"';

  const leave = async () => {
    try {
      if (isCompany) await endCall.mutateAsync(undefined).catch(() => undefined);
    } finally {
      setStarted(false);
      router.replace(`/reto/${id}`);
    }
  };

  if (started && (isCompany || active)) {
    return (
      <View style={styles.meeting}>
        <Stack.Screen options={{ title: 'Videollamada', headerShown: true }} />
        {loading && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
            <Muted style={styles.loadingText}>Conectando con la sala…</Muted>
          </View>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={isCompany ? 'Finalizar y volver al proyecto' : 'Salir y volver al proyecto'}
          onPress={leave} disabled={endCall.isPending} style={styles.leave}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Body style={styles.leaveText}>{endCall.isPending ? 'Finalizando…' : isCompany ? 'Finalizar y volver' : 'Volver al proyecto'}</Body>
        </Pressable>
        {error && (
          <View style={styles.errorOverlay}>
            <Card>
              <Title>No se pudo cargar la videollamada</Title>
              <Muted style={{ marginTop: 6 }}>Comprueba tu conexión a internet e intenta entrar nuevamente.</Muted>
              <Button title="Reintentar" icon="refresh" onPress={() => { setError(false); setLoading(true); setAttempt((a) => a + 1); }} style={{ marginTop: 12 }} />
              <Button title="Volver al proyecto" variant="secondary" onPress={() => { setStarted(false); router.replace(`/reto/${id}`); }} style={{ marginTop: 8 }} />
            </Card>
          </View>
        )}
        <MeetingFrame key={attempt} url={meetingUrl}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }} />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Videollamada' }} />
      <View style={styles.hero}>
        <View style={styles.iconCircle}><Ionicons name="videocam" size={34} color={colors.primary} /></View>
        <Title style={styles.title}>Videollamada empresa - alumno</Title>
        <Muted style={styles.center}>Espacio de comunicación para revisar la problemática, aclarar dudas y dar seguimiento al proyecto.</Muted>
      </View>
      <Section title="Sala de reunión">
        <Card>
          <Body style={styles.label}>Sala asignada</Body>
          <Body style={styles.room}>{room}</Body>
          {!isCompany && !active ? (
            <Muted style={{ marginTop: 10 }}>La sala aún no está abierta. Te avisaremos cuando la empresa inicie la videollamada.</Muted>
          ) : null}
          {isCompany ? (
            <Button title={active ? 'Entrar a la videollamada' : 'Iniciar videollamada'} icon="videocam-outline"
              loading={!active && startCall.isPending} disabled={!active && startCall.isPending}
              onPress={() => active
                ? (setError(false), setLoading(true), setStarted(true))
                : startCall.mutate(undefined)} style={{ marginTop: 14 }} />
          ) : active ? (
            <Button title="Unirme a la videollamada" icon="videocam-outline"
              onPress={() => { setError(false); setLoading(true); setStarted(true); }} style={{ marginTop: 14 }} />
          ) : null}
          {Platform.OS === 'web' && active && (
            <Button title="Abrir en una pestaña nueva" variant="secondary" icon="open-outline"
              onPress={() => Linking.openURL(meetingUrl)} style={{ marginTop: 8 }} />
          )}
        </Card>
      </Section>
      <Section title="Antes de entrar">
        <Card>
          <View style={styles.tip}><Ionicons name="mic-outline" size={20} color={colors.primary} /><Body style={styles.tipText}>Permite el acceso al micrófono y la cámara cuando el dispositivo lo solicite.</Body></View>
          <View style={styles.tip}><Ionicons name="wifi-outline" size={20} color={colors.primary} /><Body style={styles.tipText}>Utiliza una conexión estable a internet.</Body></View>
          <View style={styles.tip}><Ionicons name="lock-closed-outline" size={20} color={colors.primary} /><Body style={styles.tipText}>No compartas información confidencial fuera de los participantes autorizados.</Body></View>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meeting: { flex: 1, backgroundColor: '#000' },
  loading: { position: 'absolute', zIndex: 2, top: 0, left: 0, right: 0, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  loadingText: { marginTop: 6 },
  leave: { position: 'absolute', zIndex: 4, top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: 'rgba(30,30,30,0.85)' },
  leaveText: { color: '#fff', fontWeight: '700' },
  errorOverlay: { position: 'absolute', zIndex: 3, left: 16, right: 16, top: '25%' },
  hero: { alignItems: 'center', paddingVertical: 12 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { textAlign: 'center' },
  center: { textAlign: 'center', marginTop: 6 },
  label: { fontWeight: '700', marginBottom: 6 },
  room: { fontSize: 15, fontWeight: '600', color: colors.primary, backgroundColor: colors.bg, padding: 10, borderRadius: 8 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  tipText: { flex: 1 },
});
