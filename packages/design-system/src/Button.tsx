import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from './colors';
import { borderRadius, spacing, typography } from './theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
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
}) => {
  const variantStyles = getVariantStyles(variant);

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles.container,
        { minHeight: HEIGHT[size] },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.text, variantStyles.text, size === 'sm' && styles.textSmall]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.button,
  },
  textSmall: {
    fontSize: 14,
  },
});
