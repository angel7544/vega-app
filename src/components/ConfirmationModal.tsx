import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  primary: string;
  isDestructive?: boolean;
}

const ConfirmationModal = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  primary,
  isDestructive = false,
}: ConfirmationModalProps) => {
  const {mode} = useThemeStore();
  const isDark = mode === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#171717' : '#FFFFFF',
              borderColor: isDark ? '#2B2B2B' : '#E5E7EB',
            },
          ]}>
          {/* Icon Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                {backgroundColor: isDestructive ? '#F8717120' : `${primary}15`},
              ]}>
              <MaterialCommunityIcons
                name={isDestructive ? 'alert-circle-outline' : 'help-circle-outline'}
                size={32}
                color={isDestructive ? '#F87171' : primary}
              />
            </View>
          </View>

          {/* Text Content */}
          <View style={styles.content}>
            <Text style={[styles.title, {color: isDark ? '#FFFFFF' : '#111827'}]}>
              {title}
            </Text>
            <Text style={[styles.message, {color: isDark ? '#9CA3AF' : '#6B7280'}]}>
              {message}
            </Text>
          </View>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                {backgroundColor: isDark ? '#262626' : '#F3F4F6'},
              ]}
              onPress={onCancel}>
              <Text style={[styles.buttonText, {color: isDark ? '#FFFFFF' : '#111827'}]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {backgroundColor: isDestructive ? '#EF4444' : primary},
              ]}
              onPress={onConfirm}>
              <Text style={[styles.buttonText, styles.confirmButtonText]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {},
  confirmButton: {
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
  },
});

export default ConfirmationModal;
