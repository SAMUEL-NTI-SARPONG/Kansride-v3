import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from './colors';
import { borderRadius, layout, spacing, typography } from './theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ListItem({ title, subtitle, leading, trailing, onPress, disabled, style, accessibilityLabel }: ListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      {leading}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: layout.minTouchTarget,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: { flex: 1 },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  pressed: { backgroundColor: colors.surfaceInset },
  disabled: { backgroundColor: colors.disabledSurface },
});
