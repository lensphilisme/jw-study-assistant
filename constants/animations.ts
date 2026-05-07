/**
 * Animation Constants
 *
 * Centralized animation configurations for consistent motion design.
 * Based on v0 iOS app patterns using react-native-reanimated.
 *
 * USAGE:
 * import { animationDurations, animationTimings, animationEasing } from '@/constants/animations';
 *
 * withTiming(value, { duration: animationDurations.normal, easing: animationEasing.easeInOut })
 */

import { Easing } from 'react-native-reanimated';

// ============================================================================
// DURATIONS (in milliseconds)
// ============================================================================

/**
 * Standard animation durations
 * Based on Material Design and iOS Human Interface Guidelines
 */
export const animationDurations = {
  instant: 0,
  fast: 150,
  normal: 250,
  moderate: 350,
  slow: 500,
  verySlow: 700,
};

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Spring physics configurations for natural motion
 * Higher damping = less bounce
 * Higher stiffness = faster spring
 */
export const animationTimings = {
  // Gentle spring - Subtle, smooth animations
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },

  // Bouncy spring - Playful, energetic animations
  springBouncy: {
    damping: 15,
    stiffness: 400,
    mass: 1,
  },

  // Snappy spring - Quick, responsive animations
  springSnappy: {
    damping: 25,
    stiffness: 500,
    mass: 0.8,
  },

  // Soft spring - Smooth, subtle animations
  springSoft: {
    damping: 30,
    stiffness: 200,
    mass: 1.2,
  },

  // Stiff spring - Minimal bounce, fast
  springStiff: {
    damping: 35,
    stiffness: 600,
    mass: 0.6,
  },
};

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

/**
 * Easing curves for timing-based animations
 */
export const animationEasing = {
  // Linear - Constant speed (rarely used)
  linear: Easing.linear,

  // Ease - Smooth acceleration and deceleration
  ease: Easing.ease,

  // Ease In - Starts slow, ends fast
  easeIn: Easing.in(Easing.ease),

  // Ease Out - Starts fast, ends slow (most common)
  easeOut: Easing.out(Easing.ease),

  // Ease In Out - Slow start and end, fast middle
  easeInOut: Easing.inOut(Easing.ease),

  // Cubic Bezier - Custom curves
  cubic: Easing.bezier(0.4, 0.0, 0.2, 1),

  // Anticipate - Brief back motion before forward
  anticipate: Easing.bezier(0.36, 0, 0.66, -0.56),

  // Overshoot - Goes past target, then settles
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
};

// ============================================================================
// ANIMATION PATTERNS
// ============================================================================

/**
 * Common animation patterns with duration + easing
 */
export const animationPatterns = {
  // Fade in/out
  fade: {
    duration: animationDurations.normal,
    easing: animationEasing.easeInOut,
  },

  // Slide in/out
  slide: {
    duration: animationDurations.moderate,
    easing: animationEasing.easeOut,
  },

  // Scale/zoom
  scale: {
    duration: animationDurations.normal,
    easing: animationEasing.easeOut,
  },

  // Button press
  press: {
    duration: animationDurations.fast,
    easing: animationEasing.easeOut,
  },

  // Modal appear/dismiss
  modal: {
    duration: animationDurations.moderate,
    easing: animationEasing.easeInOut,
  },

  // Tab switch
  tab: {
    duration: animationDurations.normal,
    easing: animationEasing.easeInOut,
  },

  // Bottom sheet
  bottomSheet: {
    duration: animationDurations.moderate,
    easing: animationEasing.easeOut,
  },

  // Skeleton shimmer
  shimmer: {
    duration: 1500,
    easing: animationEasing.linear,
  },
};

// ============================================================================
// STAGGER DELAYS
// ============================================================================

/**
 * Delays for staggered animations (e.g., list items appearing)
 * Based on v0's 32ms stagger pattern
 */
export const staggerDelays = {
  none: 0,
  fast: 16,
  normal: 32,
  slow: 50,
  verySlow: 100,
};

// ============================================================================
// GESTURE THRESHOLDS
// ============================================================================

/**
 * Thresholds for gesture-based animations
 */
export const gestureThresholds = {
  // Pan gesture velocity threshold (points per second)
  swipeVelocity: 250,
  swipeVelocityFast: 500,
  swipeVelocitySlow: 150,

  // Pan gesture distance threshold (points)
  swipeDistance: 50,
  swipeDistanceFar: 100,
  swipeDistanceNear: 25,

  // Scale gesture threshold
  pinchScale: 0.1,

  // Rotation gesture threshold (radians)
  rotationAngle: 0.1,
};

// ============================================================================
// ANIMATION POOL CONFIG
// ============================================================================

/**
 * Animation pool configuration (v0 pattern)
 * Limits concurrent animations to prevent performance issues
 */
export const animationPool = {
  // Maximum concurrent animated nodes
  maxConcurrent: 4,

  // Stagger delay between batches (ms)
  staggerDelay: 32,

  // Batch sizes based on queue depth
  batchSizeSmall: 2,
  batchSizeMedium: 4,
  batchSizeLarge: 10,
};

// ============================================================================
// KEYBOARD ANIMATION
// ============================================================================

/**
 * Keyboard animation configuration
 */
export const keyboardAnimation = {
  // iOS keyboard animation duration (Apple's default)
  ios: 250,

  // Android keyboard animation duration
  android: 200,

  // Easing for keyboard animations
  easing: animationEasing.easeInOut,
};

// ============================================================================
// HELPER CONSTANTS
// ============================================================================

/**
 * Common animation values
 */
export const animationValues = {
  // Scale values
  scalePressed: 0.95,
  scaleHovered: 1.05,
  scaleExpanded: 1.1,

  // Opacity values
  opacityHidden: 0,
  opacityVisible: 1,
  opacityDisabled: 0.4,
  opacityPressed: 0.7,

  // Rotation values (degrees)
  rotationQuarter: 90,
  rotationHalf: 180,
  rotationFull: 360,

  // Translation values (points)
  translateSmall: 4,
  translateMedium: 8,
  translateLarge: 16,
};

// ============================================================================
// ANIMATION DEFAULTS
// ============================================================================

/**
 * Default animation configuration
 * Use when no specific animation is needed
 */
export const defaultAnimation = {
  duration: animationDurations.normal,
  easing: animationEasing.easeOut,
};

/**
 * Default spring configuration
 * Use for most spring-based animations
 */
export const defaultSpring = animationTimings.spring;
