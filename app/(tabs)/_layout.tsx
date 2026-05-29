import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Home,
  Search,
  Users,
  BookOpen,
  Bookmark,
  Settings,
  BookMarked,
} from '@blinkdotnew/mobile-ui';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

export default function TabLayout() {
  const appLanguage = useAppStore((s) => s.appLanguage);
  const displaySymbol = appLanguage?.symbol || 'en';
  const colors = usePremiumTheme();

  const tabBarBackground = () => {
    if (Platform.OS === 'web') {
      return null;
    }
    return (
      <BlurView
        intensity={80}
        tint={colors.mode === 'dark' ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarBackground: tabBarBackground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'web'
            ? colors.mode === 'dark' ? 'rgba(14,20,34,0.95)' : 'rgba(255,253,248,0.95)'
            : 'transparent',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 10,
          paddingHorizontal: 4,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } as any : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 2,
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: translate(displaySymbol, 'today'),
          tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: translate(displaySymbol, 'find'),
          tabBarIcon: ({ color, size }) => <Search size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: translate(displaySymbol, 'meetings'),
          tabBarIcon: ({ color, size }) => <BookOpen size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="ministry"
        options={{
          title: translate(displaySymbol, 'field'),
          tabBarIcon: ({ color, size }) => <Users size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: translate(displaySymbol, 'study'),
          tabBarIcon: ({ color, size }) => <BookMarked size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: translate(displaySymbol, 'library'),
          tabBarIcon: ({ color, size }) => <Bookmark size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: translate(displaySymbol, 'settings'),
          tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}
