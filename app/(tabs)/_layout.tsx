import { Tabs } from 'expo-router';
import {
  Home,
  Search,
  Users,
  BookOpen,
  Bookmark,
  Settings,
  BookMarked,
} from '@blinkdotnew/mobile-ui';
import { Platform } from 'react-native';
import { useTheme, fonts } from '@/constants/theme';

export default function TabLayout() {
  const { t, mode } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.copper,
        tabBarInactiveTintColor: t.inkSubtle,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 64 : 60,
          paddingBottom: 8,
          paddingTop: 6,
          // subtle top shadow
          shadowColor: t.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: -2,
          fontWeight: '600',
          fontFamily: fonts.mono,
          letterSpacing: 0.8,
          textTransform: 'uppercase' as const,
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Today',    tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} /> }} />
      <Tabs.Screen name="search"   options={{ title: 'Find',     tabBarIcon: ({ color, size }) => <Search size={size - 2} color={color} /> }} />
      <Tabs.Screen name="meetings" options={{ title: 'Meetings', tabBarIcon: ({ color, size }) => <BookOpen size={size - 2} color={color} /> }} />
      <Tabs.Screen name="ministry" options={{ title: 'Field',    tabBarIcon: ({ color, size }) => <Users size={size - 2} color={color} /> }} />
      <Tabs.Screen name="study"    options={{ title: 'Study',    tabBarIcon: ({ color, size }) => <BookMarked size={size - 2} color={color} /> }} />
      <Tabs.Screen name="saved"    options={{ title: 'Library',  tabBarIcon: ({ color, size }) => <Bookmark size={size - 2} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} /> }} />
    </Tabs>
  );
}
