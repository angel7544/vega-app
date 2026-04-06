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
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import useThemeStore from '../lib/zustand/themeStore';
import usePlayerStore from '../lib/zustand/playerStore';
import { settingsStorage } from '../lib/storage';
import { iptvParser } from '../lib/iptvParser';
import { fetchChannelSchedule } from '../lib/services/channelEPG';
import useToastStore from '../lib/zustand/toastStore';
import { EPG_SOURCES, FLAGS } from '../lib/constants';
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
import Video, { ResizeMode, VideoRef, SelectedTrack, SelectedTrackType } from 'react-native-video';
import Orientation, { OrientationLocker, LANDSCAPE } from 'react-native-orientation-locker';
import * as NavigationBar from 'expo-navigation-bar';
import { useVideoSettings } from '../lib/hooks/useStream';
import { usePlayerSettings } from '../lib/hooks/usePlayerSettings';
import { useNow } from '../lib/hooks/useNow';

const CH_INFO_UPDATE_INTERVAL = 30000; // 30 seconds

const ChannelInfo = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'ChannelInfo'>['route']>();
  const { channel, channels: routeChannels = [], initialIndex: routeInitialIndex = 0 } = route.params;
  
  const { mode, primary } = useThemeStore();
  const { 
    toggleFavorite, isFavorite, autoPlayChannel, toggleAutoPlayChannel, 
    customEpgUrl, setCustomEpgUrl, disableEpg, toggleDisableEpg,
    epgData, updateChannelEpg, epgTimeOffset 
  } = usePlayerStore();
  const { show: showToast } = useToastStore();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  const isDark = mode === 'dark';
  const isWide = screenWidth > 900;
  const isLandscape = screenWidth > screenHeight;
  const isTabletLandscape = isWide && isLandscape;
  
  const now = useNow();
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [muted, setMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(!autoPlayChannel);
  const [reloadKey, setReloadKey] = useState(0);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const videoRef = useRef<VideoRef>(null);
  const controlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const favorited = isFavorite(channel.url);

  const { showSettings, setShowSettings, activeTab, setActiveTab } = usePlayerSettings();
  const {
    audioTracks,
    textTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setTextTracks,
    processAudioTracks,
  } = useVideoSettings();

  const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.INDEX,
    value: 0,
  });

  const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.DISABLED,
  });

  const [showAudioOptions, setShowAudioOptions] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seekableDuration, setSeekableDuration] = useState(0);
  const progressWidthRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const goFullScreen = useCallback(() => {
    setIsFullScreen(true);
    const isMobile = Math.min(screenWidth, screenHeight) < 768;
    if (isMobile) {
      Orientation.lockToLandscape();
    }
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
      StatusBar.setHidden(true, 'slide');
    }
  }, [screenWidth, screenHeight]);

  const exitFullScreen = useCallback(() => {
    setIsFullScreen(false);
    const isMobile = Math.min(screenWidth, screenHeight) < 768;
    if (isMobile) {
      Orientation.lockToPortrait();
    } else {
      Orientation.unlockAllOrientations();
    }
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('visible');
      StatusBar.setHidden(false, 'slide');
    }
  }, [screenWidth, screenHeight]);

  useEffect(() => {
    const handleOrientation = (orientation: string) => {
      if (orientation === 'LANDSCAPE-LEFT' || orientation === 'LANDSCAPE-RIGHT') {
        goFullScreen();
      } else if (orientation === 'PORTRAIT' || orientation === 'PORTRAIT-UPSIDEDOWN') {
        exitFullScreen();
      }
    };
    
    // Safety: ensure locker is cleaned up
    Orientation.addDeviceOrientationListener(handleOrientation);
    return () => {
      Orientation.removeDeviceOrientationListener(handleOrientation);
      Orientation.unlockAllOrientations();
      // Ensure navigation bar is restored
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, [goFullScreen, exitFullScreen]);

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
  }, [channel.url]);

  // EPG details are fetched on mount or URL change

  const fetchChannelDetails = async (force = false) => {
    const currentUrl = channel.url;
    
    // Safety check: if EPG is disabled, don't even try
    if (disableEpg) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const country = settingsStorage.getIptvCountry() || 'in';
      // Use the dedicated GitHub JSON service for best performance and accuracy
      // Pass the force flag to bypass the 5-minute cache
      const programs = await fetchChannelSchedule(channel, country, force);
      
      if (channel.url === currentUrl) {
         updateChannelEpg(currentUrl, Array.isArray(programs) ? programs : []);
      }
    } catch (e) {
      console.error('Failed to load channel details:', e);
    } finally {
      if (channel.url === currentUrl) {
        setLoading(false);
      }
    }
  };

  const currentProgram = useMemo(() => {
    const programs = epgData[channel.url];
    if (!programs || programs.length === 0) return null;
    
    const offsetMs = (epgTimeOffset || 0) * 3600000;
    return programs.find(p => (p.startTs + offsetMs) <= now && (p.stopTs + offsetMs) > now) || programs[0];
  }, [epgData, channel.url, now, reloadKey, epgTimeOffset]);

  const formatLocalTime = useCallback((ts: number) => {
    if (!ts) return '';
    const offsetMs = (epgTimeOffset || 0) * 3600000;
    const date = new Date(ts + offsetMs);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }, [epgTimeOffset]);

  const handleWatchNow = async () => {
    if (isFullScreen) {
      exitFullScreen();
    } else {
      goFullScreen();
    }
  };
  
  const handleSetLivePosition = useCallback((y: number) => {
    // Offset for the 'Broadcast' header and screen top spacing
    const yOffset = y + 40; 
    setTimeout(() => {
        scrollRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 500); // Give it some time to layout
  }, []);

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
    <View className="flex-1 bg-black justify-center items-center overflow-hidden">
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
          selectedAudioTrack={selectedAudioTrack}
          onAudioTracks={(e: any) => processAudioTracks(e.audioTracks)}
          selectedTextTrack={selectedTextTrack}
          onTextTracks={(e: any) => setTextTracks(e.textTracks)}
          onProgress={(e) => {
            if (e.seekableDuration > 0) {
              setProgress(e.currentTime / e.seekableDuration);
              setSeekableDuration(e.seekableDuration);
            }
          }}
        />
      ) : channel.logo ? (
        <Image source={{ uri: channel.logo }} className="w-full h-full" resizeMode="contain" />
      ) : (
        <Feather name="tv" size={80} color="white" />
      )}

      {/* Gradient Overlay - Now Animated to hide with controls */}
      <Animated.View 
        style={[StyleSheet.absoluteFill, animatedControlsStyle, { zIndex: 4, elevation: 4 }]} 
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Tap Interaction Overlay */}
      <Pressable 
        onPress={toggleControls}
        style={[StyleSheet.absoluteFill, { zIndex: 5, elevation: 5 }]}
      />

      {/* Horizontal Bottom Control Bar */}
      <Animated.View 
        pointerEvents={showInfo ? "box-none" : "none"}
        style={[animatedControlsStyle, { zIndex: 10, elevation: 10 }]}
        className="absolute bottom-6 left-0 right-0 py-2 px-4 flex-row justify-center items-center gap-x-2"
      >
        {/* Persistent Back Button for Player (Visible in Fullscreen or Tablet Landscape) */}
        {(isFullScreen || isTabletLandscape) && (
          <TouchableOpacity 
            onPress={() => {
              if (isFullScreen) {
                exitFullScreen();
              } else {
                navigation.goBack();
              }
            }}
            className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden mr-auto ml-2"
          >
            <BlurView intensity={30} style={StyleSheet.absoluteFill} />
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => {
            if (isPaused) {
              setReloadKey(p => p + 1);
            }
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

        {/* Expandable Settings Hub */}
        <View className="flex-row items-center bg-black/40 border border-white/10 rounded-full px-1 py-1">
          {showAudioOptions && (
            <Animated.View 
              entering={FadeIn.duration(400)} 
              exiting={FadeOutDown.duration(300)}
              className="flex-row gap-x-1 pr-1"
            >
              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/10"
                onPress={() => { setActiveTab('audio'); setShowSettings(true); resetControlTimeout(); }}>
                <MaterialIcons name="audiotrack" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/10"
                onPress={() => { setActiveTab('subtitle'); setShowSettings(true); resetControlTimeout(); }}>
                <MaterialIcons name="subtitles" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/10"
                onPress={() => { setActiveTab('epg' as any); setShowSettings(true); resetControlTimeout(); }}>
                <MaterialIcons name="format-list-bulleted" size={20} color="white" />
              </TouchableOpacity>
            </Animated.View>
          )}

          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${showAudioOptions ? 'bg-white/20' : 'bg-transparent'}`}
            onPress={() => { 
              setShowAudioOptions(!showAudioOptions); 
              resetControlTimeout(); 
            }}>
            <MaterialIcons 
              name={showAudioOptions ? "close" : "settings"} 
              size={22} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => {
            handleWatchNow();
            resetControlTimeout();
          }}
          className="w-12 h-12 rounded-full bg-black/40 border border-white/10 items-center justify-center overflow-hidden"
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
          <MaterialIcons name={isFullScreen ? "fullscreen-exit" : "fullscreen"} size={24} color="white" />
        </TouchableOpacity>
      </Animated.View>

      {/* Seeker on Full Screen */}
      {isFullScreen && (
        <Animated.View 
          pointerEvents={showInfo ? "auto" : "none"}
          style={[animatedControlsStyle, { zIndex: 10, elevation: 10 }]}
          className="absolute bottom-24 left-6 right-6 flex-row items-center gap-x-4"
        >
          <View className="w-12 items-end">
            <Text className="text-white text-[10px] font-black opacity-100">
              {new Date((progress * seekableDuration) * 1000).toISOString().substring(14, 19)}
            </Text>
          </View>
          <TouchableOpacity 
            activeOpacity={0.8}
            className="flex-1 h-8 justify-center relative"
            onLayout={(e) => { progressWidthRef.current = e.nativeEvent.layout.width; }}
            onPress={(e) => {
              if (videoRef.current && seekableDuration > 0 && progressWidthRef.current > 0) {
                const targetPercentage = e.nativeEvent.locationX / progressWidthRef.current;
                const targetTime = targetPercentage * seekableDuration;
                videoRef.current.seek(targetTime);
              }
              resetControlTimeout();
            }}
          >
            <View className="h-1 bg-white/20 rounded-full w-full overflow-hidden" pointerEvents="none">
              <View style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, height: '100%', backgroundColor: primary }} />
            </View>
            <View 
              style={{
                position: 'absolute',
                left: `${Math.max(0, Math.min(100, progress * 100))}%`,
                width: 12, height: 12,
                borderRadius: 6,
                backgroundColor: primary,
                marginLeft: -6
              }} 
              pointerEvents="none"
            />
          </TouchableOpacity>
          <View className="w-12 items-start">
            <View className="bg-red-600 px-1.5 py-0.5 rounded flex-row items-center shadow-lg">
              <View className="w-1.5 h-1.5 rounded-full bg-white mr-1 opacity-90" />
              <Text className="text-white text-[8px] font-black uppercase tracking-widest leading-3">LIVE</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Player Info Overlay - Floating Info Card */}
      {showInfo && (
        <Animated.View 
          pointerEvents="none"
          entering={FadeInDown.duration(600)}
          exiting={FadeOutDown.duration(800)}
          style={{ elevation: 5, zIndex: 10 }}
          className={`absolute ${isFullScreen ? 'top-12 left-8 right-8' : 'bottom-16 left-0 right-0 px-8'}`}
        >
          <View className="mb-1">
             <Text className="text-white text-3xl font-black tracking-tight shadow-md" numberOfLines={1}>
                {currentProgram ? currentProgram.title : cleanChannelName}
             </Text>
             {currentProgram ? (
               <Text className="text-white/80 text-sm font-semibold mt-1 shadow-sm" numberOfLines={1}>
                 {formatLocalTime(currentProgram.startTs)} - {formatLocalTime(currentProgram.stopTs)} • {currentProgram.desc || cleanChannelName}
               </Text>
             ) : (
               <Text className="text-white/80 text-sm font-semibold mt-1 shadow-sm" numberOfLines={1}>
                 {cleanChannelName}
               </Text>
             )}
          </View>
          <View className="flex-row items-center mt-2 gap-x-2">
             <View className="bg-white/10 px-2 py-1 rounded-md border border-white/20 shadow-sm">
               <Text className="text-white font-bold uppercase text-[10px] tracking-[2px]">
                 {currentProgram?.category || channel.category || 'Live TV'}
               </Text>
             </View>
             
             {/* Quality Badge */}
             {(channel.quality && channel.quality !== 'SD') && (
               <View className={`px-2 py-0.5 rounded-md border border-white/20 shadow-sm ${channel.quality === '4K' ? 'bg-amber-500' : channel.quality === 'FHD' ? 'bg-blue-600' : 'bg-green-600'}`}>
                 <Text className="text-white font-black text-[9px] uppercase tracking-widest">{channel.quality}</Text>
               </View>
             )}

             {/* Country Badge */}
             {channel.country && (
               <View className="bg-white/5 px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
                <Text className="text-gray-300 font-bold text-[9px] uppercase tracking-widest">{channel.country}</Text>
               </View>
             )}

             {/* Language Badge */}
             {channel.language && (
               <View className="bg-white/5 px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
                <Text className="text-gray-300 font-bold text-[9px] uppercase tracking-widest">{channel.language}</Text>
               </View>
             )}
          </View>
        </Animated.View>
      )}

      {/* Settings Modal - Centered Glassmorphism Design */}
      <Modal transparent visible={showSettings} animationType="fade" statusBarTranslucent>
        <View
          style={[{ zIndex: 1000, elevation: 1000 }]}
          className="flex-1 justify-center items-center"
        >
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSettings(false)}
          >
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="flex-1 bg-black/40" />
          </Pressable>

          <Animated.View
            entering={FadeIn.duration(400)}
            className="bg-[#121212] w-[85%] max-w-[600px] h-[70%] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Premium Header Tabs */}
            <View className="flex-row p-2 bg-white/5 rounded-[32px] mx-6 mt-6 mb-6">
              <TouchableOpacity 
                onPress={() => setActiveTab('audio')} 
                className={`flex-1 py-3 items-center rounded-[24px] ${activeTab === 'audio' ? 'bg-white/10 shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-bold tracking-tight ${activeTab === 'audio' ? 'text-white' : 'text-white/40'}`}>Audio</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setActiveTab('subtitle')} 
                className={`flex-1 py-3 items-center rounded-[24px] ${activeTab === 'subtitle' ? 'bg-white/10 shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-bold tracking-tight ${activeTab === 'subtitle' ? 'text-white' : 'text-white/40'}`}>Subtitles</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setActiveTab('epg' as any)} 
                className={`flex-1 py-3 items-center rounded-[24px] ${activeTab === 'epg' as any ? 'bg-white/10 shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-bold tracking-tight ${activeTab === 'epg' as any ? 'text-white' : 'text-white/40'}`}>EPG</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setActiveTab('settings' as any)} 
                className={`flex-1 py-3 items-center rounded-[24px] ${activeTab === 'settings' ? 'bg-white/10 shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-bold tracking-tight ${activeTab === 'settings' ? 'text-white' : 'text-white/40'}`}>Options</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Content Area */}
            <ScrollView className="flex-1 px-2" showsVerticalScrollIndicator={false}>
              {activeTab === 'audio' && (
                <View className="px-4 pb-8 space-y-2">
                  {audioTracks.length > 0 ? audioTracks.map((track, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        setSelectedAudioTrackIndex(index);
                        setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: index });
                        setShowSettings(false);
                      }}
                      className={`flex-row items-center p-4 rounded-[24px] mb-2 ${selectedAudioTrackIndex === index ? 'bg-white/10 border border-white/10' : 'bg-transparent'}`}
                    >
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-4 ${selectedAudioTrackIndex === index ? 'border-primary' : 'border-white/30'}`}>
                        {selectedAudioTrackIndex === index && <View className="w-3 h-3 rounded-full bg-primary" />}
                      </View>
                      <View className="flex-1">
                        <Text className={`text-base font-bold ${selectedAudioTrackIndex === index ? 'text-white' : 'text-white/70'}`}>
                          {track.language || track.title || `Track ${index + 1}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )) : (
                     <View className="py-20 items-center justify-center opacity-50">
                       <MaterialIcons name="audiotrack" size={48} color="white" />
                       <Text className="text-white mt-4 font-bold">No Audio Tracks Found</Text>
                     </View>
                  )}
                </View>
              )}

              {activeTab === 'settings' && (
                <View className="px-4 pb-8 space-y-2">
                  <TouchableOpacity
                    onPress={toggleAutoPlayChannel}
                    activeOpacity={0.8}
                    className={`flex-row items-center p-4 rounded-[24px] mb-2 ${autoPlayChannel ? 'bg-white/10 border border-white/10' : 'bg-transparent'}`}
                  >
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-4 ${autoPlayChannel ? 'border-primary' : 'border-white/30'}`}>
                      {autoPlayChannel && <View className="w-3 h-3 rounded-full bg-primary" />}
                    </View>
                    <View className="flex-1">
                      <Text className={`text-base font-bold ${autoPlayChannel ? 'text-white' : 'text-white/70'}`}>
                        Channel Auto Play
                      </Text>
                      <Text className="text-xs text-white/50 font-medium mt-1">
                        Play video automatically when tuning in
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'epg' as any && (
                <View className="px-4 pb-8">
                  {/* Disable EPG Toggle */}
                  <TouchableOpacity
                    onPress={toggleDisableEpg}
                    activeOpacity={0.8}
                    className={`flex-row items-center p-4 rounded-[24px] mb-6 ${disableEpg ? 'bg-red-500/10 border border-red-500/20' : 'bg-primary/10 border border-primary/20'}`}
                  >
                    <View className="flex-1">
                      <Text className={`text-base font-bold ${disableEpg ? 'text-red-400' : 'text-primary'}`}>
                        {disableEpg ? 'EPG Schedule Disabled' : 'EPG Schedule Enabled'}
                      </Text>
                      <Text className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                        {disableEpg ? 'Enable to see what is playing' : 'Disable if app is lagging during sync'}
                      </Text>
                    </View>
                   <View className={`w-12 h-6 rounded-full px-1 justify-center ${disableEpg ? 'bg-gray-700' : 'bg-primary'}`}>
                      <View className={`w-4 h-4 rounded-full bg-white ${disableEpg ? 'self-start' : 'self-end'}`} />
                    </View>
                  </TouchableOpacity>

                  <View className="mt-4 p-6 bg-white/5 border border-white/10 rounded-[32px] items-center">
                    <MaterialCommunityIcons name="cog" size={32} color="rgba(255,255,255,0.2)" />
                    <Text className="text-white/60 text-sm font-bold mt-4 text-center">
                      Advanced EPG sources are now managed in the main Settings screen.
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        setShowSettings(false);
                        navigation.navigate('SettingsStack' as any);
                      }}
                      className="mt-6 px-6 py-3 bg-white/10 rounded-full border border-white/5"
                    >
                      <Text className="text-white font-black text-[10px] uppercase tracking-widest text-center">Open Preferences</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeTab === 'subtitle' && (
                <View className="px-4 pb-8 space-y-2">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTextTrackIndex(1000);
                      setSelectedTextTrack({ type: SelectedTrackType.DISABLED });
                      setShowSettings(false);
                    }}
                    className={`flex-row items-center p-4 rounded-[24px] mb-2 ${selectedTextTrackIndex === 1000 ? 'bg-white/10 border border-white/10' : 'bg-transparent'}`}
                  >
                     <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-4 ${selectedTextTrackIndex === 1000 ? 'border-primary' : 'border-white/30'}`}>
                        {selectedTextTrackIndex === 1000 && <View className="w-3 h-3 rounded-full bg-primary" />}
                      </View>
                      <Text className={`text-base font-bold ${selectedTextTrackIndex === 1000 ? 'text-white' : 'text-white/70'}`}>Off</Text>
                  </TouchableOpacity>

                  {textTracks.map((track, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        setSelectedTextTrackIndex(index);
                        setSelectedTextTrack({ type: SelectedTrackType.INDEX, value: index });
                        setShowSettings(false);
                      }}
                      className={`flex-row items-center p-4 rounded-[24px] mb-2 ${selectedTextTrackIndex === index ? 'bg-white/10 border border-white/10' : 'bg-transparent'}`}
                    >
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-4 ${selectedTextTrackIndex === index ? 'border-primary' : 'border-white/30'}`}>
                        {selectedTextTrackIndex === index && <View className="w-3 h-3 rounded-full bg-primary" />}
                      </View>
                      <Text className={`text-base font-bold ${selectedTextTrackIndex === index ? 'text-white' : 'text-white/70'}`}>
                        {track.language || track.title || `Track ${index + 1}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
            
            <View className="p-6 pt-2">
              <TouchableOpacity
                onPress={() => setShowSettings(false)}
                className="w-full h-14 rounded-[24px] bg-white/10 items-center justify-center"
              >
                <Text className="text-white font-bold text-base">Close</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );

  const renderSchedule = () => (
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-gray-900 dark:text-white text-3xl font-black">Broadcast</Text>
            <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Live Schedule</Text>
          </View>
          <View className="flex-row gap-x-2">
            <TouchableOpacity 
              onPress={() => fetchChannelDetails(true)}
              disabled={loading}
              className="p-4 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10"
            >
              <MaterialIcons name="refresh" size={24} color={loading ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)") : (isDark ? "white" : "black")} />
            </TouchableOpacity>
            <View className="p-4 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
              <Feather name="calendar" size={24} color={isDark ? "white" : "black"} />
            </View>
          </View>
        </View>

        {disableEpg ? (
          <View className="py-20 items-center justify-center bg-gray-50 dark:bg-white/5 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10">
            <Text className="text-gray-500 dark:text-gray-400 text-base font-bold mt-6 text-center px-10">
              EPG Schedule is currently disabled in settings
            </Text>
            {/* <TouchableOpacity 
              onPress={() => { setActiveTab('epg' as any); setShowSettings(true); }}
              className="mt-6 px-8 py-3 bg-primary rounded-full"
            >
              <Text className="text-white font-black text-[10px] uppercase tracking-widest">Enable EPG</Text>
            </TouchableOpacity> */}
          </View>
        ) : loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color={primary} size="large" />
            <Text className="text-gray-500 dark:text-gray-400 text-sm font-bold mt-6">Syncing schedule...</Text>
          </View>
        ) : epgData[channel.url]?.length > 0 ? (
          <Timetable programs={epgData[channel.url] as Program[]} now={now} onSetLivePosition={handleSetLivePosition} />
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
      
      {/* Structural Header (Sticky in Portrait) */}
      {!isFullScreen && !isTabletLandscape && (
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
      )}

      {/* Persistent Player Boundary - Bound to Root Space */}
      <Animated.View style={[
        isFullScreen 
          ? [StyleSheet.absoluteFill, { 
              zIndex: 9999, elevation: 9999, 
              backgroundColor: 'black' 
            }]
          : isTabletLandscape
            ? { 
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: '60%', // Split screen width for player
                zIndex: 10, elevation: 10,
                backgroundColor: 'black'
              }
            : [{ zIndex: 10, elevation: 10 }, animatedHeroStyle]
      ]}>
        {renderPlayer()}
      </Animated.View>

      {/* Main Structural Layout */}
      {!isFullScreen && (
        isTabletLandscape ? (
          /* Landscape Tablet Split-Screen Layout */
          <View className="flex-1 flex-row">
            {/* The Animated Player already occupies its space due to its z-index/positioning, 
                but we need to ensure the scroll area doesn't overlap it or uses the remainig space. 
                Wait, currently the player is absolutely positioned via AnimatedHeroStyle but only in portrait.
                In isTabletLandscape, we want it side by side.
            */}
            <View className="flex-[1.5] bg-black" /> {/* Spacer for the player which is absolute */}
            
            <View className="flex-1 border-l border-white/10">
               {/* Tablet Specific Header */}
               <View className="flex-row items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20">
                  <View className="flex-1 mr-4">
                    <Text className="text-white text-2xl font-black tracking-tight" numberOfLines={1}>{cleanChannelName}</Text>
                    <View className="flex-row items-center mt-1">
                      <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                      <Text className="text-white/40 text-[10px] font-bold uppercase tracking-[2px]">Live Broadcast</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => toggleFavorite(channel)}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <Feather name="heart" size={20} color={favorited ? primary : "white"} />
                  </TouchableOpacity>
               </View>

               <ScrollView 
                ref={scrollRef}
                className="flex-1"
                bounces={true}
                showsVerticalScrollIndicator={false}
              >
                <View className="pt-4">
                  {renderSchedule()}
                </View>

                <View className="px-8 mt-4 mb-20">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-white text-xl font-black">About Channel</Text>
                  </View>
                  <Text className="text-gray-400 text-sm leading-6">
                    Experience high-fidelity live streaming of {cleanChannelName}. Enjoy a lag-free experience with our optimized signal technology and immersive broadcast quality.
                  </Text>
                  
                  {/* Legal Disclaimer for tablets */}
                  <View className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <View className="flex-row items-center mb-2">
                       <Feather name="shield" size={14} color="#ef4444" />
                       <Text className="text-red-500 font-black text-[10px] uppercase tracking-widest ml-2">Legal Disclaimer</Text>
                    </View>
                    <Text className="text-red-400/80 text-[11px] font-bold leading-5">
                      OrbixPLay or Br31technology does not host, distribute, or store any of the media content shown. All signals are provided directly from publicly available global resources. Use of this application is at your own discretion.
                    </Text>
                  </View>
                  
                  <View className="flex-row flex-wrap gap-2 mt-6">
                    {channel.country && (
                      <View className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{channel.country}</Text>
                      </View>
                    )}
                    {channel.language && (
                      <View className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{channel.language}</Text>
                      </View>
                    )}
                    {channel.category && (
                      <View className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{channel.category}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Scrolling Content Info (Only active in Portrait) */
          <ScrollView 
            ref={scrollRef}
            className="flex-1"
            bounces={true}
            showsVerticalScrollIndicator={false}
          >
            {renderSchedule()}

            <View className="px-8 mt-4 mb-20">
              <View className="flex-row items-center justify-between mb-4">
                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-black'}`}>About Channel</Text>
                <View className="flex-row gap-x-2">
                   {channel.quality && channel.quality !== 'SD' && (
                     <View className={`px-2 py-1 rounded-lg ${channel.quality === '4K' ? 'bg-amber-500' : channel.quality === 'FHD' ? 'bg-blue-600' : 'bg-green-600'}`}>
                       <Text className="text-white font-black text-[9px] uppercase">{channel.quality}</Text>
                     </View>
                   )}
                </View>
              </View>
              
              <View className="flex-row flex-wrap gap-2 mb-6">
                 {channel.country && (
                   <View className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-xl">
                      <Text className="text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">Country: {channel.country}</Text>
                   </View>
                 )}
                 {channel.language && (
                   <View className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-xl">
                      <Text className="text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">Language: {channel.language}</Text>
                   </View>
                 )}
                 {channel.category && (
                   <View className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-xl">
                      <Text className="text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">Category: {channel.category}</Text>
                   </View>
                 )}
              </View>

              <Text className={`text-base leading-7 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Experience high-fidelity live streaming of {cleanChannelName}. Enjoy a lag-free experience with our optimized signal technology and immersive broadcast quality.
              </Text>

              {/* Legal Disclaimer for Mobile Portrait */}
              <View className="mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-[32px]">
                <View className="flex-row items-center mb-3">
                   <Feather name="shield" size={16} color="#ef4444" />
                   <Text className="text-red-500 font-black text-xs uppercase tracking-[3px] ml-3">Legal Disclaimer</Text>
                </View>
                <Text className={`text-xs font-bold leading-6 ${isDark ? 'text-red-400/60' : 'text-red-600/60'}`}>
                  This application acts solely as a media player for streams available across the public internet. We do not host, own, or control any of the content displayed. All trademarks and content belong to their respective owners.
                </Text>
              </View>
            </View>
          </ScrollView>
        )
      )}
    </View>
  );
};

export default ChannelInfo;
