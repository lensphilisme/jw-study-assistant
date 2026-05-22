import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BlinkProvider, createTamagui, tamaguiDefaultConfig, Theme, BlinkToastProvider } from '@blinkdotnew/mobile-ui';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { DISPLAY_LANGUAGES, readAppLanguage, readContentLanguage } from '@/services/i18nService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const config = createTamagui({ ...tamaguiDefaultConfig });

function WebStyleReset() {
  if (Platform.OS !== 'web') return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Newsreader:opsz,wght@6..72,600;6..72,700;6..72,800&display=swap');
          *{box-sizing:border-box}
          html,body,#root{min-height:100%;background:#070A12}
          body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
          input:focus,textarea:focus{outline:none!important}
        `,
      }}
    />
  );
}

function LanguageHydrator() {
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setAppLanguage = useAppStore((s) => s.setAppLanguage);
  const setContentLanguage = useAppStore((s) => s.setContentLanguage);

  useEffect(() => {
    let mounted = true;
    Promise.all([readAppLanguage(), readContentLanguage()]).then(([display, content]) => {
      if (!mounted) return;
      const appLang = display ?? DISPLAY_LANGUAGES[0];
      const contentLang = content ?? appLang;
      setAppLanguage(appLang);
      setContentLanguage(contentLang);
      setLanguage(contentLang);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [setAppLanguage, setContentLanguage, setLanguage]);

  return null;
}

function ThemeHydrator() {
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:theme')
      .then((raw) => {
        if (raw === 'light' || raw === 'dark' || raw === 'system') setTheme(raw);
      })
      .catch(() => {});
  }, [setTheme]);

  return null;
}

function AppShell() {
  const theme = useAppStore((s) => s.theme);
  const resolvedTheme = theme === 'light' ? 'light' : 'dark';

  return (
    <BlinkProvider config={config} defaultTheme={resolvedTheme}>
      <Theme name={resolvedTheme}>
        <QueryClientProvider client={queryClient}>
          <BlinkToastProvider>
            <LanguageHydrator />
            <ThemeHydrator />
            <WebStyleReset />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="daily-text" />
              <Stack.Screen name="meeting-prep" />
              <Stack.Screen name="watchtower-study" />
              <Stack.Screen name="add-contact" />
              <Stack.Screen name="contact-detail" />
              <Stack.Screen name="edit-profile" />
              <Stack.Screen name="study-plan-detail" />
              <Stack.Screen name="add-visit" />
              <Stack.Screen name="ministry-prep" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style={resolvedTheme === 'light' ? 'dark' : 'light'} />
          </BlinkToastProvider>
        </QueryClientProvider>
      </Theme>
    </BlinkProvider>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return <AppShell />;
}
