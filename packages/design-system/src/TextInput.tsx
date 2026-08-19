import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  KeyboardTypeOptions,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors } from './colors';
import { borderRadius, spacing, typography } from './theme';

interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  editable?: boolean;
  helperText?: string;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  maxLength?: number;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType,
  secureTextEntry = false,
  editable = true,
  helperText,
  leftAccessory,
  rightAccessory,
  containerStyle,
  accessibilityLabel,
  maxLength,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return colors.error;
    if (isFocused) return colors.primary;
    return colors.border;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputShell, { borderColor: getBorderColor() }, isFocused && styles.focused, !editable && styles.disabled]}>
        {leftAccessory}
        <RNTextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          maxLength={maxLength}
        />
        {rightAccessory}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  inputShell: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focused: { backgroundColor: colors.white, shadowColor: colors.primary, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  input: { flex: 1, minHeight: 52, fontSize: 16, color: colors.textPrimary, paddingVertical: 0 },
  disabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledBorder,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  helperText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
