import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  KeyboardTypeOptions,
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
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return colors.error;
    if (isFocused) return colors.primary;
    return colors.border;
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          { borderColor: getBorderColor() },
          !editable && styles.disabled,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  disabled: {
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
