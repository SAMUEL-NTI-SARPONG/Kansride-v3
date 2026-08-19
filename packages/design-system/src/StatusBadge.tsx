import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './colors';
import { borderRadius, spacing, typography } from './theme';

type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
}

const toneStyles: Record<StatusTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surfaceInset, color: colors.textSecondary },
  primary: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  error: { backgroundColor: colors.errorSoft, color: colors.error },
  info: { backgroundColor: colors.infoSoft, color: colors.info },
};

export function StatusBadge({ label, tone = 'neutral', dot = false }: StatusBadgeProps) {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.container, { backgroundColor: toneStyle.backgroundColor }]}>
      {dot && <View style={[styles.dot, { backgroundColor: toneStyle.color }]} />}
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { ...typography.caption, fontWeight: '700' },
});
