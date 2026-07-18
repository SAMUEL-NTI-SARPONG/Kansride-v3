import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { borderRadius, spacing, shadows } from './theme';
import { colors } from './colors';

type ShadowSize = 'sm' | 'md' | 'lg';
type PaddingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: ShadowSize;
  padding?: PaddingSize;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  shadow = 'md',
  padding = 'md',
}) => {
  return (
    <View
      style={[
        styles.base,
        shadows[shadow],
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
  },
});
