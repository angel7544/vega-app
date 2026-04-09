import React, {memo} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import {BlurView} from 'expo-blur';
import {Feather, Ionicons} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';

interface TabletSidebarProps {
  state: any;
  descriptors: any;
  navigation: any;
  onOpenDrawer: () => void;
}

const TabletSidebar = ({state, descriptors, navigation, onOpenDrawer}: TabletSidebarProps) => {
  const {mode, primary, toggleMode} = useThemeStore();

  const routes = state.routes;

  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint={mode === 'dark' ? 'dark' : 'light'} style={styles.blur}>
        <View className="flex-1 py-8 items-center justify-between">
          {/* Top: Menu & Logo */}
          <View className="items-center space-y-8">
            <TouchableOpacity 
              onPress={onOpenDrawer}
              className={`p-3 rounded-2xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}
            >
              <Feather name="menu" size={24} color={mode === 'dark' ? "white" : "black"} />
            </TouchableOpacity>

           
          </View>

          {/* Middle: Navigation Tabs */}
          <View className="space-y-6">
            {routes.map((route: any, index: number) => {
              const {options} = descriptors[route.key];
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const Icon = options.tabBarIcon;

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={isFocused ? {backgroundColor: primary, shadowColor: primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5} : {}}
                  className={`p-4 rounded-2xl items-center justify-center ${isFocused ? '' : 'bg-transparent'}`}
                >
                  {Icon ? (
                    Icon({
                      focused: isFocused,
                      color: isFocused ? 'white' : (mode === 'dark' ? 'rgba(0, 0, 0, 0)' : 'rgba(0,0,0,0.5)'),
                      size: 24,
                    })
                  ) : (
                    <Feather 
                      name="circle" 
                      size={24} 
                      color={isFocused ? 'white' : (mode === 'dark' ? 'rgba(255, 255, 255, 0)' : 'rgba(0,0,0,0.5)')} 
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom: Theme Toggle */}
          <TouchableOpacity 
            onPress={toggleMode}
            className={`p-4 rounded-2xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}
          >
            <Ionicons 
              name={mode === 'dark' ? "moon" : "sunny"} 
              size={24} 
              color={mode === 'dark' ? '#FFD700' : '#FFA500'} 
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: '100%',
    backgroundColor: 'transparent',
    borderRightWidth: 1,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default memo(TabletSidebar);
