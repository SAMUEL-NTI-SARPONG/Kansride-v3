import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { borderRadius, spacing, shadows } from './theme';
import { colors } from './colors';

type ShadowSize = 'sm' | 'md' | 'lg' | 'none';
type PaddingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type CardVariant = 'base' | 'raised' | 'inset' | 'outline';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: ShadowSize;
  padding?: PaddingSize;
  variant?: CardVariant;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  shadow = 'sm',
  padding = 'md',
  variant = 'base',
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'raised' && styles.raised,
        variant === 'inset' && styles.inset,
        variant === 'outline' && styles.outline,
        shadow !== 'none' && shadows[shadow],
        { padding: spacing[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
  },
  raised: { backgroundColor: colors.surfaceRaised },
  inset: { backgroundColor: colors.surfaceInset, shadowOpacity: 0, elevation: 0 },
  outline: { borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 },
});
