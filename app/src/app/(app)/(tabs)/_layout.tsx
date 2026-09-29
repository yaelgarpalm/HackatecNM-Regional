import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Pressable, Text, View, type ColorValue } from 'react-native';

import { useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import type { IconName } from '@/components/ui';
import { isAcademic, useUser } from '@/lib/auth';
import type { Notification, Page } from '@/lib/types';

function icon(name: IconName) {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
  return TabIcon;
}

function BellButton() {
  const { data } = useApi<Page<Notification>>('/users/me/notifications', { unread_only: true, size: 1 }, {
    refetchInterval: 30_000,
  });
  const unread = data?.total ?? 0;
  return (
    <Pressable onPress={() => router.push('/notificaciones')} style={{ marginRight: 16 }} accessibilityLabel="Notificaciones">
      <Ionicons name="notifications-outline" size={24} color="#fff" />
      {unread > 0 && (
        <View
          style={{
            position: 'absolute', top: -4, right: -8, backgroundColor: colors.accent, borderRadius: 9,
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
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="retos" options={{ title: 'Retos', tabBarIcon: icon('bulb-outline') }} />
      <Tabs.Screen
        name="equipos"
        options={{ title: 'Equipos', tabBarIcon: icon('people-outline'), href: academic ? undefined : null }}
      />
      <Tabs.Screen name="capacidades" options={{ title: 'Capacidades', tabBarIcon: icon('flask-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
