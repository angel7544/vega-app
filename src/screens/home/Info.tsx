import {
  Image,
  Text,
  View,
  StatusBar,
  RefreshControl,
  FlatList,
  Linking,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
  TextInput,
  Platform,
  StyleSheet,
  ScrollView,
} from 'react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList, RootStackParamList} from '../../types/navigation';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList, { SeasonListHandle } from '../../components/SeasonList';
import {Feather, MaterialCommunityIcons, Ionicons, MaterialIcons} from '@expo/vector-icons';
import {Dropdown} from 'react-native-element-dropdown';
import {cacheStorage, mainStorage,  settingsStorage, watchListStorage} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import useThemeStore from '../../lib/zustand/themeStore';
import {useNavigation} from '@react-navigation/native';
import useWatchListStore from '../../lib/zustand/watchListStore';
import {useContentDetails} from '../../lib/hooks/useContentInfo';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import SkeletonLoader from '../../components/Skeleton';
import useToastStore from '../../lib/zustand/toastStore';
import useNavBarStore from '../../lib/zustand/navBarStore';
import {sanitizeName, extractMetadata} from '../../lib/utils';
// import {BlurView} from 'expo-blur';
// import Video, { VideoRef, ResizeMode, SelectedTrack, SelectedTrackType } from 'react-native-video';
import { useStream } from '../../lib/hooks/useStream';
import Animated, { FadeIn, FadeOut, FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;
export default function Info({route, navigation}: Props): React.JSX.Element {
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary, mode} = useThemeStore(state => state);
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isTablet = windowWidth > 768;
  const headerHeight = isTablet ? 640 : 450;
  const {addItem, removeItem} = useWatchListStore(state => state);
  const {provider} = useContentStore(state => state);
  const {show} = useToastStore();
  const {setVisible: setNavBarVisible} = useNavBarStore();

  // React Query for optimized data fetching
  const {
    info,
    meta,
    tmdb,
    isLoading: infoLoading,
    error,
    refetch,
  } = useContentDetails(
    route.params.link,
    route.params.provider || provider.value,
  );

  // UI state
  const [threeDotsMenuOpen, setThreeDotsMenuOpen] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [menuPosition, setMenuPosition] = useState({top: -1000, right: 0});
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  // Logo Error Handling
  const [logoError, setLogoError] = useState(false);
  const seasonListRef = useRef<SeasonListHandle>(null);
  const [nextUpEpisode, setNextUpEpisode] = useState<any>(null);

  const threeDotsRef = useRef<any | null>(null);

  // Memoized computed values
  const displayTitle = useMemo(() => {
    return meta?.name || info?.title || '';
  }, [meta?.name, info?.title]);

  const synopsis = useMemo(() => {
    return meta?.description || info?.synopsis || 'No synopsis available';
  }, [meta?.description, info?.synopsis]);

  const posterImage = useMemo(() => {
    return (
      meta?.poster ||
      route.params.poster ||
      info?.image ||
      'https://www.br31tech.live/logo.png?text=OrbixPlay'
    );
  }, [meta?.poster, route.params.poster, info?.image]);

  const backgroundImage = useMemo(() => {
    return (
      meta?.background ||
      info?.image ||
      'https://www.br31tech.live/logo.png?text=OrbixPlay'
    );
  }, [meta?.background, info?.image]);

  const [showEnlargeModal, setShowEnlargeModal] = useState(false);

  const handlePlayOverride = useCallback((data: any) => {
    rootNavigation.navigate('Player', {
      linkIndex: data.linkIndex,
      episodeList: data.episodeList,
      type: info?.type || 'series',
      primaryTitle: displayTitle,
      poster: { poster: posterImage },
      providerValue: route.params.provider || provider.value,
      infoUrl: route.params.link,
    } as any);
  }, [displayTitle, info?.type, posterImage, route.params.link, route.params.provider, provider.value]);

  // Memoized computed values first
  const filteredLinkList = useMemo(() => {
    if (!info?.linkList) return [];
    const excludedQualities = settingsStorage.getExcludedQualities();
    const filtered = info.linkList.filter(
      (item: any) => !item.quality || !excludedQualities.includes(item.quality as string)
    );
    return filtered.length > 0 ? filtered : info.linkList;
  }, [info?.linkList]);

  // Season Management (Depends on filteredLinkList and displayTitle)
  const [activeSeason, setActiveSeason] = useState<any>(null);
  
  useEffect(() => {
    if (filteredLinkList.length > 0) {
      const cached = cacheStorage.getString(`ActiveSeason${displayTitle + (route.params.provider || provider.value)}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const match = filteredLinkList.find((l: any) => l.title === parsed.title);
          if (match) { setActiveSeason(match); return; }
        } catch (e) {}
      }
      setActiveSeason(filteredLinkList[0]);
    }
  }, [filteredLinkList, displayTitle, route.params.provider, provider.value]);

  const [isDescending, setIsDescending] = useState(() => mainStorage.getString('episodeSortOrder') === 'desc');

  const handleSeasonChange = useCallback((item: any) => {
    setActiveSeason(item);
    cacheStorage.setString(`ActiveSeason${displayTitle + (route.params.provider || provider.value)}`, JSON.stringify(item));
  }, [displayTitle, route.params.provider, provider.value]);

  // Orientation and Layout
  const isLandscape = windowWidth > windowHeight;
  const isMobileLandscape = isLandscape && !isTablet;

  React.useEffect(() => {
    if (isLandscape) {
      setNavBarVisible(false);
    } else {
      setNavBarVisible(true);
    }
    return () => setNavBarVisible(true);
  }, [isLandscape, setNavBarVisible]);

  // Library Management
  const [inLibrary, setInLibrary] = useState(() =>
    watchListStorage.isInWatchList(route.params.link),
  );

  useEffect(() => {
    setInLibrary(watchListStorage.isInWatchList(route.params.link));
  }, [route.params.link]);

  const addLibrary = useCallback(() => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    addItem({
      title: displayTitle,
      poster: posterImage,
      link: route.params.link,
      provider: route.params.provider || provider.value,
      genres: tmdb?.genres?.map((g: any) => g.name),
      year: (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0] || meta?.year || info?.year,
      runtime: (tmdb as any)?.runtime || (tmdb as any)?.episode_run_time?.[0],
      type: info?.type || meta?.type as any,
    });
    setInLibrary(true);
  }, [displayTitle, posterImage, route.params.link, route.params.provider, provider.value, addItem]);

  const removeLibrary = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    removeItem(route.params.link);
    setInLibrary(false);
  }, [route.params.link, removeItem]);

  const metadata = useMemo(() => {
    return extractMetadata(info?.title || meta?.name || route.params.link || '');
  }, [info?.title, meta?.name, route.params.link]);

  const Badge = ({text, type}: {text: string, type: 'quality' | 'technical'}) => {
    let bgColor = type === 'quality' ? 'bg-primary' : 'bg-white/10 border border-white/10';
    let textColor = 'text-white';

    if (text === 'DOLBY VISION') {
      bgColor = 'bg-yellow-500';
      textColor = 'text-black';
    } else if (text === 'HDR') {
      bgColor = 'bg-orange-600';
    } else if (text === 'HEVC' || text === 'H265' || text === 'X265') {
      bgColor = 'bg-green-700';
    }

    return (
      <View className={`px-2 py-0.5 rounded-md mr-1.5 mb-1.5 ${bgColor}`}>
        <Text className={`${textColor} text-[9px] font-black uppercase tracking-widest`}>{text}</Text>
      </View>
    );
  };

  const MetadataRow = ({items, type, className}: {items: string[], type: 'quality' | 'technical', className?: string}) => (
    <View className={`flex-row flex-wrap ${className}`}>
      {items.map((item, idx) => (
        <Badge key={idx} text={item} type={type} />
      ))}
    </View>
  );

  // Handlers
  const openThreeDotsMenu = useCallback(() => {
    if (threeDotsRef.current) {
      threeDotsRef.current.measure(
        (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
          setMenuPosition({top: pageY - 35, right: 35});
          setThreeDotsMenuOpen(true);
        }
      );
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    setBackgroundColor(event.nativeEvent.contentOffset.y > 150 ? 'black' : 'transparent');
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing content:', refreshError);
    }
  }, [refetch]);

  const handleWatchNow = useCallback(() => {
    if (seasonListRef.current) {
      seasonListRef.current.playNextUp();
    } else {
      show("Wait for episodes to load...", "info");
    }
  }, [show]);

  // Error handling - show error UI instead of throwing
  if (error) {
    return (
      <View className={`h-full w-full ${mode === 'dark' ? 'bg-black' : 'bg-white'} justify-center items-center p-4`}>
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor="black"
        />
        <Text className="text-red-400 text-lg font-bold mb-4 text-center">
          Failed to load content
        </Text>
        <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-6 text-center`}>
          {error.message ||
            'An unexpected error occurred while loading the content'}
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="bg-red-600 px-6 py-3 rounded-lg mb-4">
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-gray-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLandscape) {
    const bgPrimary = mode === 'dark' ? 'bg-black' : 'bg-gray-50';
    const textMain = mode === 'dark' ? 'text-white' : 'text-black';
    const textSub = mode === 'dark' ? 'text-white/60' : 'text-black/60';
    const borderCol = mode === 'dark' ? 'border-white/10' : 'border-black/5';
    const cardBg = mode === 'dark' ? 'bg-white/10' : 'bg-black/5';

    return (
      <View className={`flex-1 ${bgPrimary}`}>
        <StatusBar hidden />
        
        {/* Background Backdrop - Global */}
        <View className="absolute inset-0">
          <Image source={{uri: backgroundImage}} className="w-full h-full" resizeMode="cover" />
          <LinearGradient 
            colors={mode === 'dark' ? ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.96)'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.98)']} 
            className="absolute inset-0" 
          />
        </View>

        {/* Top Utility Header */}
        <View className="absolute top-0 left-0 right-0 h-20 flex-row items-center justify-between px-8 z-50">
          <TouchableOpacity onPress={() => navigation.goBack()} className={`w-10 h-10 ${cardBg} rounded-full items-center justify-center border ${borderCol}`}>
            <Ionicons name="chevron-back" size={24} color={mode === 'dark' ? 'white' : 'black'} />
          </TouchableOpacity>

          {isTablet && (
            <View className="flex-1 ml-6 mr-4">
              <Text className={`${textMain} text-[16px] font-black uppercase tracking-tight`} numberOfLines={1}>
                {displayTitle}
              </Text>
              <View className="flex-row items-center mt-0.5">
                <Text className={`${textSub} text-[9px] font-black uppercase tracking-widest`}>
                  {(tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0] || meta?.year || info?.year}
                </Text>
                {(tmdb as any)?.vote_average > 0 && (
                  <>
                    <View className="w-1 h-1 rounded-full bg-white/20 mx-2" />
                    <Ionicons name="star" size={10} color="#FFD700" />
                    <Text className={`${textMain} text-[10px] font-black ml-1`}>
                      {(tmdb as any).vote_average.toFixed(1)}
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}

          <View className="flex-row items-center space-x-4">
            {filteredLinkList.length > 1 && isMobileLandscape && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="max-w-[180px]"
                contentContainerStyle={{ alignItems: 'center', paddingRight: 20 }}
              >
                {filteredLinkList.map((item: any, idx: number) => {
                  const isActive = activeSeason?.title === item.title;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleSeasonChange(item)}
                      className={`mr-3 px-4 py-2 rounded-full border ${isActive ? 'bg-primary border-primary' : (mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10')}`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-[1px] ${isActive ? 'text-white' : (mode === 'dark' ? 'text-white/40' : 'text-black/40')}`}>
                        {sanitizeName(item.title)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View className={`flex-row items-center ${mode === 'dark' ? 'bg-secondary/40' : 'bg-white'} rounded-xl px-4 ${isMobileLandscape ? 'h-9 w-40' : 'h-11 w-64'} border ${borderCol}`}>
              <Ionicons name="search" size={isMobileLandscape ? 14 : 18} color={mode === 'dark' ? '#ffffff40' : '#00000040'} />
              <TextInput
                placeholder="Search..."
                placeholderTextColor={mode === 'dark' ? '#ffffff40' : '#00000040'}
                className={`flex-1 ml-3 ${textMain} ${isMobileLandscape ? 'text-[10px]' : 'text-xs'} font-bold`}
                onChangeText={(text: string) => seasonListRef.current?.setSearch(text)}
              />
            </View>

            <TouchableOpacity 
              onPress={() => {
                seasonListRef.current?.toggleSort();
                setIsDescending(seasonListRef.current?.getSortOrder() === 'desc');
              }}
              className={`w-11 h-11 ${cardBg} rounded-xl items-center justify-center border ${borderCol}`}
            >
              <MaterialCommunityIcons 
                name={isDescending ? "sort-descending" : "sort-ascending"} 
                size={22} 
                color={mode === 'dark' ? 'white' : 'black'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Side-by-Side Content */}
        <View className="flex-1 flex-row pt-20 px-8">
          
          {/* Left Column - Info & Actions */}
          <View className={`${isMobileLandscape ? 'w-[28%]' : 'w-[32%]'} h-full px-1`}>
            {/* Logo/Title moved to Left Column top */}
            <View className="mb-6">
              {meta?.logo ? (
                <Image source={{uri: meta.logo}} style={{width: isMobileLandscape ? 220 : 320, height: isMobileLandscape ? 60 : 90, resizeMode: 'contain'}} />
              ) : (
                <Text className={`${textMain} ${isMobileLandscape ? 'text-2xl' : 'text-4xl'} font-black uppercase tracking-tighter`}>{displayTitle}</Text>
              )}
              
              <View className="flex-row items-center mt-3 space-x-3">
                {(meta?.year || info?.year || (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0]) && (
                  <Text className={`${textSub} font-black text-xs`}>{(meta?.year || info?.year || (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0])}</Text>
                )}
                <View className="w-1 h-1 rounded-full bg-white/20" />
                <Text className={`${textSub} font-black text-[9px] uppercase tracking-widest`}>{route.params.provider || provider.value}</Text>
                
                {((tmdb as any)?.vote_average > 0) && (
                  <>
                    <View className="w-1 h-1 rounded-full bg-white/20" />
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text className={`${textMain} font-black text-xs ml-1`}>{(tmdb as any).vote_average.toFixed(1)}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Created By moved to Left Column under title info */}
              {isTablet && ((tmdb as any)?.created_by?.length > 0) && (
                <View className="mt-3 flex-row flex-wrap items-center">
                  <Text className={`${textSub} text-[9px] font-black uppercase tracking-widest`}>Created By: </Text>
                  <Text className={`${textMain} text-[9px] font-black uppercase tracking-widest`}>{(tmdb as any).created_by.map((c: any) => c.name).join(', ')}</Text>
                </View>
              )}
            </View>

            {/* Poster / Trailer Area */}
            <View className="aspect-video w-full rounded-[40px] overflow-hidden border-2 border-white/10 shadow-2xl relative bg-black">
              <Image source={{uri: backgroundImage}} className="w-full h-full" resizeMode="cover" />
              <View className="absolute top-4 right-4 flex-col items-end">
                {metadata.quality.map((q, i) => (
                  <View key={i} className="bg-primary px-2 py-1 rounded-lg mb-1 shadow-lg">
                    <Text className="text-white text-[10px] font-black uppercase">{q}</Text>
                  </View>
                ))}
              </View>

              {/* Enlarge Button */}
              <TouchableOpacity 
                 onPress={() => setShowEnlargeModal(true)}
                 className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/60 items-center justify-center border border-white/20"
              >
                <Ionicons name="expand" size={18} color="white" />
              </TouchableOpacity>
            </View>

            {/* Main Action Buttons: Resume & Watch Now moved here */}
            <View className="mt-6 flex-col gap-y-3">
              {nextUpEpisode ? (
                /* Resume Episode Button */
                <TouchableOpacity 
                  onPress={handleWatchNow}
                  className="flex-row items-center bg-primary border border-primary/30 p-4 rounded-3xl shadow-xl shadow-primary/30"
                >
                  <View className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-lg">
                    <Ionicons name="play-forward" size={20} color={primary} />
                  </View>
                  <View className="ml-4 flex-1">
                     <Text className="text-white font-black text-[10px] uppercase tracking-widest">Resume Episode</Text>
                     <Text className="text-white/80 font-bold text-xs" numberOfLines={1}>{sanitizeName(nextUpEpisode.title)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </TouchableOpacity>
              ) : (
                /* Regular Watch Now Button */
                <TouchableOpacity 
                  onPress={handleWatchNow} 
                  style={{ backgroundColor: '#FF4D3D' }}
                  className="w-full py-4 px-6 rounded-3xl flex-row items-center justify-center shadow-xl shadow-red-600/30"
                >
                  <Ionicons name="play" size={22} color="white" />
                  <Text className="text-white font-black text-[12px] uppercase tracking-[1.5px] ml-3">
                    {info ? 'Watch Again' : 'Watch Now'}
                  </Text>
                </TouchableOpacity>
              )}
              
              <View className="flex-row items-center gap-x-3">
                <TouchableOpacity 
                   onPress={() => Linking.openURL(route.params.link)}
                   className={`flex-1 h-14 items-center justify-center flex-row rounded-3xl border border-white/10 ${mode === 'dark' ? 'bg-white/5 shadow-xl shadow-black/40' : 'bg-black/5 shadow-sm'}`}
                >
                  <Ionicons name="link" size={20} color={mode === 'dark' ? "white" : "black"} />
                  <Text className={`${textMain} text-[10px] font-black uppercase tracking-widest ml-2`}>Visit Site</Text>
                </TouchableOpacity>
                {/* Heart Button removed as per tablet landscape request */}
              </View>
            </View>

            {/* Cast & Crew Section for Tablet Landscape */}
            {isTablet && tmdb?.credits && (
              <View className="mt-8 px-1">
                <Text className={`${textMain} font-black text-[10px] uppercase tracking-widest opacity-40 mb-3`}>Cast & Crew</Text>
                <View className="flex-row flex-wrap">
                  {(tmdb.credits.cast as any[])?.slice(0, 4).map((person: any, idx: number) => (
                    <View key={idx} className="flex-row items-center mr-4 mb-3">
                       <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center border border-white/5 overflow-hidden">
                          {person.profile_path ? (
                            <Image source={{uri: `https://image.tmdb.org/t/p/w200${person.profile_path}`}} className="w-full h-full" resizeMode="cover" />
                          ) : (
                            <Ionicons name="person" size={14} color="gray" />
                          )}
                       </View>
                       <View className="ml-2">
                          <Text className={`${textMain} text-[9px] font-black`} numberOfLines={1}>{person.name}</Text>
                          <Text className={`${textSub} text-[7px] font-bold`} numberOfLines={1}>{person.character}</Text>
                       </View>
                    </View>
                  ))}
                  
                  {(tmdb.credits.crew as any[])?.filter((p: any) => p.job === 'Director' || p.job === 'Producer' || p.job === 'Executive Producer').slice(0, 2).map((person: any, idx: number) => (
                    <View key={`crew-${idx}`} className="flex-row items-center mr-4 mb-3">
                       <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center border border-white/5 overflow-hidden">
                          {person.profile_path ? (
                            <Image source={{uri: `https://image.tmdb.org/t/p/w200${person.profile_path}`}} className="w-full h-full" resizeMode="cover" />
                          ) : (
                            <Ionicons name="person" size={14} color="gray" />
                          )}
                       </View>
                       <View className="ml-2">
                          <Text className={`${textMain} text-[9px] font-black`} numberOfLines={1}>{person.name}</Text>
                          <Text className={`${textSub} text-[7px] font-bold`} numberOfLines={1}>{person.job}</Text>
                       </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>



          {/* Right Column - Info Cluster & Episodes */}
          <ScrollView 
            className="flex-1 ml-10" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            <View className="pr-6 pb-2">
              <View>
                {/* Logo/Title and basic metadata removed from here (now in Left Column) */}
                
                {/* Metadata Badges below title info */}
                <View className="mt-2">
                  <MetadataRow items={[...metadata.quality, ...metadata.technical]} type="technical" />
                </View>
              </View>

              <Text className={`${textSub} ${isMobileLandscape ? 'text-[12px] leading-[18px]' : 'text-[15px] leading-[22px]'} font-bold mt-4`}>
                {synopsis}
              </Text>
            </View>

            {/* Tablet-Specific Season Controls (Landscape) */}
            {isTablet && (
              <View className="mt-6 mb-4">
                 {/* Resume button removed from here (now in Left Column) */}

                 {filteredLinkList.length > 1 && (
                   <View className="mb-6">
                     <Text className={`${textMain} font-black text-[10px] uppercase tracking-widest mb-3 opacity-40 ml-1`}>Select Season</Text>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                       {filteredLinkList.map((item: any, idx: number) => {
                         const isActive = activeSeason?.title === item.title;
                         return (
                           <TouchableOpacity
                             key={idx}
                             onPress={() => handleSeasonChange(item)}
                             className={`mr-3 px-6 py-3 rounded-2xl border ${isActive ? 'bg-primary border-primary shadow-lg shadow-primary/30' : (mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-black/5')}`}
                           >
                             <Text className={`font-black text-[11px] uppercase tracking-[1px] ${isActive ? 'text-white' : (mode === 'dark' ? 'text-white/40' : 'text-black/40')}`}>
                               {sanitizeName(item.title)}
                             </Text>
                           </TouchableOpacity>
                         );
                       })}
                     </ScrollView>
                   </View>
                 )}
              </View>
            )}

            {/* Episode List - Vertical Scroll on Tablet Landscape */}
            <View className={`${isMobileLandscape ? 'h-[240px]' : ''} -ml-10 -mr-8 mt-2`}>
              <SeasonList
                ref={seasonListRef}
                onNextUpFound={setNextUpEpisode}
                horizontal={isMobileLandscape} // Only horizontal on phone landscape
                refreshing={false}
                providerValue={route.params.provider || provider.value}
                LinkList={filteredLinkList}
                activeSeasonProp={activeSeason}
                onSeasonChangeProp={handleSeasonChange}
                poster={{
                  logo: meta?.logo,
                  poster: posterImage,
                  background: backgroundImage,
                }}
                meta={meta}
                screenshots={info?.screenshots}
                type={info?.type || 'series'}
                metaTitle={displayTitle}
                tmdbData={tmdb}
                routeParams={route.params}
                onPlayOverride={handlePlayOverride}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <QueryErrorBoundary>
      <View className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-gray-50'}`}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        
        {/* Floating Top Header */}
        <View className="absolute top-0 left-0 right-0 h-24 flex-row items-center justify-between px-6 z-50 pt-8">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className={`w-10 h-10 ${mode === 'dark' ? 'bg-white/10' : 'bg-white'} rounded-full items-center justify-center border ${mode === 'dark' ? 'border-white/10' : 'border-black/10 shadow-sm shadow-black/20'}`}
          >
            <Ionicons name="chevron-back" size={24} color={mode === 'dark' ? 'white' : 'black'} />
          </TouchableOpacity>

          {(isTablet || backgroundColor !== 'transparent') && (
            <View className="flex-1 ml-4 mr-2">
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-[14px] font-black uppercase tracking-tight`} numberOfLines={1}>
                {displayTitle}
              </Text>
              <View className="flex-row items-center">
                <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-[8px] font-black uppercase tracking-widest`}>
                  {(tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0] || meta?.year || info?.year}
                </Text>
                {(tmdb as any)?.vote_average > 0 && (
                  <>
                    <View className="w-1 h-1 rounded-full bg-white/20 mx-2" />
                    <Ionicons name="star" size={8} color="#FFD700" />
                    <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} text-[9px] font-black ml-1`}>
                      {(tmdb as any).vote_average.toFixed(1)}
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}

          <View className={`flex-row items-center ${mode === 'dark' ? 'bg-white/10' : 'bg-white'} rounded-full px-4 h-10 border ${mode === 'dark' ? 'border-white/10' : 'border-black/10 shadow-sm shadow-black/20'} ${isTablet ? 'w-48' : 'flex-1'} ml-2`}>
            <Ionicons name="search" size={16} color={mode === 'dark' ? '#ffffff50' : '#00000040'} />
            <TextInput
                placeholder="Search..."
                placeholderTextColor={mode === 'dark' ? '#ffffff40' : '#00000040'}
                className={`flex-1 ml-2 ${mode === 'dark' ? 'text-white' : 'text-black'} text-[11px] font-bold`}
                onChangeText={(text: string) => seasonListRef.current?.setSearch(text)}
            />
          </View>
          <TouchableOpacity 
            onPress={() => {
                seasonListRef.current?.toggleSort();
                setIsDescending(seasonListRef.current?.getSortOrder() === 'desc');
            }}
            className={`w-[32px] h-[32px] ${mode === 'dark' ? 'bg-white/10' : 'bg-white'} rounded-full ml-3 items-center justify-center border ${mode === 'dark' ? 'border-white/10' : 'border-black/10 shadow-sm shadow-black/20'}`}
          >
            <MaterialCommunityIcons 
              name={isDescending ? "sort-descending" : "sort-ascending"} 
              size={18} 
              color={mode === 'dark' ? 'white' : 'black'} 
            />
          </TouchableOpacity>

      </View>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={[]}
          keyExtractor={(_, i) => i.toString()}
          renderItem={() => <View />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View className={isTablet ? "px-10 pt-32" : "px-6 pt-24"}>
              
              <View className={isTablet ? "flex-row items-start" : "flex-col"}>
                {/* Grand Banner - Portrait Centerpiece */}
                <View className={isTablet ? "w-[58%] aspect-[16/9]" : "w-full aspect-video rounded-[30px] overflow-hidden border-2 border-white/10 shadow-2xl relative bg-black"}>
                  <View className="w-full h-full rounded-[30px] overflow-hidden">
                    <Image source={{uri: backgroundImage}} className="w-full h-full" resizeMode="cover" />
                  </View>
                  
                  {/* Enlarge Button */}
                  <TouchableOpacity 
                    onPress={() => setShowEnlargeModal(true)}
                    className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-black/60 items-center justify-center border border-white/20"
                  >
                    <MaterialIcons name="expand" size={24} color="white" />
                  </TouchableOpacity>

                  {/* Discrete Quality Overlay (Top Right) */}
                  <View className="absolute top-6 right-6">
                    {metadata.quality.map((q, i) => (
                      <View key={i} className="bg-primary px-2 py-1 rounded-lg mb-1 shadow-md">
                        <Text className="text-white text-[9px] font-black uppercase">{q}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Info Cluster for Tablet Split or mobile stack */}
                <View className={isTablet ? "flex-1 pl-12 pt-4" : "w-full mt-6"}>
                  {/* Metadata Cluster - Unified for Mobile/Tablet */}
                  <View className={`${isTablet ? 'mb-8' : 'mb-6 mt-4'}`}>
                    {meta?.logo ? (
                      <Image source={{uri: meta.logo}} style={{width: isTablet ? 320 : 220, height: isTablet ? 100 : 70, resizeMode: 'contain'}} />
                    ) : (
                      <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} ${isTablet ? 'text-5xl' : 'text-3xl'} font-black uppercase tracking-tight`}>{displayTitle}</Text>
                    )}

                    <View className="flex-row items-center mt-3 flex-wrap">
                      {(meta?.year || info?.year || (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0]) && (
                        <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} font-black ${isTablet ? 'text-sm' : 'text-xs'}`}>
                          {(meta?.year || info?.year || (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0])}
                        </Text>
                      )}
                      <View className={`w-1 h-1 rounded-full bg-white/20 ${isTablet ? 'mx-3' : 'mx-2'}`} />
                      <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} font-black ${isTablet ? 'text-[10px]' : 'text-[9px]'} uppercase tracking-widest`}>
                        {route.params.provider || provider.value}
                      </Text>
                      
                      {(tmdb as any)?.vote_average > 0 && (
                        <>
                          <View className={`w-1 h-1 rounded-full bg-white/20 ${isTablet ? 'mx-3' : 'mx-2'}`} />
                          <View className="flex-row items-center">
                            <Ionicons name="star" size={isTablet ? 12 : 10} color="#FFD700" />
                            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-black ${isTablet ? 'text-sm' : 'text-xs'} ml-1`}>
                              {(tmdb as any).vote_average.toFixed(1)}
                            </Text>
                            <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} font-bold ${isTablet ? 'text-[9px]' : 'text-[8px]'} ml-1`}>
                              ({(tmdb as any).vote_count})
                            </Text>
                          </View>
                        </>
                      )}

                      {((tmdb as any)?.runtime > 0 || (tmdb as any)?.episode_run_time?.length > 0) && (
                        <>
                          <View className={`w-1 h-1 rounded-full bg-white/20 ${isTablet ? 'mx-3' : 'mx-2'}`} />
                          <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} font-black ${isTablet ? 'text-[10px]' : 'text-[9px]'} uppercase`}>
                            {(tmdb as any).runtime ? `${(tmdb as any).runtime}m` : `${(tmdb as any).episode_run_time[0]}m`}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons Row - Only show if not redundant on tablet */}
                  {(!isTablet || !nextUpEpisode) && (
                    <View className="flex-row items-center space-x-3">
                      <TouchableOpacity 
                         onPress={handleWatchNow} 
                         style={{ backgroundColor: '#FF4D3D' }}
                         className="flex-1 py-3.5 rounded-full flex-row items-center justify-center shadow-lg"
                      >
                        <Ionicons name={nextUpEpisode?.progress > 0 ? "play-forward" : "play"} size={18} color="white" />
                        <View className="ml-3 items-start">
                          <Text className="text-white font-black text-[11px] uppercase tracking-[1px]">
                              {nextUpEpisode ? (nextUpEpisode.progress > 0 ? 'Continue' : 'Watch Now') : (info ? 'Watch Again' : 'Watch Now')}
                          </Text>
                          {nextUpEpisode && !isTablet && (
                              <Text className="text-white/60 text-[7px] font-bold uppercase tracking-[0.5px]">
                                  {sanitizeName(nextUpEpisode.title)}
                              </Text>
                          )}
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity 
                         onPress={inLibrary ? removeLibrary : addLibrary} 
                         className={`flex-1 py-3.5 rounded-full flex-row items-center justify-center border border-white/10 ${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}
                      >
                        <Ionicons name={inLibrary ? "heart" : "heart-outline"} size={18} color={inLibrary ? "#FF4D3D" : (mode === 'dark' ? "white" : "black")} />
                          <Text className={`ml-3 font-black text-[11px] uppercase tracking-[1px] ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                            {inLibrary ? 'In List' : 'List'}
                          </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                         onPress={() => Linking.openURL(route.params.link)}
                         className={`px-4 py-3.5 rounded-full flex-row items-center justify-center border border-white/10 ${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}
                      >
                        <Ionicons name="link" size={18} color={mode === 'dark' ? "white" : "black"} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Synopsis Section */}
                  <View className="mt-8">
                    <View className="relative">
                      <Text 
                        className={`${mode === 'dark' ? 'text-white/70' : 'text-black/70'} ${isTablet ? 'text-[15px] leading-[26px]' : 'text-[13px] leading-[22px]'} font-medium`}
                        numberOfLines={readMore ? undefined : (isTablet ? 6 : 3)}
                      >
                        {synopsis}
                      </Text>
                      {synopsis.length > 150 && (
                        <TouchableOpacity onPress={() => setReadMore(!readMore)} className="mt-2 self-start">
                          <Text className="text-primary font-black text-[10px] uppercase tracking-[2px]">
                            {readMore ? 'Show Less' : 'Read More'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Tablet-Specific Continue CTA (Portrait) */}
              {isTablet && nextUpEpisode && (
                 <TouchableOpacity 
                   onPress={handleWatchNow}
                   className="mt-10 mx-6 bg-primary/20 border border-primary/30 p-5 rounded-[32px] flex-row items-center"
                 >
                   <View className="w-14 h-14 rounded-full bg-primary items-center justify-center shadow-2xl">
                     <Ionicons name="play-forward" size={28} color="white" />
                   </View>
                   <View className="ml-5 flex-1">
                      <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-black text-xs uppercase tracking-[2px]`}>Continue Watching</Text>
                      <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} font-bold text-base mt-1`} numberOfLines={1}>{sanitizeName(nextUpEpisode.title)}</Text>
                   </View>
                   <Ionicons name="chevron-forward" size={24} color={primary} className="mr-2" />
                 </TouchableOpacity>
              )}

              {/* Season Selection Tabs */}
              {filteredLinkList.length > 1 && (
                <View className="mt-8 mb-4">
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 }}
                    className="flex-row"
                  >
                    {filteredLinkList.map((item: any, idx: number) => {
                      const isActive = activeSeason?.title === item.title;
                      const itemMetadata = extractMetadata(item?.title || '');
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleSeasonChange(item)}
                          className={`mr-3 px-6 py-3 rounded-2xl flex-row items-center border ${isActive ? 'bg-primary border-primary shadow-lg shadow-primary/30' : (mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-black/5')}`}
                        >
                          <Text className={`font-black text-[11px] uppercase tracking-[1px] ${isActive ? 'text-white' : (mode === 'dark' ? 'text-white/40' : 'text-black/40')}`}>
                            {sanitizeName(item.title)}
                          </Text>
                          {isActive && itemMetadata.quality.length > 0 && (
                             <View className="ml-2 bg-white/20 px-1.5 py-0.5 rounded">
                                <Text className="text-white text-[7px] font-black uppercase">{itemMetadata.quality[0]}</Text>
                             </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Episode List (Premium Vertical Mode) */}
              <View className="mt-4">
                <SeasonList
                    ref={seasonListRef}
                    refreshing={false}
                    providerValue={route.params.provider || provider.value}
                    LinkList={filteredLinkList}
                    activeSeasonProp={activeSeason}
                    onSeasonChangeProp={handleSeasonChange}
                    poster={{
                        logo: meta?.logo,
                        poster: posterImage,
                        background: backgroundImage,
                    }}
                    meta={meta}
                    screenshots={info?.screenshots}
                    type={info?.type || 'series'}
                    metaTitle={displayTitle}
                    tmdbData={tmdb}
                    routeParams={route.params}
                    onNextUpFound={setNextUpEpisode}
                    onPlayOverride={handlePlayOverride}
                />
              </View>
              {/* TMDb Attribution */}
              <View className="mt-12 mb-6 items-center opacity-40">
                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-[10px] text-center font-medium`}>
                  OrbixPlay uses the TMDb API but is not endorsed or certified by TMDb.
                </Text>
              </View>
            </View>
          }
        />

        {/* Enlarge Poster Modal */}
        <Modal transparent visible={showEnlargeModal} animationType="fade" statusBarTranslucent>
          <View className="flex-1 bg-black justify-center items-center">
            <TouchableOpacity 
              onPress={() => setShowEnlargeModal(false)}
              className="absolute top-12 right-6 z-50 w-12 h-12 rounded-full bg-white/10 items-center justify-center"
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            <Image source={{uri: posterImage}} className="w-full h-full" resizeMode="contain" />
            
            <View className="absolute bottom-12 left-0 right-0 items-center">
              <Text className="text-white text-2xl font-black uppercase tracking-tighter shadow-lg shadow-black">{displayTitle}</Text>
            </View>
          </View>
        </Modal>
      </View>
    </QueryErrorBoundary>
  );
}
