import { useEffect } from 'react';
import { Platform } from 'react-native';

// Framework ready callback for web preview integration
// Only works on web platform, safely ignored on native
export function useFrameworkReady() {
  useEffect(() => {
    // Only call on web platform where window exists
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).frameworkReady?.();
    }
  }, []);
}
