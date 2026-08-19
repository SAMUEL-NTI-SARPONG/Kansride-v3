export const colors = {
  // KansRide brand — deep teal stays legible in bright outdoor conditions.
  primary: '#075E59',
  primaryLight: '#148078',
  primaryDark: '#03423F',
  primarySoft: '#DCEDEA',
  primarySoftBorder: '#BBD7D2',
  secondary: '#E4A94F',
  secondaryLight: '#F3D69B',
  secondaryDark: '#A96C18',

  // Semantic
  success: '#287A55',
  successSoft: '#E2F1E8',
  successBorder: '#BFDDCB',
  warning: '#B66A16',
  warningSoft: '#FFF1D8',
  warningBorder: '#E9CC98',
  error: '#B6423A',
  errorSoft: '#FBE8E5',
  errorBorder: '#E8C2BD',
  info: '#236B8E',
  infoSoft: '#E2F0F5',
  infoBorder: '#BEDDE8',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  background: '#F6F0E6',
  backgroundDeep: '#EDE4D7',
  surface: '#FFFDF8',
  surfaceRaised: '#FFFAF1',
  surfaceTranslucent: 'rgba(255, 253, 248, 0.94)',
  surfaceInset: '#EEE6DA',
  border: '#DDD3C4',
  borderStrong: '#C7BAA7',
  overlay: 'rgba(18, 37, 35, 0.46)',

  // Text
  textPrimary: '#142F2C',
  textSecondary: '#4D625D',
  textMuted: '#6E7E79',
  disabledSurface: '#E2DBCF',
  disabledBorder: '#C9BFB0',
  disabledText: '#65736F',
  textInverse: '#FFFFFF',

  // Map
  driverMarker: '#075E59',
  passengerMarker: '#236B8E',
  routeLine: '#075E59',
  pickupPin: '#287A55',
  dropoffPin: '#B6423A',
} as const;

export type ColorKey = keyof typeof colors;
