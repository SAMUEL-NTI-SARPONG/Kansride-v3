import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors } from './colors';
import { spacing, typography } from './theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  title,
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, translateY]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        {title && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  closeText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});
