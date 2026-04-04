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
} from 'react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {HomeStackParamList, TabStackParamList} from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList, { SeasonListHandle } from '../../components/SeasonList';
import {Feather, MaterialCommunityIcons, Ionicons} from '@expo/vector-icons';
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

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;
export default function Info({route, navigation}: Props): React.JSX.Element {
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary, mode} = useThemeStore(state => state);
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
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
  const [logoError, setLogoError] = useState(false);
  const seasonListRef = useRef<SeasonListHandle>(null);
  const [nextUpEpisode, setNextUpEpisode] = useState<any>(null);

  const threeDotsRef = useRef<any | null>(null);

  // Memoized computed values first
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
      'https://www.br31tech.live/logo.pngtext=OrbixPlay'
    );
  }, [meta?.poster, route.params.poster, info?.image]);

  const backgroundImage = useMemo(() => {
    return (
      meta?.background ||
      info?.image ||
      'https://www.br31tech.live/logo.pngtext=OrbixPlay'
    );
  }, [meta?.background, info?.image]);

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

  const Badge = ({text, type}: {text: string, type: 'quality' | 'technical'}) => (
    <View className={`px-2 py-0.5 rounded-md mr-1.5 mb-1.5 ${type === 'quality' ? 'bg-primary' : 'bg-white/10 border border-white/10'}`}>
      <Text className="text-white text-[9px] font-black uppercase tracking-widest">{text}</Text>
    </View>
  );

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

          <View className="flex-row items-center space-x-4">
            {filteredLinkList.length > 1 && (
              <View className={isMobileLandscape ? 'w-40' : 'w-56'}>
                <Dropdown
                  selectedTextStyle={{ color: mode === 'dark' ? 'white' : 'black', fontWeight: 'bold', fontSize: isMobileLandscape ? 11 : 13 }}
                  labelField={'title'}
                  valueField={filteredLinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'}
                  onChange={handleSeasonChange}
                  value={activeSeason}
                  data={filteredLinkList}
                  style={{ 
                    borderWidth: 1, 
                    borderColor: borderCol, 
                    paddingHorizontal: 12, 
                    borderRadius: 12, 
                    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', 
                    height: isMobileLandscape ? 38 : 44,
                  }}
                  containerStyle={{ 
                    backgroundColor: mode === 'dark' ? '#121212' : 'white', 
                    borderRadius: 12, 
                    borderWidth: 1, 
                    borderColor: borderCol,
                    overflow: 'hidden',
                  }}
                  itemContainerStyle={{
                    borderBottomWidth: 1,
                    borderBottomColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  }}
                  activeColor={mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                  renderItem={item => {
                    const itemMetadata = extractMetadata(item?.title || '');
                    return (
                      <View className="px-4 py-3 flex-row items-center justify-between">
                        <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-medium flex-1`} numberOfLines={1}>
                          {sanitizeName(item?.title)}
                        </Text>
                        <View className="flex-row items-center ml-2">
                          {[...itemMetadata.quality, ...itemMetadata.technical].slice(0, 2).map((ext, idx) => (
                             <View key={idx} className="bg-primary/20 px-1.5 py-0.5 rounded ml-1 border border-primary/30">
                                <Text className="text-primary text-[8px] font-black uppercase">{ext}</Text>
                             </View>
                          ))}
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
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
          
          {/* Left Column - Large Poster and Actions */}
          <View className={`${isMobileLandscape ? 'w-[28%]' : 'w-[30%]'} h-full rounded-[40px] overflow-hidden`}>
            <View className="h-[80%] rounded-[40px] overflow-hidden border-2 border-white/10 shadow-2xl relative">
              <Image source={{uri: posterImage}} className="w-full h-full" resizeMode="stretch" />
              {/* Poster Badge Overlay */}
              <View className="absolute top-4 right-4 flex-col items-end">
                {metadata.quality.map((q, i) => (
                  <View key={i} className="bg-primary px-2 py-1 rounded-lg mb-1 shadow-lg">
                    <Text className="text-white text-[10px] font-black uppercase">{q}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Main Action Buttons under Poster */}
            <View className="flex-row items-center space-x-2 mt-4 px-1">
              <TouchableOpacity 
                onPress={handleWatchNow} 
                style={{ backgroundColor: '#FF4D3D' }}
                className="flex-1 py-3 px-4 rounded-full flex-row items-center shadow-lg"
              >
                <Ionicons name={nextUpEpisode?.progress > 0 ? "play-forward" : "play"} size={20} color="white" />
                <View className="ml-2 items-start">
                    <Text className="text-white font-black text-[11px] uppercase tracking-[1px]">
                        {nextUpEpisode ? (nextUpEpisode.progress > 0 ? 'Continue' : 'Watch Now') : (info ? 'Watch Again' : 'Watch Now')}
                    </Text>
                    {nextUpEpisode && (
                        <Text className="text-white/60 text-[8px] font-bold uppercase tracking-[0.5px] mt-0.5" numberOfLines={1}>
                            {sanitizeName(nextUpEpisode.title)}
                        </Text>
                    )}
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={inLibrary ? removeLibrary : addLibrary} 
                className={`flex-1 flex-row items-center justify-center py-4 rounded-full border border-white/10 ${mode === 'dark' ? 'bg-secondary/80' : 'bg-black/10'}`}
              >
                <Ionicons name={inLibrary ? "heart" : "heart-outline"} size={22} color={inLibrary ? "#FF4D3D" : mode === 'dark' ? "white" : "black"} />
                <Text className={`ml-2 font-black text-[11px] uppercase tracking-[1px] ${textMain}`}>{inLibrary ? 'In List' : 'List'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Column - Info Cluster */}
          <View className="flex-1 ml-10">
            <View className="flex-1 justify-center space-y-4 pr-6 pb-2">
              <View>
                {meta?.logo ? (
                  <Image source={{uri: meta.logo}} style={{width: isMobileLandscape ? 260 : 360, height: isMobileLandscape ? 70 : 100, resizeMode: 'contain'}} />
                ) : (
                  <Text className={`${textMain} ${isMobileLandscape ? 'text-3xl' : 'text-5xl'} font-black uppercase tracking-tighter`}>{displayTitle}</Text>
                )}
                
                <View className="flex-row items-center mt-4 space-x-3">
                  {(meta?.imdbRating || info?.rating) && (
                    <View className="flex-row items-center bg-yellow-400/10 px-2 py-1 rounded-md border border-yellow-400/20">
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text className="text-yellow-400 ml-1.5 font-black text-sm">{meta?.imdbRating || info?.rating}</Text>
                    </View>
                  )}
                  {(meta?.year || info?.year) && (
                    <Text className={`${textSub} font-black text-sm`}>{meta?.year || info?.year}</Text>
                  )}
                  <Text className={`${textSub} font-black text-[10px] uppercase tracking-widest`}>{route.params.provider || provider.value}</Text>
                </View>
                
                {/* Metadata Badges below title info */}
                <View className="mt-4">
                  <MetadataRow items={[...metadata.quality, ...metadata.technical]} type="technical" />
                </View>
              </View>

              <Text className={`${textSub} ${isMobileLandscape ? 'text-[12px] leading-[18px]' : 'text-[15px] leading-[22px]'} font-bold`}>
                {synopsis}
              </Text>
            </View>

            {/* Episode Carousel - Anchored Bottom Right */}
            <View className={`${isMobileLandscape ? 'h-[240px]' : 'h-[320px]'} -ml-10 -mr-8`}>
              <SeasonList
                ref={seasonListRef}
                onNextUpFound={setNextUpEpisode}
                horizontal
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
                routeParams={route.params}
              />
            </View>
          </View>
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
          <TouchableOpacity onPress={() => navigation.goBack()} className={`w-10 h-10 ${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} rounded-full items-center justify-center border border-white/10`}>
            <Ionicons name="chevron-back" size={24} color={mode === 'dark' ? 'white' : 'black'} />
          </TouchableOpacity>

          <View className={`flex-row items-center ${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} rounded-full px-4 h-10 border border-white/10 flex-1 ml-4`}>
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
                    className={`w-[28px] h-[28px] ${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} rounded-2xl ml-3 items-center justify-center border border-white/10`}
                  >
                    <MaterialCommunityIcons 
                      name={isDescending ? "sort-descending" : "sort-ascending"} 
                      size={18} 
                      color={mode === 'dark' ? 'white' : 'black'} 
                    />
                  </TouchableOpacity>

      </View>

        <FlatList
          data={[]}
          keyExtractor={(_, i) => i.toString()}
          renderItem={() => <View />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View className="px-6 pt-24">
              
              {/* Grand Poster Card - Portrait Centerpiece */}
              <View className="w-full aspect-[2/2.8] rounded-[40px] overflow-hidden border-2 border-white/10 shadow-2xl relative">
                <Image source={{uri: posterImage}} className="w-full h-full" resizeMode="cover" />
                
                {/* Title & Synopsis Overlay at bottom of poster */}
                <View className="absolute bottom-0 left-0 right-0">
                  <LinearGradient 
                    colors={['transparent', 'rgba(0,0,0,0.95)']} 
                    className="pt-20 pb-6 px-6"
                  >
                    <Text className="text-white text-2xl font-black uppercase tracking-tight leading-tight">
                        {displayTitle}
                    </Text>
                    <Text className="text-white/40 text-[9px] font-black uppercase tracking-widest mt-1 mb-3">
                        {route.params.provider || provider.value}
                    </Text>

                    {/* Metadata Badges in Portrait Overlay */}
                    <MetadataRow items={[...metadata.quality, ...metadata.technical]} type="technical" className="mb-3" />

                    <Text className="text-white/70 text-[11px] font-medium leading-4" numberOfLines={2}>
                        {synopsis}
                    </Text>
                  </LinearGradient>
                </View>
                
                {/* Discrete Quality Overlay (Top Right) */}
                <View className="absolute top-6 right-6">
                   {metadata.quality.map((q, i) => (
                    <View key={i} className="bg-primary px-2 py-1 rounded-lg mb-1 shadow-md">
                      <Text className="text-white text-[9px] font-black uppercase">{q}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Action Buttons Row */}
              <View className="flex-row items-center space-x-3 mt-6">
                <TouchableOpacity 
                   onPress={handleWatchNow} 
                   style={{ backgroundColor: '#FF4D3D' }}
                   className="flex-1 py-4 rounded-full flex-row items-center justify-center shadow-lg"
                >
                  <Ionicons name={nextUpEpisode?.progress > 0 ? "play-forward" : "play"} size={20} color="white" />
                  <View className="ml-3 items-start">
                    <Text className="text-white font-black text-[12px] uppercase tracking-[1px]">
                        {nextUpEpisode ? (nextUpEpisode.progress > 0 ? 'Continue' : 'Watch Now') : (info ? 'Watch Again' : 'Watch Now')}
                    </Text>
                    {nextUpEpisode && (
                        <Text className="text-white/60 text-[8px] font-bold uppercase tracking-[0.5px]">
                            {sanitizeName(nextUpEpisode.title)}
                        </Text>
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                   onPress={inLibrary ? removeLibrary : addLibrary} 
                   className={`flex-1 py-4 rounded-full flex-row items-center justify-center border border-white/10 ${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}
                >
                  <Ionicons name={inLibrary ? "heart" : "heart-outline"} size={20} color={inLibrary ? "#FF4D3D" : (mode === 'dark' ? "white" : "black")} />
                  <Text className={`ml-3 font-black text-[12px] uppercase tracking-[1px] ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                    {inLibrary ? 'In List' : 'List'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Season Selection Row */}
              {filteredLinkList.length > 1 && (
                <View className="mt-8 mb-4 flex-row items-center">
                  <View className="flex-1">
                    <Dropdown
                      selectedTextStyle={{ color: mode === 'dark' ? 'white' : 'black', fontWeight: 'bold', fontSize: 13 }}
                      labelField={'title'}
                      valueField={filteredLinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'}
                      onChange={handleSeasonChange}
                      value={activeSeason}
                      data={filteredLinkList}
                      style={{ 
                        borderWidth: 1, 
                        borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
                        paddingHorizontal: 16, 
                        borderRadius: 16, 
                        backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', 
                        height: 54,
                      }}
                      containerStyle={{ 
                        backgroundColor: mode === 'dark' ? '#0a0a0a' : 'white', 
                        borderRadius: 16, 
                        borderWidth: 1, 
                        borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        marginTop: 10,
                      }}
                      activeColor={mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                      renderItem={item => {
                        const itemMetadata = extractMetadata(item?.title || '');
                        return (
                          <View className={`px-4 py-4 border-b border-white/5 flex-row items-center justify-between ${activeSeason === item ? (mode === 'dark' ? 'bg-primary/20' : 'bg-gray-100') : ''}`}>
                            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-medium flex-1`} numberOfLines={1}>
                              {sanitizeName(item?.title)}
                            </Text>
                            <View className="flex-row items-center ml-2">
                              {[...itemMetadata.quality, ...itemMetadata.technical].slice(0, 2).map((ext, idx) => (
                                <View key={idx} className="bg-primary/20 px-1.5 py-0.5 rounded ml-1 border border-primary/30">
                                    <Text className="text-primary text-[8px] font-black uppercase">{ext}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      }}
                    />
                  </View>

               
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
                    routeParams={route.params}
                    onNextUpFound={setNextUpEpisode}
                />
              </View>
            </View>
          }
        />
      </View>
    </QueryErrorBoundary>
  );
}
