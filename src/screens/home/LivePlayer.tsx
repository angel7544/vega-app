import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Image,
  StatusBar,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useToastStore from '../../lib/zustand/toastStore';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';


import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  FadeIn,
  FadeOutDown,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Program } from '../../types/navigation';
import { cacheStorage, settingsStorage } from '../../lib/storage';
import Orientation, { OrientationLocker, LANDSCAPE } from 'react-native-orientation-locker';
import Video, {
  VideoRef,
  SelectedVideoTrack,
  SelectedVideoTrackType,
  ResizeMode,
  SelectedTrack,
  SelectedTrackType,
} from 'react-native-video';
import useThemeStore from '../../lib/zustand/themeStore';
import * as NavigationBar from 'expo-navigation-bar';

import { iptvParser } from '../../lib/iptvParser';
import { iptvOrgApi } from '../../lib/services/iptvOrgApi';
import usePlayerStore from '../../lib/zustand/playerStore';
import Timetable from '../../components/Timetable';
import { useVideoSettings } from '../../lib/hooks/useStream';
import { usePlayerSettings } from '../../lib/hooks/usePlayerSettings';

type Props = NativeStackScreenProps<RootStackParamList, 'LivePlayer'>;

const goFullScreen = () => {
  if (Platform.OS === 'android') {
    // Hide the navigation bar
    NavigationBar.setVisibilityAsync('hidden');
    // Make it "sticky immersive" (appears on swipe, then hides again)
    NavigationBar.setBehaviorAsync('overlay-swipe');
    StatusBar.setHidden(true, 'slide');
  }
  // `expo-status-bar` handles the top bar
};

const exitFullScreen = () => {
  if (Platform.OS === 'android') {
    // Show the navigation bar
    NavigationBar.setVisibilityAsync('visible');
    // Reset behavior
    NavigationBar.setBehaviorAsync('overlay-swipe');
    StatusBar.setHidden(false, 'slide');
  }
};

interface LivePlayerProps {
  route?: Props['route'];
  channel?: any;
  channels?: any[];
  initialIndex?: number;
  isSubView?: boolean;
}

const LivePlayer = ({ 
  route, 
  channel: propChannel, 
  channels: propChannels = [], 
  initialIndex: propInitialIndex = 0,
  isSubView = false,
}: LivePlayerProps): React.JSX.Element => {
  const { primary } = useThemeStore(state => state);
  const { show: showToastNotify } = useToastStore();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setActiveChannel, favorites, toggleFavorite } = usePlayerStore();

  // Unified Params
  const routeParams = (route?.params || {}) as any;
  const channel = propChannel || routeParams.channel;
  const channels = propChannels.length > 0 ? propChannels : (routeParams.channels || []);
  const initialIndex = propInitialIndex !== 0 ? propInitialIndex : (routeParams.initialIndex || 0);

  // Live TV State
  const [currentChannel, setCurrentChannel] = useState<any>(channel);
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [epgData, setEpgData] = useState<Program[]>([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAudioOptions, setShowAudioOptions] = useState(false);
  // iptv-org API enriched metadata
  const [channelLogo, setChannelLogo] = useState<string | null>(null);
  const [channelCategories, setChannelCategories] = useState<string[]>([]);

  // Player ref
  const playerRef = useRef<VideoRef>(null);
  const hasSetInitialTracksRef = useRef(false);
  const controlTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Shared values for animations
  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingRotation = useSharedValue(0);
  const lockButtonTranslateY = useSharedValue(-150);
  const lockButtonOpacity = useSharedValue(0);
  const textVisibility = useSharedValue(0);
  const speedIconOpacity = useSharedValue(1);
  const controlsTranslateY = useSharedValue(150);
  const controlsOpacity = useSharedValue(0);
  const toastOpacity = useSharedValue(0);
  const settingsTranslateY = useSharedValue(1000);
  const settingsOpacity = useSharedValue(0);

  // Animated styles
  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{ scale: loadingScale.value }],
  }));

  const loadingIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${loadingRotation.value}deg` }],
  }));

  const lockButtonStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lockButtonTranslateY.value }],
    opacity: lockButtonOpacity.value,
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: controlsTranslateY.value }],
    opacity: controlsOpacity.value,
  }));

  const topControlsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -controlsTranslateY.value }],
    opacity: controlsOpacity.value,
  }));

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
  }));

  const settingsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: settingsTranslateY.value }],

    opacity: settingsOpacity.value,
  }));

  // Channel enrichment via iptv-org API (logo, metadata)
  const enrichCurrentChannel = useCallback(async () => {
    if (!currentChannel) return;
    try {
      const country = settingsStorage.getIptvCountry() || 'in';
      const enriched = await iptvOrgApi.enrichChannel(
        currentChannel.tvgId,
        currentChannel.name,
        country.toUpperCase(),
      );
      if (enriched.logo) setChannelLogo(enriched.logo);
      if (enriched.categories?.length) setChannelCategories(enriched.categories);
      // Patch currentChannel with resolved ID for EPG
      if (enriched.iptvOrgId && !currentChannel.iptvOrgId) {
        currentChannel.iptvOrgId = enriched.iptvOrgId;
      }
    } catch (e) {
      console.warn('Channel enrichment failed:', e);
    }
  }, [currentChannel]);

  // EPG Fetching Logic — uses API-resolved canonical channel ID
  const fetchEPG = useCallback(async () => {
    if (!currentChannel) return;
    setEpgLoading(true);
    try {
      const country = settingsStorage.getIptvCountry() || 'in';
      const programs = await iptvParser.fetchEPGForChannel(currentChannel, country);
      setEpgData(programs);
    } catch (e) {
      console.error('Failed to fetch EPG:', e);
    } finally {
      setEpgLoading(false);
    }
  }, [currentChannel]);

  useEffect(() => {
    if (currentChannel) {
      setActiveChannel(currentChannel);
      setEpgData([]);
      setChannelLogo(currentChannel.logo || null);
      setChannelCategories([]);
      // Enrich then fetch EPG in parallel
      enrichCurrentChannel();
      fetchEPG();
    }
  }, [currentChannel?.tvgId, currentChannel?.name, fetchEPG, enrichCurrentChannel]);

  const changeChannel = useCallback((direction: number) => {
    if (!channels || !channels.length) return;
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = channels.length - 1;
    if (nextIndex >= channels.length) nextIndex = 0;

    setCurrentIndex(nextIndex);
    setCurrentChannel(channels[nextIndex]);
    setEpgData([]);
  }, [channels, currentIndex]);

  // Custom hooks for video settings
  const {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    setTextTracks,
    processAudioTracks,
    processVideoTracks,
  } = useVideoSettings();

  // Custom hooks for player settings and UI state
  const {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    playbackRate,
    setPlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    toastMessage,
    showToast,
    isTextVisible,
    isFullScreen,
    handleResizeMode,
    togglePlayerLock,
    toggleFullScreen,
    handleLockedScreenTap,
    unlockButtonTimerRef,
  } = usePlayerSettings();

  const [isInPipMode, setIsInPipMode] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleReload = useCallback(() => {
    setReloadKey(prev => prev + 1);
    showToastNotify('Streaming reloaded', 'info');
  }, [showToastNotify]);

  // Settings values
  const enableSwipeGesture = settingsStorage.isSwipeGestureEnabled();
  const hideSeekButtons = settingsStorage.hideSeekButtons() || false;
  const showMediaControls = settingsStorage.showMediaControls();
  const playbacks = [0.25, 0.5, 1.0, 1.25, 1.35, 1.5, 1.75, 2];

  // Memoized selected tracks
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.INDEX,
    value: 0,
  });

  const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.DISABLED,
  });

  const [selectedVideoTrack, setSelectedVideoTrack] =
    useState<SelectedVideoTrack>({
      type: SelectedVideoTrackType.AUTO,
    });

  // Remote media client for casting
  // const remoteMediaClient = Platform.isTV ? null : useRemoteMediaClient();

  // Memoized format quality function
  const formatQuality = useCallback((quality: string) => {
    if (quality === 'auto') return quality;
    const num = Number(quality);
    if (num > 1080) return '4K';
    if (num > 720) return '1080p';
    if (num > 480) return '720p';
    if (num > 360) return '480p';
    return quality;
  }, []);

  // Memoized error handler
  const handleVideoError = useCallback(
    (e: any) => {
      console.log('LivePlayerError', e);
      showToastNotify('Broadcast interrupted. Try again later.', 'error');
      setShowControls(true);
    },
    [setShowControls, showToastNotify],
  );

  // Reset track selections when channel changes
  useEffect(() => {
    setSelectedAudioTrackIndex(0);
    setSelectedTextTrackIndex(1000);
    setSelectedQualityIndex(1000);
    
    // Reset local selection as well
    setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: 0 });
    setSelectedTextTrack({ type: SelectedTrackType.DISABLED });
    
    hasSetInitialTracksRef.current = false;
  }, [
    currentChannel,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
  ]);

  // Force landscape orientation
  useEffect(() => {
    Orientation.lockToLandscape();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (unlockButtonTimerRef.current) {
        clearTimeout(unlockButtonTimerRef.current);
      }
    };
  }, [unlockButtonTimerRef]);

  // Fullscreen effect
  useFocusEffect(
    useCallback(() => {
      if (isFullScreen) {
        goFullScreen();
      } else {
        exitFullScreen();
      }
      return () => { };
    }, [isFullScreen]),
  );

  // Animation effects
  useEffect(() => {
    if (epgLoading) {
      loadingOpacity.value = withTiming(1, { duration: 800 });
      loadingScale.value = withTiming(1, { duration: 800 });
      loadingRotation.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(180, { duration: 900 })),
          withTiming(180, { duration: 600 }),
          withTiming(360, { duration: 900 }),
          withTiming(360, { duration: 600 }),
        ),
        -1,
      );
    }
  }, [epgLoading]);

  useEffect(() => {
    // Lock button animations
    const shouldShow =
      (isPlayerLocked && showUnlockButton) || (!isPlayerLocked && showControls);
    lockButtonTranslateY.value = withTiming(shouldShow ? 0 : -150, {
      duration: 250,
    });
    lockButtonOpacity.value = withTiming(shouldShow ? 1 : 0, {
      duration: 250,
    });
  }, [isPlayerLocked, showUnlockButton, showControls]);

  useEffect(() => {
    // 2x speed text visibility
    textVisibility.value = withTiming(isTextVisible ? 1 : 0, { duration: 250 });

    // Speed icon blinking animation
    if (isTextVisible) {
      speedIconOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 250 }),
          withTiming(0, { duration: 150 }),
          withTiming(1, { duration: 150 }),
        ),
        -1,
      );
    } else {
      speedIconOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [isTextVisible]);

  useEffect(() => {
    // Controls visibility
    controlsTranslateY.value = withTiming(showControls ? 0 : 150, {
      duration: 250,
    });
    controlsOpacity.value = withTiming(showControls ? 1 : 0, {
      duration: 250,
    });
  }, [showControls]);

  useEffect(() => {
    // Toast visibility
    toastOpacity.value = withTiming(showToast ? 1 : 0, { duration: 250 });
  }, [showToast]);

  useEffect(() => {
    // Settings modal visibility
    settingsTranslateY.value = withTiming(showSettings ? 0 : 600, {
      duration: 350,
    });
    settingsOpacity.value = withTiming(showSettings ? 1 : 0, {
      duration: 300,
    });
  }, [showSettings]);

  useEffect(() => {
    // Handle fullscreen toggle
    if (isFullScreen) {
      goFullScreen();
    } else {
      exitFullScreen();
    }
  }, [isFullScreen]);

  const resetControlTimeout = useCallback(() => {
    if (controlTimeoutRef.current) {
      clearTimeout(controlTimeoutRef.current);
    }
    if (showControls) {
      controlTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
  }, [showControls, setShowControls]);

  useEffect(() => {
    resetControlTimeout();
    return () => {
      if (controlTimeoutRef.current) {
        clearTimeout(controlTimeoutRef.current);
      }
    };
  }, [showControls, isPlayerLocked, currentIndex, resetControlTimeout]);

  // Toggle controls logic for raw Video
  const toggleControls = useCallback(() => {
    if (!isPlayerLocked) {
      const newState = !showControls;
      setShowControls(newState);
      if (newState) {
        resetControlTimeout();
      }
    } else {
      handleLockedScreenTap();
    }
  }, [isPlayerLocked, showControls, setShowControls, handleLockedScreenTap, resetControlTimeout]);

  // Video props mapping
  const videoProps = useMemo(() => ({
    ref: playerRef,
    source: {
      uri: currentChannel?.url || '',
      bufferConfig: {
        minBufferMs: 15000,
        maxBufferMs: 50000,
        bufferForPlaybackMs: 2500,
        bufferForPlaybackAfterRebufferMs: 5000,
      }
    },
    rate: playbackRate,
    poster: currentChannel?.logo || '',
    resizeMode: resizeMode as ResizeMode,
    repeat: true,
    muted: muted,
    paused: isPaused,
    playInBackground: false,
    onLoad: () => {
      playerRef?.current?.resume && playerRef.current.resume();
      setPlaybackRate(1.0);
    },
    onError: handleVideoError,
    // Tracks
    selectedAudioTrack,
    onAudioTracks: (e: any) => processAudioTracks(e.audioTracks),
    selectedTextTrack,
    onTextTracks: (e: any) => setTextTracks(e.textTracks),
    onVideoTracks: (e: any) => processVideoTracks(e.videoTracks),
    selectedVideoTrack,
    // PIP
    pictureInPicture: true,
    onPictureInPictureStatusChanged: (e: any) => setIsInPipMode(e.isActive),
    // Styling
    style: { flex: 1, zIndex: 1 },
  }), [
    currentChannel,
    playbackRate,
    resizeMode,
    isPaused,
    handleVideoError,
    selectedAudioTrack,
    selectedTextTrack,
    selectedVideoTrack,
    processAudioTracks,
    setTextTracks,
    processVideoTracks,
    setIsInPipMode,
  ]);

  // Show loading state
  if (epgLoading && !currentChannel?.url) {
    return (
      <SafeAreaView
        edges={{ right: 'off', top: 'off', left: 'off', bottom: 'off' }}
        className="bg-black flex-1 justify-center items-center">
        <StatusBar translucent={true} hidden={true} />
        <OrientationLocker orientation={LANDSCAPE} />
        <View className="w-full h-full justify-center items-center">
          <Animated.View
            style={[loadingContainerStyle]}
            className="justify-center items-center">
            <Animated.View style={[loadingIconStyle]} className="mb-2">
              <MaterialIcons name="hourglass-empty" size={60} color="white" />
            </Animated.View>
            <Text className="text-white text-lg mt-4">Tuning channel...</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  const Container = isSubView ? View : SafeAreaView;
  const containerProps = isSubView ? { className: "flex-1 relative" } : {
    edges: ['right', 'top', 'left', 'bottom'] as any,
    className: "bg-black flex-1 relative"
  };

  return (
    <Container {...containerProps}>
      {!isSubView && <StatusBar translucent={true} hidden={true} />}
      <OrientationLocker orientation={LANDSCAPE} />
      <View className="flex-1 relative">
        <View style={StyleSheet.absoluteFill}>
          <Video 
            {...videoProps} 
            key={reloadKey}
          />
          {/* Transparent interaction layer to toggle controls */}
          <Pressable 
            onPress={toggleControls}
            style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
          />
        </View>

        {/* Top-Left Title Overlay */}
        {!isInPipMode && (
          <Animated.View 
            pointerEvents="box-none"
            style={[topControlsStyle, { zIndex: 100 }]}
            className="absolute top-6 left-10 p-4 rounded-3xl bg-black/30 border border-white/5 overflow-hidden"
          >
            <BlurView intensity={20} style={StyleSheet.absoluteFill} />
            <View className="flex-row items-center gap-4">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="p-2 bg-white/10 rounded-xl"
              >
                <MaterialIcons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              
              <View className="flex-row items-center gap-3">
                
                <View>
                  <Text className="text-white font-black text-lg" numberOfLines={1}>
                    {currentChannel?.name}
                  </Text>
                  <Text className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                    {currentChannel?.category || 'Live Stream'}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Full-screen overlay to detect taps when locked */}
      {isPlayerLocked && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleLockedScreenTap}
          className="absolute top-0 left-0 right-0 bottom-0 z-40 bg-transparent"
        />
      )}

      {/* Lock/Unlock button */}
      {!isInPipMode && (
        <Animated.View
          style={[lockButtonStyle]}
          className="absolute top-5 right-5 flex-row items-center gap-2 z-50">
          <TouchableOpacity
            onPress={togglePlayerLock}
            className="opacity-70 p-2 rounded-full">
            <MaterialIcons
              name={isPlayerLocked ? 'lock' : 'lock-open'}
              color={'hsl(0, 0%, 70%)'}
              size={24}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (isSubView) {
                // If we're in a subview (tablet side-pane), navigate to full screen player
                showToastNotify('Expanding to full screen...', 'info');
                navigation.navigate('LivePlayer', { channel: currentChannel, channels, initialIndex: currentIndex });
              } else {
                toggleFullScreen();
              }
            }}
            className="opacity-70 p-2 rounded-full">
            <MaterialIcons
              name={isFullScreen ? 'fullscreen-exit' : 'fullscreen'}
              color={'hsl(0, 0%, 70%)'}
              size={24}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom controls - ChannelInfo style horizontal bar */}
      {!isPlayerLocked && !isInPipMode && (
        <Animated.View
          pointerEvents="box-none"
          style={[controlsStyle, { zIndex: 100 }]}
          className="absolute bottom-6 left-6 right-6 h-20 rounded-[32px] bg-black/30 border border-white/5 overflow-hidden flex-row items-center px-4"
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
          
          <View className="flex-1 flex-row items-center justify-between">
            {/* Playback Group */}
            <View className="flex-row items-center gap-x-2">
             

              <TouchableOpacity
                className="w-14 h-14 rounded-full items-center justify-center bg-white/10"
                onPress={() => { setIsPaused(!isPaused); resetControlTimeout(); }}>
                <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={36} color="white" />
              </TouchableOpacity>

              
            </View>

            {/* Live Actions Group */}
            <View className="flex-row items-center gap-x-2">
              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/5"
                onPress={() => { setMuted(!muted); resetControlTimeout(); }}>
                <MaterialIcons name={muted ? "volume-off" : "volume-up"} size={22} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/5"
                onPress={() => { handleReload(); resetControlTimeout(); }}>
                <MaterialIcons name="refresh" size={22} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/5"
                onPress={() => { handleResizeMode(); resetControlTimeout(); }}>
                <MaterialIcons name="aspect-ratio" size={22} color="white" />
              </TouchableOpacity>
            </View>

            {/* Utility Group */}
            <View className="flex-row items-center gap-x-2">
              {!Platform.isTV && (
                <TouchableOpacity
                  className="w-10 h-10 rounded-full items-center justify-center bg-white/5"
                  onPress={() => { playerRef?.current?.enterPictureInPicture(); resetControlTimeout(); }}>
                  <MaterialIcons name="picture-in-picture" size={22} color="white" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/5"
                onPress={() => { setActiveTab('epg'); setShowSettings(true); resetControlTimeout(); }}>
                <MaterialIcons name="schedule" size={22} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-full items-center justify-center bg-white/5"
                onPress={() => { toggleFavorite(currentChannel); resetControlTimeout(); }}>
                <MaterialIcons
                  name={favorites.some(f => f.url === currentChannel?.url) ? 'favorite' : 'favorite-border'}
                  size={22}
                  color={favorites.some(f => f.url === currentChannel?.url) ? primary : 'white'}
                />
              </TouchableOpacity>

              {/* Expandable Settings Hub */}
              <View className="flex-row items-center bg-white/5 rounded-full px-1 py-1">
                {showAudioOptions && (
                  <Animated.View 
                    entering={FadeIn.duration(400)} 
                    exiting={FadeOutDown.duration(300)}
                    className="flex-row gap-x-1"
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
            </View>
          </View>
        </Animated.View>
      )}

      {/* Settings Modal - Centered Glassmorphism Design */}
      {!isPlayerLocked && showSettings && (
        <Animated.View
          style={[settingsStyle, { zIndex: 1000 }]}
          className="absolute top-0 left-0 w-full h-full justify-center items-center"
        >
          {/* Backdrop Blur with tap-to-close */}
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSettings(false)}
          >
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="flex-1 bg-black/40" />
          </Pressable>

          <Animated.View
            entering={FadeIn.duration(400)}
            className="bg-[#121212] w-[75%] max-w-[600px] h-[80%] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden"
          >

            {/* Premium Header Tabs */}
            <View className="flex-row p-2 bg-white/5 rounded-[32px] mx-6 mt-6 mb-6">
              <TouchableOpacity 
                onPress={() => setActiveTab('epg')} 
                className={`flex-1 py-3 items-center rounded-[24px] ${activeTab === 'epg' ? 'bg-white/10 shadow-sm' : ''}`}
              >
                <Text className={`text-sm font-bold tracking-tight ${activeTab === 'epg' ? 'text-white' : 'text-white/40'}`}>Schedule</Text>
              </TouchableOpacity>
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
            </View>

            {/* EPG Tab */}
            {activeTab === 'epg' && (
              <View className="flex-1 px-2">
                {/* Channel header with logo */}
                <View className="flex-row items-center mb-4 gap-3">
                  {channelLogo ? (
                    <Image
                      source={{ uri: channelLogo }}
                      style={{ width: 40, height: 40, borderRadius: 8 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View className="w-10 h-10 rounded-lg bg-white/10 justify-center items-center">
                      <MaterialIcons name="live-tv" size={22} color="white" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-bold text-white" numberOfLines={1}>
                      {currentChannel?.name}
                    </Text>
                    {channelCategories.length > 0 && (
                      <Text className="text-xs text-white/50 capitalize">
                        {channelCategories.join(' · ')}
                      </Text>
                    )}
                  </View>
                  {epgData.length > 0 && (
                    <Text className="text-xs text-white/30">{epgData.length} programs</Text>
                  )}
                </View>

                {epgLoading ? (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color={primary} size="large" />
                    <Text className="text-white/50 text-xs mt-3">Syncing broadcast schedule...</Text>
                  </View>
                ) : (
                  <Timetable programs={epgData as any} />
                )}
              </View>
            )}

            {/* Audio Tab */}
            {activeTab === 'audio' && (
              <ScrollView className="flex-1 px-4">
                <Text className="text-lg font-bold text-white mb-4">Audio Tracks</Text>
                {audioTracks.length === 0 && <Text className="text-white/40 text-center mt-10">No secondary audio tracks found</Text>}
                {audioTracks.map((track: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: i });
                      setSelectedAudioTrackIndex(i);
                      setShowSettings(false);
                    }}
                    className={`flex-row items-center p-4 mb-2 rounded-xl border ${selectedAudioTrackIndex === i ? 'bg-white/10 border-white/20' : 'border-transparent'}`}>
                    <MaterialIcons name="audiotrack" size={20} color={selectedAudioTrackIndex === i ? primary : 'white'} />
                    <Text className={`ml-3 text-lg font-medium ${selectedAudioTrackIndex === i ? 'text-white' : 'text-white/60'}`}>
                      {track.language || `Track ${i + 1}`}
                    </Text>
                    {selectedAudioTrackIndex === i && <View className="ml-auto"><MaterialIcons name="check-circle" size={20} color={primary} /></View>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Subtitle Tab */}
            {activeTab === 'subtitle' && (
              <ScrollView className="flex-1 px-4">
                <Text className="text-lg font-bold text-white mb-4">Subtitles</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTextTrack({ type: SelectedTrackType.DISABLED });
                    setSelectedTextTrackIndex(1000);
                    setShowSettings(false);
                  }}
                  className={`flex-row items-center p-4 mb-2 rounded-xl border ${selectedTextTrackIndex === 1000 ? 'bg-white/10 border-white/20' : 'border-transparent'}`}>
                  <MaterialIcons name="subtitles-off" size={20} color={selectedTextTrackIndex === 1000 ? primary : 'white'} />
                  <Text className={`ml-3 text-lg font-medium ${selectedTextTrackIndex === 1000 ? 'text-white' : 'text-white/60'}`}>Off</Text>
                </TouchableOpacity>
                {textTracks.map((track: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setSelectedTextTrack({ type: SelectedTrackType.INDEX, value: i });
                      setSelectedTextTrackIndex(i);
                      setShowSettings(false);
                    }}
                    className={`flex-row items-center p-4 mb-2 rounded-xl border ${selectedTextTrackIndex === i ? 'bg-white/10 border-white/20' : 'border-transparent'}`}>
                    <MaterialIcons name="subtitles" size={20} color={selectedTextTrackIndex === i ? primary : 'white'} />
                    <Text className={`ml-3 text-lg font-medium ${selectedTextTrackIndex === i ? 'text-white' : 'text-white/60'}`}>
                      {track.language || `Subtitle ${i + 1}`}
                    </Text>
                    {selectedTextTrackIndex === i && <View className="ml-auto"><MaterialIcons name="check-circle" size={20} color={primary} /></View>}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    )}
    </Container>
  );
};

export default LivePlayer;
