import {StyleSheet, View} from 'react-native';
import React, {memo} from 'react';
import LinearGradient from 'react-native-linear-gradient';
import useThemeStore from '../lib/zustand/themeStore';

const TabBarBackgound = memo(() => {
  const {mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';

  return (
    <>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? 'rgba(0, 0, 0, 0.7)'
              : 'rgba(255, 255, 255, 0.9)',
          },
        ]}
      />
      <LinearGradient
        colors={
          isDark
            ? [
                'rgba(0, 0, 0, 0.0)',
                'rgba(0, 0, 0, 0.3)',
                'rgba(0, 0, 0, 0.5)',
                'rgba(0, 0, 0, 0.8)',
                'rgba(0, 0, 0, 1)',
              ]
            : [
                'rgba(255, 255, 255, 0.0)',
                'rgba(255, 255, 255, 0.3)',
                'rgba(255, 255, 255, 0.6)',
                'rgba(255, 255, 255, 0.9)',
                'rgba(255, 255, 255, 1)',
              ]
        }
        style={StyleSheet.absoluteFill}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
      />
    </>
  );
});

export default TabBarBackgound;
