import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import useThemeStore from '../lib/zustand/themeStore';
import usePlayerStore from '../lib/zustand/playerStore';
import { settingsStorage } from '../lib/storage';
import { iptvParser } from '../lib/iptvParser';
import useToastStore from '../lib/zustand/toastStore';
import Timetable from '../components/Timetable';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Program, Channel } from '../types/navigation';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeOutDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';
import Video, { ResizeMode, VideoRef } from 'react-native-video';

const ChannelInfo = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'ChannelInfo'>['route']>();
  const { channel, channels: routeChannels = [], initialIndex: routeInitialIndex = 0 } = route.params;
  
  const { mode, primary } = useThemeStore();
  const { toggleFavorite, isFavorite } = usePlayerStore();
  const { show: showToast } = useToastStore();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  const isDark = mode === 'dark';
  const isWide = screenWidth > 900;
  
  const [epgData, setEpgData] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [muted, setMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.COVER);
  const videoRef = useRef<VideoRef>(null);
  const controlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const favorited = isFavorite(channel.url);

  const cleanChannelName = useMemo(() => {
    if (!channel.name) return '';
    return channel.name
      .split('(')[0] // Remove anything after the first bracket
      .replace(/\s*(HD|SD|UHD|4K|1080p|720p|576p|Hindi|English|Telugu|Tamil|Kannada|Malayalam|Marathi|Bengali|Gujarati|Punjabi|Odia|Bhojpuri|Assamese|Urdu)\s*$/gi, '') // Remove trailing technical info
      .trim();
  }, [channel.name]);

  // Animation values
  const heroHeight = useSharedValue(screenWidth * 9 / 16);
  const controlsOpacity = useSharedValue(0);

  const animatedHeroStyle = useAnimatedStyle(() => ({
    height: heroHeight.value,
  }));

  const animatedControlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const resetControlTimeout = useCallback(() => {
    if (controlTimeoutRef.current) {
      clearTimeout(controlTimeoutRef.current);
    }
    controlTimeoutRef.current = setTimeout(() => {
      controlsOpacity.value = withTiming(0, { duration: 500 });
      setShowInfo(false);
    }, 5000);
  }, []);

  const toggleControls = useCallback(() => {
    const isVisible = controlsOpacity.value > 0.5;
    if (isVisible) {
      controlsOpacity.value = withTiming(0, { duration: 300 });
      setShowInfo(false);
      if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    } else {
      controlsOpacity.value = withTiming(1, { duration: 300 });
      setShowInfo(true);
      resetControlTimeout();
    }
  }, [resetControlTimeout]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInfo(false);
      heroHeight.value = withTiming(screenWidth * 9 / 16, { 
        duration: 1000, 
        easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
      });
      controlsOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
      resetControlTimeout();
    }, 2000);
    return () => {
      clearTimeout(timer);
      if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    };
  }, [screenHeight, screenWidth, resetControlTimeout]);

  useEffect(() => {
    fetchChannelDetails();
  }, [channel.tvgId]);

  const fetchChannelDetails = async () => {
    setLoading(true);
    try {
      const country = settingsStorage.getIptvCountry() || 'in';
      const programs = await iptvParser.fetchEPGForChannel(channel, country);
      setEpgData(programs);
    } catch (e) {
      console.error('Failed to load channel details:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchNow = async () => {
    if (settingsStorage.useExternalPlayerLive()) {
      try {
        const canOpen = await Linking.canOpenURL(channel.url);
        if (canOpen) {
          Linking.openURL(channel.url);
          showToast('Opening in external player...', 'info');
        } else {
          showToast('Could not open external player', 'error');
        }
      } catch (err) {
        showToast('Error opening external player', 'error');
      }
      return;
    }
    navigation.navigate('LivePlayer', { 
      channel, 
      channels: routeChannels, 
      initialIndex: routeInitialIndex 
    });
  };

  const cycleResizeMode = () => {
    const modes = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
    const currentIndex = modes.indexOf(resizeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setResizeMode(modes[nextIndex]);
    showToast(`Resize: ${modes[nextIndex].toUpperCase()}`, 'info');
  };

  const handlePip = () => {
    if (videoRef.current) {
      videoRef.current.enterPictureInPicture();
    }
  };

  const renderPlayer = () => (
    <View className="flex-1 bg-gray-900 justify-center items-center overflow-hidden">
      {channel.url ? (
        <Video
          ref={videoRef}
          key={reloadKey}
          source={{ uri: channel.url }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          repeat={true}
          muted={muted}
          paused={isPaused}
          playInBackground={false}
          playWhenInactive={false}
          poster={channel.logo}
          posterResizeMode="contain"
        />
      ) : channel.logo ? (
        <Image source={{ uri: channel.logo }} className="w-full h-full" resizeMode="contain" />
      ) : (
        <Feather name="tv" size={80} color="white" />
      )}

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.8)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Tap Interaction Overlay */}
      <Pressable 
        onPress={toggleControls}
        style={[StyleSheet.absoluteFill, { zIndex: 5 }]}
      />

      {/* Horizontal Bottom Control Bar */}
      <Animated.View 
        pointerEvents="box-none"
        style={[animatedControlsStyle, { zIndex: 10 }]}
        className="absolute bottom-6 left-0 right-0 py-2 px-4 flex-row justify-center items-center gap-x-2"
      >
        <TouchableOpacity 
          onPress={() => {
            setIsPaused(!isPaused);
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <MaterialIcons 
            name={isPaused ? "play-arrow" : "pause"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            setMuted(!muted);
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <Feather name={muted ? "volume-x" : "volume-2"} size={22} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            setReloadKey(p => p + 1);
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <MaterialIcons name="refresh" size={22} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            cycleResizeMode();
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <MaterialIcons name="aspect-ratio" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            handlePip();
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <MaterialIcons name="picture-in-picture" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            handleWatchNow();
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <Ionicons name="expand" size={20} color="white" />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Info Overlay */}
      {showInfo && (
        <Animated.View 
          pointerEvents="none"
          entering={FadeInDown.duration(600)}
          exiting={FadeOutDown.duration(800)}
          className="absolute bottom-10 left-0 right-0 px-8 z-10"
        >
          <View className="flex-row items-center bg-red-600 px-3 py-1 rounded-lg self-start mb-4 shadow-lg">
            <View className="w-2 h-2 rounded-full bg-white mr-2 shadow-2xl" />
            <Text className="text-white font-black text-[10px] uppercase tracking-widest">Live Now</Text>
          </View>
          <Text className="text-5xl font-black text-white shadow-2xl">
            {channel.name}
          </Text>
          <View className="flex-row items-center mt-3">
            <Text className="text-gray-200 font-bold uppercase text-[10px] tracking-[4px]">
              {channel.category || 'Streaming'}
            </Text>
            <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mx-3" />
            <Text className="text-gray-200 font-bold text-[10px] tracking-widest uppercase">HD Signal</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );

  const renderSchedule = () => (
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-gray-900 dark:text-white text-3xl font-black">Broadcast</Text>
            <Text className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider">Schedule</Text>
          </View>
          <View className="p-4 bg-gray-100 dark:bg-white/5 rounded-2xl">
            <Feather name="calendar" size={24} color={isDark ? "white" : "black"} />
          </View>
        </View>

        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color={primary} size="large" />
            <Text className="text-gray-500 dark:text-gray-400 text-sm font-bold mt-6">Syncing schedule...</Text>
          </View>
        ) : epgData.length > 0 ? (
          <Timetable programs={epgData as Program[]} />
        ) : (
          <View className="py-20 items-center justify-center bg-gray-50 dark:bg-white/5 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10">
            <Feather name="clock" size={48} color={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
            <Text className="text-gray-500 dark:text-gray-400 text-base font-bold mt-6 text-center px-10">
              No schedule available for this channel
            </Text>
          </View>
        )}
      </View>
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView 
        className="flex-1"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Structural Header (Inside ScrollView to make it scrollable) */}
        <View 
          style={{ 
            zIndex: 100, 
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: 16,
            backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
          }}
        >
          {/* iOS Blur Effect */}
          {Platform.OS === 'ios' && (
            <BlurView 
              intensity={30} 
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill} 
            />
          )}
          <View className="flex-row items-center justify-between px-6">
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
              className="w-11 h-11 rounded-2xl items-center justify-center border border-white/5"
            >
              <Feather name="arrow-left" size={24} color={isDark ? "white" : "black"} />
            </TouchableOpacity>

            <View className="flex-1 items-center px-4">
              <Text className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
                {cleanChannelName}
              </Text>
              <Text className={`text-[9px] font-bold uppercase tracking-[2px] opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>
                Live Broadcast
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => toggleFavorite(channel)}
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
              className="w-11 h-11 rounded-2xl items-center justify-center border border-white/5"
            >
              <Feather name="heart" size={22} color={favorited ? primary : (isDark ? "white" : "black")} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={[animatedHeroStyle]}>
          {renderPlayer()}
        </Animated.View>

        {renderSchedule()}

        {/* About Info Section */}
        <View className="px-8 mt-4 mb-20">
          <Text className={`text-xl font-black mb-4 ${isDark ? 'text-white' : 'text-black'}`}>About this Channel</Text>
          <Text className={`text-base leading-7 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Experience high-fidelity live streaming of {channel.name}. Enjoy a lag-free experience with our optimized signal technology and immersive broadcast quality.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default ChannelInfo;
