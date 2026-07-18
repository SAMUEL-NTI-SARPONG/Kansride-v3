export const colors = {
  // KansRide Brand (inspired by Ghana flag colors)
  primary: '#1B8B4B',
  primaryLight: '#2EAF65',
  primaryDark: '#146B39',
  secondary: '#FFB800',
  secondaryLight: '#FFCC40',
  secondaryDark: '#CC9300',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  background: '#F8FAFB',
  surface: '#FFFFFF',
  border: '#E2E8F0',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Map
  driverMarker: '#1B8B4B',
  passengerMarker: '#3B82F6',
  routeLine: '#1B8B4B',
  pickupPin: '#22C55E',
  dropoffPin: '#EF4444',
} as const;

export type ColorKey = keyof typeof colors;
