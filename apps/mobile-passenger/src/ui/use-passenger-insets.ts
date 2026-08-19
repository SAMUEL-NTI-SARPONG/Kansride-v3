import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@kansride/ui';

/**
 * Shared device-aware spacing for Passenger screens. The navigator owns the
 * tab-bar height; screens use these values to keep their first and last
 * interactive elements clear of device cutouts and system navigation.
 */
export function usePassengerInsets() {
  const insets = useSafeAreaInsets();

  return {
    top: insets.top + spacing.md,
    bottom: insets.bottom + spacing.xl,
    compactBottom: insets.bottom + spacing.md,
  };
}
