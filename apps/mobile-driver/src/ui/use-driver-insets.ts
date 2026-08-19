import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@kansride/ui';

export function useDriverInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top + spacing.md,
    bottom: insets.bottom + spacing.xl,
    compactBottom: insets.bottom + spacing.md,
  };
}
