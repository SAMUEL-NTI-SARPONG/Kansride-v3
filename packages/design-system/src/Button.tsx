import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { colors } from './colors';
import { borderRadius, spacing, typography } from './theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 44, md: 50, lg: 56 };

const getVariantStyles = (variant: ButtonVariant): { container: ViewStyle; text: TextStyle } => {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: colors.primary },
        text: { color: colors.textInverse },
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.secondary },
        text: { color: colors.textPrimary },
      };
    case 'outline':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
        text: { color: colors.primary },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: colors.primary },
      };
    case 'danger':
      return {
        container: { backgroundColor: colors.errorSoft },
        text: { color: colors.error },
      };
  }
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  title,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  leading,
  trailing,
  accessibilityLabel,
  style,
}) => {
  const variantStyles = getVariantStyles(variant);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles.container,
        { minHeight: HEIGHT[size] },
        fullWidth && styles.fullWidth,
        pressed && !disabled && !loading && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {leading}
          <Text style={[styles.text, variantStyles.text, size === 'sm' && styles.textSmall, disabled && styles.disabledText]}>
            {title}
          </Text>
          {trailing}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledBorder,
  },
  disabledText: { color: colors.disabledText },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  text: {
    ...typography.button,
  },
  textSmall: {
    fontSize: 14,
  },
});
