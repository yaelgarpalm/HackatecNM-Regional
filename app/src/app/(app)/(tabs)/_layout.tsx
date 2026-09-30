import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Pressable, Text, View, type ColorValue } from 'react-native';

import { useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import type { IconName } from '@/components/ui';
import { isAcademic, useUser } from '@/lib/auth';
import type { Notification, Page } from '@/lib/types';

/** Ícono relleno en la pestaña activa y de contorno en las demás: se ve dónde estás sin depender solo del color. */
function icon(name: string) {
  const TabIcon = ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={(focused ? name : `${name}-outline`) as IconName} color={color as string} size={size} />
  );
  return TabIcon;
}

function BellButton() {
  const { data } = useApi<Page<Notification>>('/users/me/notifications', { unread_only: true, size: 1 }, {
    refetchInterval: 5_000,
  });
  const unread = data?.total ?? 0;
  return (
    <Pressable onPress={() => router.push('/notificaciones')} hitSlop={10} accessibilityRole="button"
      accessibilityLabel={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      style={({ pressed }) => ({ marginRight: 12, padding: 6, borderRadius: 999, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name="notifications-outline" size={24} color="#fff" />
      {unread > 0 && (
        <View
          style={{
            position: 'absolute', top: 0, right: -2, backgroundColor: colors.accent, borderRadius: 9,
            minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const user = useUser();
  const academic = isAcademic(user);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <BellButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="retos" options={{ title: 'Problemáticas', tabBarLabel: 'Problemas', tabBarIcon: icon('bulb') }} />
      <Tabs.Screen
        name="equipos"
        options={{ title: 'Equipos', tabBarIcon: icon('people'), href: academic ? undefined : null }}
      />
      <Tabs.Screen name="capacidades" options={{ title: 'Capacidades', tabBarLabel: 'Recursos', tabBarIcon: icon('flask') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
