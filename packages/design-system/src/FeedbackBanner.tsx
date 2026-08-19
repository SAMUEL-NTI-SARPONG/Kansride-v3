import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './colors';
import { borderRadius, spacing, typography } from './theme';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

interface FeedbackBannerProps {
  title?: string;
  message: string;
  tone?: FeedbackTone;
  action?: React.ReactNode;
}

const toneStyles: Record<FeedbackTone, { backgroundColor: string; borderColor: string; color: string }> = {
  info: { backgroundColor: colors.infoSoft, borderColor: colors.infoBorder, color: colors.info },
  success: { backgroundColor: colors.successSoft, borderColor: colors.successBorder, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, color: colors.warning },
  error: { backgroundColor: colors.errorSoft, borderColor: colors.errorBorder, color: colors.error },
};

export function FeedbackBanner({ title, message, tone = 'info', action }: FeedbackBannerProps) {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.container, { backgroundColor: toneStyle.backgroundColor, borderColor: toneStyle.borderColor }]}>
      <View style={styles.copy}>
        {title && <Text style={[styles.title, { color: toneStyle.color }]}>{title}</Text>}
        <Text style={[styles.message, { color: toneStyle.color }]}>{message}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.label },
  message: { ...typography.small },
});
