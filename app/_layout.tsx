import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BlinkProvider, createTamagui, tamaguiDefaultConfig, Theme, BlinkToastProvider } from '@blinkdotnew/mobile-ui';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useTheme } from '@/constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

const config = createTamagui({ ...tamaguiDefaultConfig });

// Inject Google Fonts + selection styling on web
function WebGlobalStyles() {
  if (Platform.OS !== 'web') return null;
  return (
    <>
      {/* Google Fonts: Fraunces, Inter Tight, JetBrains Mono */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Inter+Tight:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { margin: 0; padding: 0; }
            input:focus, textarea:focus { outline: none !important; }
            * { -webkit-tap-highlight-color: transparent; }
            ::selection { background: rgba(220,159,98,0.30); color: inherit; }
            body { font-family: "Inter Tight", -apple-system, system-ui, sans-serif; }
            .codex-grain {
              background-image: radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px);
              background-size: 3px 3px;
            }
          `,
        }}
      />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const { t, mode, hydrate } = useTheme();

  useEffect(() => { hydrate(); }, []);

  return (
    <BlinkProvider config={config} defaultTheme={mode}>
      <Theme name={mode}>
        <QueryClientProvider client={queryClient}>
          <BlinkToastProvider>
            <WebGlobalStyles />
            <View style={{ flex: 1, backgroundColor: t.bg }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
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
            </View>
            <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
          </BlinkToastProvider>
        </QueryClientProvider>
      </Theme>
    </BlinkProvider>
  );
}
