import { Link } from 'expo-router';
import { YStack, SizableText, Button } from '@blinkdotnew/mobile-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFound() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        gap="$4"
        padding="$6"
      >
        <SizableText size="$10" color="$color5">🔍</SizableText>
        <SizableText
          size="$8"
          fontWeight="800"
          color="$color12"
          textAlign="center"
        >
          404
        </SizableText>
        <SizableText
          size="$6"
          color="$color9"
          textAlign="center"
        >
          Page Not Found
        </SizableText>
        <SizableText
          size="$3"
          color="$color7"
          textAlign="center"
          maxWidth={280}
        >
          The page you're looking for doesn't exist or has been moved.
        </SizableText>
        <Link href="/(tabs)" asChild>
          <Button
            backgroundColor="#5B7E6B"
            color="white"
            size="$4"
            borderRadius="$4"
            marginTop="$2"
            pressStyle={{ opacity: 0.8 }}
          >
            Go to Home
          </Button>
        </Link>
      </YStack>
    </SafeAreaView>
  );
}
