import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';

const FloatingSearchButton = () => {
  const navigation = useNavigation<any>();
  const { primary, mode } = useThemeStore();
  const isDark = mode === 'dark';
  
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  // Use a local state to track route to avoid potentially blocking useNavigationState logic
  const [isSearchOrPlayer, setIsSearchOrPlayer] = useState(false);

  const routeState = useNavigationState(state => state);

  useEffect(() => {
    if (!routeState) return;
    
    const getActiveRouteName = (state: any): string => {
      const route = state.routes[state.index];
      if (route.state) return getActiveRouteName(route.state);
      return route.name;
    };

    try {
      const name = getActiveRouteName(routeState);
      const active = name.includes('Search') || name.includes('Player');
      setIsSearchOrPlayer(active);
    } catch (e) {
      console.warn('FAB Route Detection Error:', e);
    }
  }, [routeState]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      opacity.value = withTiming(0);
      translateY.value = withTiming(50);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      opacity.value = withTiming(1);
      translateY.value = withTiming(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isSearchOrPlayer) {
      opacity.value = withTiming(0);
      scale.value = withTiming(0);
    } else {
      opacity.value = withTiming(1);
      scale.value = withSpring(1);
    }
  }, [isSearchOrPlayer]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { scale: scale.value },
        { translateY: translateY.value }
      ],
    };
  });

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1)
    );
    navigation.navigate('SearchStack');
  };

  if (isSearchOrPlayer) return null;

  return (
    <Animated.View 
      style={[styles.container, animatedStyle]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={[
          styles.button,
          { 
            backgroundColor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            shadowColor: primary,
          }
        ]}
      >
        <View style={styles.content}>
          <Feather name="search" size={24} color={primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, 
    right: 20,
    zIndex: 9999,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FloatingSearchButton;
