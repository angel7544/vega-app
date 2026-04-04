import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {MaterialCommunityIcons} from '@expo/vector-icons';

interface UpdateModalProps {
  visible: boolean;
  version: string;
  releaseNotes: string;
  onUpdate: () => void;
  onCancel: () => void;
  primary: string;
}

const UpdateModal = ({
  visible,
  version,
  releaseNotes,
  onUpdate,
  onCancel,
  primary,
}: UpdateModalProps) => {
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
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, {backgroundColor: `${primary}15`}]}>
              <MaterialCommunityIcons name="update" size={28} color={primary} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, {color: isDark ? '#FFFFFF' : '#111827'}]}>
                Update Available
              </Text>
              <Text style={[styles.version, {color: isDark ? '#9CA3AF' : '#6B7280'}]}>
                New version {version} is ready
              </Text>
            </View>
          </View>

          {/* Release Notes */}
          <View style={[styles.notesContainer, {backgroundColor: isDark ? '#11182766' : '#F9FAFB'}]}>
             <Text style={[styles.notesHeader, {color: isDark ? '#FFFFFF' : '#374151'}]}>
                Release Notes:
             </Text>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
              <Text style={[styles.notesText, {color: isDark ? '#D1D5DB' : '#4B5563'}]}>
                {releaseNotes || 'Bug fixes and performance improvements.'}
              </Text>
            </ScrollView>
          </View>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, {backgroundColor: isDark ? '#262626' : '#F3F4F6'}]}
              onPress={onCancel}>
              <Text style={[styles.buttonText, {color: isDark ? '#FFFFFF' : '#111827'}]}>
                Later
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.updateButton, {backgroundColor: primary}]}
              onPress={onUpdate}>
              <Text style={[styles.buttonText, styles.updateButtonText]}>
                Update Now
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
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    maxHeight: Dimensions.get('window').height * 0.35,
  },
  notesHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 0,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 0,
  },
  updateButton: {
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  updateButtonText: {
    color: '#FFFFFF',
  },
});

export default UpdateModal;
