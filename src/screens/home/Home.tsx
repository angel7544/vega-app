import {
  SafeAreaView,
  ScrollView,
  RefreshControl,
  View,
  Text,
} from 'react-native';
import Slider from '../../components/Slider';
import React, {useCallback, useMemo, useState} from 'react';
import HeroOptimized from '../../components/Hero';
import {mainStorage} from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import {
  useHomePageData,
  getRandomHeroPost,
  clearHeroCache,
} from '../../lib/hooks/useHomePageData';
import {useShowNavBarOnScroll} from '../../lib/hooks/useShowNavBarOnScroll';
import useThemeStore from '../../lib/zustand/themeStore';
import ProviderDrawer from '../../components/ProviderDrawer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList} from '../../App';
import {Drawer} from 'react-native-drawer-layout';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import ContinueWatching from '../../components/ContinueWatching';
import {providerManager} from '../../lib/services/ProviderManager';
import Tutorial from '../../components/Touturial';
import {QueryErrorBoundary} from '../../components/ErrorBoundary';
import {StatusBar} from 'expo-status-bar';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const Home = ({}: Props) => {
  const {primary, mode} = useThemeStore(state => state);
  const {handleScroll: handleNavBarScroll} = useShowNavBarOnScroll();
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Memoize static values
  const disableDrawer = useMemo(
    () => mainStorage.getBool('disableDrawer') || false,
    [],
  );

  const {provider, installedProviders} = useContentStore(state => state);
  const {setHero} = useHeroStore(state => state);

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
          : 'white'
        : 'transparent';
    setBackgroundColor(newBackgroundColor);

    // Auto-hide navbar logic
    handleNavBarScroll(event);
  }, [mode, handleNavBarScroll]);

  // Stable hero post calculation - uses provider value for caching
  const heroPost = useMemo(() => {
    if (!homeData || homeData.length === 0) {
      return null;
    }
    return getRandomHeroPost(homeData, provider?.value);
  }, [homeData, provider?.value]);

  // Update hero only when hero post actually changes
  React.useEffect(() => {
    if (heroPost) {
      setHero(heroPost);
    } else {
      setHero({link: '', image: '', title: ''});
    }
  }, [heroPost, setHero]);

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
    return homeData.map((item, index) => (
      <Slider
        isLoading={false}
        key={`content-${item.filter}-${index}`}
        title={item.title}
        posts={item.Posts}
        filter={item.filter}
      />
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
          className={`${mode === 'dark' ? 'bg-black' : 'bg-white'} flex-1`}>
          <Drawer
            open={isDrawerOpen}
            onOpen={() => setIsDrawerOpen(true)}
            onClose={() => setIsDrawerOpen(false)}
            drawerPosition="left"
            drawerType="front"
            drawerStyle={{width: 200, backgroundColor: 'transparent'}}
            swipeEdgeWidth={disableDrawer ? 0 : 70}
            swipeEnabled={!disableDrawer}
            renderDrawerContent={() =>
              !disableDrawer ? (
                <ProviderDrawer onClose={() => setIsDrawerOpen(false)} />
              ) : null
            }>
            <StatusBar
              style="auto"
              animated={true}
              translucent={true}
              backgroundColor={backgroundColor}
            />

            <ScrollView
              onScroll={handleScroll}
              scrollEventThrottle={16} // Optimize scroll performance
              showsVerticalScrollIndicator={false}
              className={`${mode === 'dark' ? 'bg-black' : 'bg-white'}`}
              refreshControl={
                <RefreshControl
                  colors={[primary]}
                  tintColor={primary}
                  progressBackgroundColor={
                    mode === 'dark' ? 'black' : 'white'
                  }
                  refreshing={isRefetching}
                  onRefresh={handleRefresh}
                />
              }>
              <HeroOptimized
                isDrawerOpen={isDrawerOpen}
                onOpenDrawer={() => setIsDrawerOpen(true)}
              />

              <ContinueWatching />

              <View className="relative z-20 px-2 mt-4">
                {isLoading ? loadingSliders : contentSliders}
                {errorComponent}
              </View>

              <View className="h-16" />
            </ScrollView>
          </Drawer>
        </SafeAreaView>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default React.memo(Home);
