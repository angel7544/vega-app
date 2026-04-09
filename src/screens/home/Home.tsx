import {
  SafeAreaView,
  ScrollView,
  RefreshControl,
  View,
  Text,
} from 'react-native';
import Slider from '../../components/Slider';
import React, {useCallback, useMemo, useState} from 'react';
import {mainStorage, settingsStorage} from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import {
  useHomePageData,
  getRandomHeroPost,
  getHeroPosts,
  clearHeroCache,
} from '../../lib/hooks/useHomePageData';
import {useShowNavBarOnScroll} from '../../lib/hooks/useShowNavBarOnScroll';
import useThemeStore from '../../lib/zustand/themeStore';
import ProviderDrawer from '../../components/ProviderDrawer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../types/navigation';
import {Drawer} from 'react-native-drawer-layout';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useWindowDimensions} from 'react-native';
import ContinueWatching from '../../components/ContinueWatching';
import {providerManager} from '../../lib/services/ProviderManager';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';
import LiveTVHomeSlider from '../../components/LiveTVHomeSlider';
import {iptvParser} from '../../lib/iptvParser';
import usePlayerStore from '../../lib/zustand/playerStore';
import HeroCarousel from '../../components/HeroCarousel';
import CategorySidebar from '../../components/CategorySidebar';
import useNavBarStore from '../../lib/zustand/navBarStore';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const Home = ({}: Props) => {
  const themeState = useThemeStore();
  const primary = themeState?.primary || '#E50914';
  const mode = themeState?.mode || 'dark';
  
  const navBarHook = useShowNavBarOnScroll();
  const handleNavBarScroll = navBarHook?.handleScroll;
  
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const {isNavBarVisible, isDrawerOpen, setDrawerOpen} = useNavBarStore();

  // Memoize static values
  const disableDrawer = useMemo(
    () => mainStorage.getBool('disableDrawer') || false,
    [],
  );

  const contentState = useContentStore();
  const provider = contentState?.provider;
  const installedProviders = contentState?.installedProviders;
  
  const heroState = useHeroStore();
  const setHero = heroState?.setHero;
  
  const {favorites} = usePlayerStore();
  const [sportsChannels, setSportsChannels] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // Settings for home sections
  const showFavChannels = useMemo(() => settingsStorage.getBool('showFavChannelsHome', true), []);
  const showSportsChannels = useMemo(() => settingsStorage.getBool('showSportsChannelsHome', true), []);

  // React Query for home page data with better error handling
  const {
    data: homeData = [],
    isLoading,
    error,
    refetch,
    isRefetching,
    // isStale,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
  });

  // Memoized scroll handler
  const handleScroll = useCallback((event: any) => {
    // Navbar color logic
    const newBackgroundColor =
      event.nativeEvent.contentOffset.y > 0
        ? mode === 'dark'
          ? 'black'
          : '#f8f9fa'
        : 'transparent';
    setBackgroundColor(newBackgroundColor);

    // Auto-hide navbar logic
    handleNavBarScroll?.(event);
  }, [mode, handleNavBarScroll]);

  // Stable hero selection
  const heroPosts = useMemo(() => {
    return getHeroPosts(homeData);
  }, [homeData]);

  const heroPost = useMemo(() => {
    return getRandomHeroPost(homeData, provider?.value);
  }, [homeData, provider?.value]);

  // Use a ref to track the last hero set to prevent update loops when using whole store state
  const lastHeroSetRef = React.useRef<string | null>(null);

  // Update hero
  React.useEffect(() => {
    if (heroPost) {
      setHero?.(heroPost);
    } else {
      setHero?.({link: '', image: '', title: ''});
    }
  }, [heroPost, setHero]);

  // Fetch Live TV data for home sliders
  React.useEffect(() => {
    if (showSportsChannels) {
      setLiveLoading(true);
      iptvParser.fetchByCountry('in')
        .then(data => {
          const sports = data.filter(c => (c.category || '').toLowerCase().includes('sports') || c.name.toLowerCase().includes('sports'));
          setSportsChannels(sports.slice(0, 15));
        })
        .finally(() => setLiveLoading(false));
    }
  }, [showSportsChannels]);

  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const isTablet = windowWidth > 768;

  const scrollRef = React.useRef<ScrollView>(null);
  const sectionOffsets = React.useRef<{[key: string]: number}>({});

  const catalogs = useMemo(() => {
    return provider?.value ? providerManager.getCatalog({providerValue: provider.value}) : [];
  }, [provider?.value]);

  const scrollToCategory = useCallback((filter: string) => {
    const offset = sectionOffsets.current[filter];
    if (offset !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({y: offset - 20, animated: true});
    }
  }, []);

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      // Clear hero cache to get a new random hero on refresh
      clearHeroCache(provider?.value);
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing home data:', refreshError);
    }
  }, [refetch, provider?.value]);

  // Memoized loading skeleton
  const loadingSliders = useMemo(() => {
    if (!provider?.value) {
      return [];
    }

    return providerManager
      .getCatalog({providerValue: provider.value})
      .map((item, index) => (
        <Slider
          isLoading={true}
          key={`loading-${item.filter}-${index}`}
          title={item.title}
          posts={[]}
          filter={item.filter}
        />
      ));
  }, [provider?.value]);

  // Memoized content sliders
  const contentSliders = useMemo(() => {
    return homeData.map((item: any, index: number) => (
      <View 
        key={`content-${item.filter}-${index}`}
        onLayout={(e) => {
          sectionOffsets.current[item.filter] = e.nativeEvent.layout.y;
        }}
      >
        <Slider
          isLoading={false}
          title={item.title}
          posts={item.Posts}
          filter={item.filter}
        />
      </View>
    ));
  }, [homeData]);

  // Memoized error message
  const errorComponent = useMemo(() => {
    if (!error && (isLoading || homeData.length > 0)) {
      return null;
    }

    return (
      <View className="p-4 m-4 bg-red-500/20 rounded-lg min-h-64 flex-1 justify-center items-center">
        <Text className="text-red-400 text-center font-medium">
          {error?.message || 'Failed to load content'}
        </Text>
        <Text className="text-gray-400 text-center text-sm mt-1">
          Pull to refresh and try again
        </Text>
      </View>
    );
  }, [error, isLoading, homeData.length]);

  // Early return for no providers
  if (
    !installedProviders ||
    installedProviders.length === 0 ||
    !provider?.value
  ) {
    return <Tutorial />;
  }

  return (
    <QueryErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaView
          style={{backgroundColor: mode === 'dark' ? 'black' : '#f8f9fa'}}
          className="flex-1">
            <StatusBar
              style="auto"
              animated={true}
              translucent={true}
              backgroundColor={backgroundColor}
            />

            <ScrollView
              ref={scrollRef}
              onScroll={handleScroll}
              scrollEventThrottle={16} // Optimize scroll performance
              showsVerticalScrollIndicator={false}
              style={{backgroundColor: mode === 'dark' ? 'black' : '#f8f9fa'}}
              refreshControl={
                <RefreshControl
                  colors={[primary]}
                  tintColor={primary}
                  progressBackgroundColor={
                    mode === 'dark' ? 'black' : '#f8f9fa'
                  }
                  refreshing={isRefetching}
                  onRefresh={handleRefresh}
                />
              }>
              
              {isTablet && isLandscape ? (
  <View style={{ flexDirection: 'row', flex: 1 }}>
    
    {/* Sidebar */}
    <View style={{ width: 180}}>
      <CategorySidebar 
        width={185} 
        categories={catalogs} 
        onCategoryPress={scrollToCategory} 
      />
    </View>

    {/* Hero Section */}
    <View style={{ flex: 1 }}>
      <HeroCarousel
        posts={heroPosts}
        isDrawerOpen={isDrawerOpen}
        onOpenDrawer={() => setDrawerOpen(true)}
        containerWidth={windowWidth - 240}
      />
    </View>

  </View>
              ) : (
                <HeroCarousel
                  posts={heroPosts}
                  isDrawerOpen={isDrawerOpen}
                  onOpenDrawer={() => setDrawerOpen(true)}
                  containerWidth={windowWidth}
                />
              )}

              <View onLayout={(e) => sectionOffsets.current['main-feed'] = e.nativeEvent.layout.y} className="mt-[-20px]">
                <ContinueWatching />

                {showFavChannels && favorites.length > 0 && (
                  <LiveTVHomeSlider 
                    title="Your Favourites" 
                    channels={favorites} 
                  />
                )}

                {showSportsChannels && (
                  <LiveTVHomeSlider 
                    title="Live Sports Now" 
                    channels={sportsChannels} 
                    isLoading={liveLoading} 
                  />
                )}

                <View className="relative z-15 px-2 mt-2">
                  {isLoading ? loadingSliders : contentSliders}
                  {errorComponent}
                </View>
              </View>

              <View className="h-16" />
            </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default Home;
