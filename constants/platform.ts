/**
 * Platform-Specific Constants
 *
 * Platform-specific values for iOS, Android, and Web.
 * Handles differences in UI conventions and system behaviors.
 *
 * USAGE:
 * import { platformSpacing, platformBehavior, isIOS, isAndroid, isWeb } from '@/constants/platform';
 *
 * const headerHeight = platformSpacing.headerHeight;
 */

import { Platform, Dimensions, StatusBar } from 'react-native';

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

/**
 * Platform detection flags
 */
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

// ============================================================================
// DEVICE DIMENSIONS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const deviceDimensions = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,

  // Breakpoints for responsive design
  isSmallDevice: SCREEN_WIDTH < 375,
  isMediumDevice: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
  isLargeDevice: SCREEN_WIDTH >= 414,
};

// ============================================================================
// PLATFORM SPACING
// ============================================================================

/**
 * Platform-specific spacing values
 */
export const platformSpacing = {
  // Status bar height
  statusBarHeight: Platform.select({
    ios: 44,       // iPhone with notch/Dynamic Island
    android: StatusBar.currentHeight ?? 24,
    default: 0,
  }),

  // Header/Navigation bar height
  headerHeight: Platform.select({
    ios: 44,
    android: 56,
    default: 56,
  }),

  // Tab bar height
  tabBarHeight: Platform.select({
    ios: 49,       // iOS standard tab bar
    android: 56,   // Material Design bottom navigation
    default: 56,
  }),

  // Safe area insets (for devices without SafeAreaView)
  safeAreaTop: Platform.select({
    ios: 44,
    android: 0,
    default: 0,
  }),

  safeAreaBottom: Platform.select({
    ios: 34,       // iPhone with home indicator
    android: 0,
    default: 0,
  }),

  // Keyboard height (approximate)
  keyboardHeight: Platform.select({
    ios: 291,      // iPhone keyboard height (landscape)
    android: 280,
    default: 0,
  }),
};

// ============================================================================
// PLATFORM BEHAVIOR
// ============================================================================

/**
 * Platform-specific behaviors
 */
export const platformBehavior = {
  // Keyboard avoiding view behavior
  keyboardBehavior: Platform.select({
    ios: 'padding' as const,
    android: 'height' as const,
    default: 'padding' as const,
  }),

  // Modal presentation style
  modalPresentationStyle: Platform.select({
    ios: 'formSheet' as const,
    android: 'fullScreen' as const,
    default: 'fullScreen' as const,
  }),

  // Haptic feedback availability
  hasHaptics: Platform.select({
    ios: true,
    android: true,
    web: false,
    default: false,
  }),

  // Camera availability
  hasCamera: Platform.select({
    ios: true,
    android: true,
    web: false,
    default: false,
  }),

  // Local authentication (Face ID, Touch ID)
  hasLocalAuth: Platform.select({
    ios: true,
    android: true,
    web: false,
    default: false,
  }),

  // Gesture navigation (iOS swipe back)
  hasGestureNavigation: Platform.select({
    ios: true,
    android: false,
    default: false,
  }),
};

// ============================================================================
// PLATFORM STYLING
// ============================================================================

/**
 * Platform-specific styling values
 */
export const platformStyling = {
  // Shadow vs elevation
  useShadow: Platform.select({
    ios: true,
    android: false,
    web: true,
    default: true,
  }),

  useElevation: Platform.select({
    ios: false,
    android: true,
    web: false,
    default: false,
  }),

  // Font scaling
  allowFontScaling: true,

  // Maximum font size multiplier
  maxFontSizeMultiplier: 1.3,

  // Text selection color
  selectionColor: Platform.select({
    ios: '#3B82F6',
    android: '#3B82F6',
    default: '#3B82F6',
  }),
};

// ============================================================================
// PLATFORM ANIMATION
// ============================================================================

/**
 * Platform-specific animation values
 */
export const platformAnimation = {
  // Use native driver
  useNativeDriver: Platform.select({
    ios: true,
    android: true,
    web: false,
    default: false,
  }),

  // Keyboard animation duration
  keyboardAnimationDuration: Platform.select({
    ios: 250,
    android: 200,
    default: 250,
  }),

  // Modal animation
  modalAnimationType: Platform.select({
    ios: 'slide' as const,
    android: 'fade' as const,
    default: 'slide' as const,
  }),
};

// ============================================================================
// PLATFORM TOUCH TARGETS
// ============================================================================

/**
 * Platform-specific minimum touch target sizes
 */
export const platformTouchTargets = {
  minimum: Platform.select({
    ios: 44,       // iOS HIG: 44x44 points
    android: 48,   // Material Design: 48x48dp
    default: 44,
  }),

  comfortable: Platform.select({
    ios: 48,
    android: 56,
    default: 48,
  }),
};

// ============================================================================
// PLATFORM CONSTANTS
// ============================================================================

/**
 * Other platform-specific constants
 */
export const platformConstants = {
  // Platform version
  version: Platform.Version,

  // Is testing environment
  isTesting: Platform.select({
    ios: false,
    android: false,
    web: false,
    default: false,
  }),

  // Select value based on platform
  select: Platform.select,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get platform-specific value
 * @param ios - Value for iOS
 * @param android - Value for Android
 * @param web - Value for Web
 */
export const getPlatformValue = <T,>(
  ios: T,
  android: T,
  web?: T
): T => {
  return Platform.select({
    ios,
    android,
    web: web ?? android,
    default: android,
  }) as T;
};

/**
 * Check if running on physical device (not simulator/emulator)
 */
export const isPhysicalDevice = (): boolean => {
  // This would require expo-device or similar
  // For now, return true (assume physical device)
  return true;
};

/**
 * Get safe header height including status bar
 */
export const getSafeHeaderHeight = (): number => {
  return platformSpacing.statusBarHeight + platformSpacing.headerHeight;
};

/**
 * Get safe tab bar height including home indicator
 */
export const getSafeTabBarHeight = (): number => {
  return platformSpacing.tabBarHeight + (isIOS ? platformSpacing.safeAreaBottom : 0);
};
