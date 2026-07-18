import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from './colors';
import { borderRadius, spacing, typography } from './theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  autoFocus = false,
}) => {
  const inputRef = useRef<TextInput>(null);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(cleaned);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.boxRow}
        activeOpacity={1}
        onPress={handlePress}
      >
        {Array.from({ length }, (_, index) => {
          const digit = value[index] || '';
          const isActive = index === value.length;
          const isFilled = index < value.length;

          return (
            <View
              key={index}
              style={[
                styles.box,
                isActive && styles.activeBox,
                isFilled && styles.filledBox,
                error && styles.errorBox,
              ]}
            >
              <Text style={styles.digit}>{digit}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  boxRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  activeBox: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  filledBox: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  errorBox: {
    borderColor: colors.error,
  },
  digit: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
});
