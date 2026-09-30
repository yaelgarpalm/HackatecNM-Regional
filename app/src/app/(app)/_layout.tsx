import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { colors } from '@/components/theme';
import { goHome } from '@/lib/format';

function HomeButton() {
  return (
    <Pressable onPress={goHome} accessibilityLabel="Ir al inicio" hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12, paddingVertical: 6, paddingHorizontal: 12,
        borderRadius: 999, backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)',
      })}>
      <Ionicons name="home-outline" size={17} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Inicio</Text>
    </Pressable>
  );
}

/** Todas las pantallas que requieren sesión. */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackTitle: 'Atrás',
        headerRight: () => <HomeButton />,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
