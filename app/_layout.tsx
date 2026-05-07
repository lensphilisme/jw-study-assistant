import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BlinkProvider, createTamagui, tamaguiDefaultConfig, Theme, BlinkToastProvider } from '@blinkdotnew/mobile-ui';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

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
        __html: 'input:focus,textarea:focus{outline:none!important}',
      }}
    />
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <BlinkProvider config={config} defaultTheme="dark">
      <Theme name="dark">
        <QueryClientProvider client={queryClient}>
          <BlinkToastProvider>
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
            <StatusBar style="auto" />
          </BlinkToastProvider>
        </QueryClientProvider>
      </Theme>
    </BlinkProvider>
  );
}
