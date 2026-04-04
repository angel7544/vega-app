import React, {useEffect} from 'react';
import {View, Text, useWindowDimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInUp,
  FadeOutUp,
} from 'react-native-reanimated';
import useToastStore from '../lib/zustand/toastStore';
import useThemeStore from '../lib/zustand/themeStore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const Toast = () => {
  const {visible, message, type, hide} = useToastStore();
  const {primary, mode} = useThemeStore();
  const {width} = useWindowDimensions();

  if (!visible) return null;

  const getTypeIcon = () => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'error';
      case 'info':
      default:
        return 'info';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'info':
      default:
        return primary;
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.springify()}
      exiting={FadeOutUp}
      style={{
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
      }}>
      <View
        className={`${
          mode === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'
        } flex-row items-center p-4 rounded-xl shadow-lg border border-white/10`}
        style={{
          elevation: 5,
          width: width - 40,
        }}>
        <MaterialIcons name={getTypeIcon()} size={24} color={getIconColor()} />
        <Text
          className={`ml-3 flex-1 font-medium ${
            mode === 'dark' ? 'text-white' : 'text-black'
          }`}>
          {message}
        </Text>
        <MaterialIcons
          name="close"
          size={20}
          color={mode === 'dark' ? '#999' : '#666'}
          onPress={hide}
        />
      </View>
    </Animated.View>
  );
};

export default Toast;
