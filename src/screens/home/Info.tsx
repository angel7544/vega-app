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
import {cacheStorage, settingsStorage, watchListStorage} from '../../lib/storage';
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

  const handleSeasonChange = useCallback((item: any) => {
    setActiveSeason(item);
    cacheStorage.setString(`ActiveSeason${displayTitle + (route.params.provider || provider.value)}`, JSON.stringify(item));
  }, [displayTitle, route.params.provider, provider.value]);

  // Orientation and Layout
  const isLandscape = windowWidth > windowHeight;
  const isTabletLandscape = isTablet && isLandscape;

  React.useEffect(() => {
    if (isTabletLandscape) {
      setNavBarVisible(false);
    } else {
      setNavBarVisible(true);
    }
    return () => setNavBarVisible(true);
  }, [isTabletLandscape, setNavBarVisible]);

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

  if (isTabletLandscape) {
    const bgPrimary = mode === 'dark' ? 'bg-black' : 'bg-gray-50';
    const textMain = mode === 'dark' ? 'text-white' : 'text-black';
    const textSub = mode === 'dark' ? 'text-white/60' : 'text-black/60';
    const borderCol = mode === 'dark' ? 'border-white/10' : 'border-black/5';
    const cardBg = mode === 'dark' ? 'bg-white/10' : 'bg-black/5';

    return (
      <View className={`flex-1 ${bgPrimary}`}>
        <StatusBar hidden />
        
        {/* Background Backdrop */}
        <View className="absolute inset-0">
          <Image source={{uri: backgroundImage}} className="w-full h-full" resizeMode="cover" />
          <LinearGradient 
            colors={mode === 'dark' ? ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.95)'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.95)']} 
            className="absolute inset-0" 
          />
        </View>

        {/* Top Utility Header */}
        <View className="absolute top-0 left-0 right-0 h-24 flex-row items-center justify-between px-10 z-50">
          <TouchableOpacity onPress={() => navigation.goBack()} className={`w-11 h-11 ${cardBg} rounded-full items-center justify-center border ${borderCol} shadow-sm`}>
            <Ionicons name="chevron-back" size={24} color={mode === 'dark' ? 'white' : 'black'} />
          </TouchableOpacity>

          <View className="flex-row items-center space-x-4">
            {/* Season Selector - Tablet Landscape */}
            {isTabletLandscape && filteredLinkList.length > 1 && (
              <View className="w-56">
                <Dropdown
                  selectedTextStyle={{ color: mode === 'dark' ? 'white' : 'black', fontWeight: 'bold', fontSize: 13 }}
                  labelField={'title'}
                  valueField={filteredLinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'}
                  onChange={handleSeasonChange}
                  value={activeSeason}
                  data={filteredLinkList}
                  style={{ 
                    borderWidth: 1, 
                    borderColor: borderCol, 
                    paddingHorizontal: 16, 
                    borderRadius: 16, 
                    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', 
                    height: 48,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                  }}
                  containerStyle={{ backgroundColor: mode === 'dark' ? '#0a0a0a' : 'white', borderRadius: 16, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: borderCol }}
                  renderItem={item => (
                    <View className={`px-4 py-4 border-b border-white/5 ${activeSeason === item ? (mode === 'dark' ? 'bg-secondary' : 'bg-gray-200') : ''}`}>
                      <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-medium`}>{item?.title}</Text>
                    </View>
                  )}
                />
              </View>
            )}

            {/* Search Bar */}
            <View className={`flex-row items-center ${mode === 'dark' ? 'bg-secondary/40' : 'bg-white'} rounded-2xl px-4 h-12 border ${borderCol} w-72 shadow-sm`}>
              <Ionicons name="search" size={18} color={mode === 'dark' ? '#ffffff40' : '#00000040'} />
              <TextInput
                placeholder="Search series..."
                placeholderTextColor={mode === 'dark' ? '#ffffff40' : '#00000040'}
                className={`flex-1 ml-3 ${textMain} text-xs font-bold`}
                onChangeText={(text: string) => seasonListRef.current?.setSearch(text)}
              />
            </View>
          </View>
        </View>

        <View className="flex-1 justify-between p-12 py-16">
          {/* Main Info Content (Left Side) */}
          <View className="w-3/5 space-y-6 pt-10">
            <View>
              {meta?.logo ? (
                <Image source={{uri: meta.logo}} style={{width: 360, height: 140, resizeMode: 'contain'}} />
              ) : (
                <Text className={`${textMain} text-6xl font-black tracking-tighter leading-tight`}>{displayTitle}</Text>
              )}
              <View className="flex-row items-center mt-6 space-x-3">
                <View className="bg-primary/20 px-3 py-1 rounded-md border border-primary/30 shadow-sm shadow-primary/10">
                  <Text className="text-primary text-[10px] font-black uppercase tracking-[1px]">Original Series</Text>
                </View>
                <Text className={`${textSub} text-[11px] font-black uppercase tracking-widest`}>{route.params.provider || provider.value}</Text>
              </View>
            </View>

            <View className="flex-row items-center space-x-6">
              {(meta?.imdbRating || info?.rating) && (
                <View className="flex-row items-center">
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text className={`${textMain} ml-1.5 font-black text-lg`}>{meta?.imdbRating || info?.rating}</Text>
                </View>
              )}
              {(meta?.year || info?.year) && (
                <Text className={`${textSub} text-xl font-bold`}>{meta?.year || info?.year}</Text>
              )}
            </View>

            <View className="flex-row space-x-6 mt-4">
              <TouchableOpacity 
                onPress={handleWatchNow} 
                style={{ backgroundColor: primary }}
                className="px-10 py-5 rounded-[28px] flex-row items-center shadow-2xl"
              >
                <Ionicons name="play" size={30} color="white" />
                <View className="ml-5 pr-4">
                  <Text className="text-white font-black text-xl leading-tight uppercase tracking-[2px]">Watch Now</Text>
                  {nextUpEpisode && (
                    <Text className="text-white/70 text-[9px] font-black uppercase tracking-[1.5px] mt-1" numberOfLines={1}>
                      Resume: {nextUpEpisode.title} {nextUpEpisode.size ? `• ${nextUpEpisode.size}` : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={inLibrary ? removeLibrary : addLibrary} 
                className={`bg-white flex-row items-center px-12 py-5 rounded-[28px] shadow-2xl shadow-black/20`}
              >
                <Ionicons name={inLibrary ? "heart" : "heart-outline"} size={30} color={inLibrary ? "#EF4444" : "black"} />
                <Text className="ml-4 font-black text-xl text-black uppercase tracking-[2px]">My List</Text>
              </TouchableOpacity>
            </View>

            <Text 
              className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} text-[15px] leading-[26px] font-bold max-w-2xl mt-4`} 
              numberOfLines={isTablet ? 0 : 4}
            >
              {synopsis}
            </Text>
          </View>

          {/* Episode Carousel Group (Bottom Section) */}
          <View className="h-[420px] -mx-12 px-12 pt-4">
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
    );
  }

  return (
    <QueryErrorBoundary>
      <View className="h-full w-full">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor={backgroundColor}
        />
        <View>
          <View className="absolute w-full" style={{height: headerHeight}}>
            <SkeletonLoader show={infoLoading} height={headerHeight} width={'100%'}>
              <Image
                source={{uri: posterImage}}
                className="w-full"
                style={{height: headerHeight}}
                resizeMode="stretch"
                onError={e => {
                  console.warn('Poster image failed to load:', e);
                }}
              />
            </SkeletonLoader>
          </View>

          {
            // manifest[route.params.provider || provider.value].blurImage && (
            //   <BlurView
            //     intensity={4}
            //     blurReductionFactor={1}
            //     experimentalBlurMethod="dimezisBlurView"
            //     tint="default"
            //     style={{
            //       position: 'absolute',
            //       top: 0,
            //       left: 0,
            //       right: 0,
            //       bottom: 0,
            //       height: 256,
            //       width: '100%',
            //     }}
            //   />
            // )
          }
          <FlatList
            data={[]}
            keyExtractor={(_, i) => i.toString()}
            renderItem={() => <View />}
            ListHeaderComponent={
              <>
                <View className="relative w-full" style={{height: headerHeight}}>
                  <LinearGradient
                    colors={['transparent', 'black']}
                    className="absolute h-full w-full"
                  />
                  <View className="absolute bottom-0 right-0 w-screen flex-row justify-between items-baseline px-2">
                    {(meta?.logo && !logoError) || infoLoading ? (
                      <Image
                        onError={() => setLogoError(true)}
                        source={{uri: meta?.logo}}
                        style={{width: 200, height: 100, resizeMode: 'stretch'}}
                      />
                    ) : (
                      <Text className="text-white text-2xl mt-3 capitalize font-semibold w-3/4 truncate">
                        {displayTitle}
                      </Text>
                    )}
                    {/* rating */}
                    {(meta?.imdbRating || info?.rating) && (
                      <Text className="text-white text-2xl font-semibold">
                        {meta?.imdbRating || info?.rating}
                        <Text className="text-white text-lg">/10</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <View className={`p-4 ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
                  <View className="flex-row gap-x-3 gap-y-1 flex-wrap items-center mb-4">
                    {/* badges */}
                    {meta?.year && (
                      <Text className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} text-lg px-2 rounded-md`}>
                        {meta?.year}
                      </Text>
                    )}
                    {meta?.runtime && (
                      <Text className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} text-lg px-2 rounded-md`}>
                        {meta?.runtime}
                      </Text>
                    )}
                    {meta?.genres?.slice(0, 2).map((genre: string) => (
                      <Text
                        key={genre}
                        className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} text-lg px-2 rounded-md`}>
                        {genre}
                      </Text>
                    ))}
                    {info?.tags?.slice(0, 3)?.map((tag: string) => (
                      <Text
                        key={tag}
                        className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} text-lg px-2 rounded-md`}>
                        {tag}
                      </Text>
                    ))}
                  </View>
                  {/* Awards */}
                  {meta?.awards && (
                    <View className="mb-2 w-full flex-row items-baseline gap-2">
                      <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text- font-semibold`}>
                        Awards:
                      </Text>
                      <Text className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} text-xs px-1 rounded-sm`}>
                        {meta?.awards?.length > 50
                          ? meta?.awards.slice(0, 50) + '...'
                          : meta?.awards}
                      </Text>
                    </View>
                  )}
                  {/* synopsis */}
                  <View className="mb-2 w-full flex-row items-center justify-between">
                    <SkeletonLoader show={infoLoading} height={25} width={180}>
                      <View className="flex-row items-center gap-2">
                        <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-lg font-semibold`}>
                          Synopsis
                        </Text>
                        <Text className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} text-xs p-1 px-2 rounded-md`}>
                          {route.params.provider || provider.value}
                        </Text>
                      </View>
                    </SkeletonLoader>
                    <View className="flex-row items-center gap-4 mb-1">
                      {meta?.trailers && meta?.trailers.length > 0 && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(
                              'https://www.youtube.com/watch?v=' +
                                meta?.trailers?.[0]?.source,
                            )
                          }>
                          <Feather
                            name="play-circle"
                            size={24}
                            color="rgb(156 163 175)"
                          />
                        </TouchableOpacity>
                      )}
                      {inLibrary ? (
                        <TouchableOpacity onPress={() => removeLibrary()}>
                          <Ionicons
                            name="heart"
                            size={26}
                            color={primary}
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => addLibrary()}>
                          <Ionicons
                            name="heart-outline"
                            size={26}
                            color="rgb(156 163 175)"
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => openThreeDotsMenu()}
                        ref={threeDotsRef}>
                        <Feather
                          name="more-vertical"
                          size={24}
                          color="rgb(156 163 175)"
                        />
                      </TouchableOpacity>
                      {
                        <Modal
                          animationType="none"
                          transparent={true}
                          visible={threeDotsMenuOpen}
                          onRequestClose={() => {
                            setThreeDotsMenuOpen(false);
                          }}>
                          <Pressable
                            onPress={() => setThreeDotsMenuOpen(false)}
                            className="flex-1 bg-opacity-50">
                            <View
                              className={`rounded-md p-2 w-48 ${mode === 'dark' ? 'bg-quaternary' : 'bg-white border border-gray-200'} absolute right-10 top-[330px]`}
                              style={{
                                top: menuPosition.top,
                                right: menuPosition.right,
                              }}>
                              {/* open in web  */}
                              <TouchableOpacity
                                className="flex-row items-center gap-2"
                                onPress={async () => {
                                  setThreeDotsMenuOpen(false);
                                  navigation.navigate('Webview', {
                                    link: route.params.link,
                                  });
                                }}>
                                <Feather
                                  name="globe"
                                  size={18}
                                  color="rgb(156 163 175)"
                                />
                                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                                  Open in Web
                                </Text>
                              </TouchableOpacity>
                              {/* search */}
                              <TouchableOpacity
                                className="flex-row items-center gap-2 mt-1"
                                onPress={async () => {
                                  setThreeDotsMenuOpen(false);
                                  //@ts-ignore
                                  searchNavigation.navigate('SearchStack', {
                                    screen: 'SearchResults',
                                    params: {
                                      filter: displayTitle,
                                    },
                                  });
                                }}>
                                <Feather
                                  name="search"
                                  size={18}
                                  color="rgb(156 163 175)"
                                />
                                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                                  Search Title
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </Pressable>
                        </Modal>
                      }
                    </View>
                  </View>
                  <SkeletonLoader show={infoLoading} height={85} width={'100%'}>
                    <Text className={`${mode === 'dark' ? 'text-gray-200 bg-tertiary' : 'text-gray-700 bg-gray-200'} text-sm px-2 py-1 rounded-md`}>
                      {synopsis.length > 180 && !readMore
                        ? synopsis.slice(0, 180) + '... '
                        : synopsis}
                      {synopsis.length > 180 && !readMore && (
                        <Text
                          onPress={() => setReadMore(!readMore)}
                          className={`${mode === 'dark' ? 'text-white bg-tertiary' : 'text-black bg-gray-200'} font-extrabold text-xs px-2 rounded-md`}>
                          read more
                        </Text>
                      )}
                    </Text>
                  </SkeletonLoader>
                  {/* cast */}
                </View>
                <View className={`p-4 ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
                  {infoLoading ? (
                    <View className="gap-y-3 items-start mb-4 p-3">
                      <SkeletonLoader show={true} height={30} width={80} />
                      {[...Array(1)].map((_, i) => (
                        <View
                          className={`${mode === 'dark' ? 'bg-tertiary' : 'bg-gray-200'} p-1 rounded-md gap-3 mt-3`}
                          key={i}>
                          <SkeletonLoader
                            show={true}
                            height={20}
                            width={'100%'}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <SeasonList
                      refreshing={false}
                      providerValue={route.params.provider || provider.value}
                      LinkList={filteredLinkList}
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
                  )}
                </View>
              </>
            }
            ListFooterComponent={<View className="h-16" />}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16} // Optimize scroll performance
            refreshControl={
              <RefreshControl
                colors={[primary]}
                tintColor={primary}
                progressBackgroundColor={'black'}
                refreshing={false}
                onRefresh={handleRefresh}
              />
            }
          />
        </View>
      </View>
    </QueryErrorBoundary>
  );
}
