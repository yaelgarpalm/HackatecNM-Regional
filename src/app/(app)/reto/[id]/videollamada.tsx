import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/theme';
import { Body, Button, Card, Muted, Screen, Section, Title } from '@/components/ui';

const JITSI_BASE_URL = 'https://meet.jit.si/';

export default function Videollamada() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const room = `VinculaTec-Problematica-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const meetingUrl = `${JITSI_BASE_URL}${room}`;

  const joinMeeting = async () => {
    const supported = await Linking.canOpenURL(meetingUrl);
    if (supported) await Linking.openURL(meetingUrl);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Videollamada' }} />

      <View style={styles.hero}>
        <View style={styles.iconCircle}>
          <Ionicons name="videocam" size={34} color={colors.primary} />
        </View>
        <Title style={styles.title}>Videollamada empresa - alumno</Title>
        <Muted style={styles.center}>
          Espacio de comunicación para revisar la problemática, aclarar dudas y dar seguimiento al proyecto.
        </Muted>
      </View>

      <Section title="Sala de reunión">
        <Card>
          <Body style={styles.label}>Sala asignada</Body>
          <Text selectable style={styles.room}>{room}</Text>
          <Muted style={{ marginTop: 8 }}>
            La empresa y el alumno deben entrar a esta misma sala para comunicarse por audio y video.
          </Muted>
          <Button
            title="Entrar a la videollamada"
            icon="videocam-outline"
            onPress={joinMeeting}
            style={{ marginTop: 14 }}
          />
        </Card>
      </Section>

      <Section title="Antes de entrar">
        <Card>
          <View style={styles.tip}>
            <Ionicons name="mic-outline" size={20} color={colors.primary} />
            <Body style={styles.tipText}>Comprueba que el micrófono y la cámara tengan permiso.</Body>
          </View>
          <View style={styles.tip}>
            <Ionicons name="wifi-outline" size={20} color={colors.primary} />
            <Body style={styles.tipText}>Utiliza una conexión estable a internet.</Body>
          </View>
          <View style={styles.tip}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <Body style={styles.tipText}>No compartas información confidencial fuera de los participantes autorizados.</Body>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 12 },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { textAlign: 'center' },
  center: { textAlign: 'center', marginTop: 6 },
  label: { fontWeight: '700', marginBottom: 6 },
  room: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.bg,
    padding: 10,
    borderRadius: 8,
  },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  tipText: { flex: 1 },
});
