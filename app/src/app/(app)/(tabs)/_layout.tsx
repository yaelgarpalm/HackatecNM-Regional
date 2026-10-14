import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi } from '@/components/hooks';
import { colors } from '@/components/theme';
import { blurFocusedElementOnWeb, type IconName } from '@/components/ui';
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
    refetchInterval: 5_000,
  });
  const unread = data?.total ?? 0;
  return (
    <Pressable onPress={() => { blurFocusedElementOnWeb(); router.push('/notificaciones'); }} style={{ marginRight: 16, padding: 4 }}
      accessibilityRole="button" accessibilityLabel="Notificaciones">
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const academic = isAcademic(user);
  const isPublisher = user.role === 'empresa' || user.role === 'gobierno';
  const mobile = width < 760;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        headerRight: () => <BellButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: width < 380 ? 10 : 11, fontWeight: '700' },
        tabBarItemStyle: { paddingVertical: 4, minWidth: 0 },
        tabBarStyle: mobile ? {
          position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 8) + 8,
          height: 70, paddingTop: 7, paddingBottom: 7,
          backgroundColor: colors.card, borderTopWidth: 0, borderWidth: 1, borderColor: colors.border,
          borderRadius: 24, boxShadow: '0px 8px 22px rgba(23, 61, 58, 0.12)',
        } : {
          height: 62, paddingTop: 5, paddingBottom: 5,
          backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen
        name="retos"
        options={{
          title: isPublisher ? 'Mis Retos' : 'Retos',
          tabBarIcon: icon('bulb-outline'),
          tabBarAccessibilityLabel: isPublisher ? 'Mis retos' : 'Oportunidades y retos',
        }}
      />
      <Tabs.Screen
        name="equipos"
        options={{
          title: user.role === 'estudiante' ? 'Mi Equipo' : 'Equipos',
          tabBarIcon: icon('people-outline'),
          href: academic ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="capacidades"
        options={{
          title: 'Capacidades',
          tabBarIcon: icon('flask-outline'),
        }}
      />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
