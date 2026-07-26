import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppContext } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationsContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { savedToolIds } = useAppContext();
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
          backgroundColor: theme.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'اكتشف',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="explore" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'تصفح',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="category" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'المحفوظات',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="bookmark" size={size} color={color} />,
          tabBarBadge: savedToolIds.length > 0 ? savedToolIds.length : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.primary, fontSize: 10, fontWeight: '700', minWidth: 18, height: 18, lineHeight: 18 },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'إشعارات',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', fontSize: 10, fontWeight: '700', minWidth: 18, height: 18, lineHeight: 18 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
