import Animated, {
  FadeIn,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import React, {memo, useState, useCallback, useRef, useEffect} from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../types/navigation';
import useContentStore from '../lib/zustand/contentStore';
import {settingsStorage} from '../lib/storage';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import useThemeStore from '../lib/zustand/themeStore';
import type {Post} from '../lib/providers/types';

const HeroItem = memo(({item, index, scrollX, width, height}: {item: Post, index: number, scrollX: any, width: number, height: any}) => {
  const {provider} = useContentStore(state => state);
  const {mode, primary} = useThemeStore(state => state);
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const {data: heroData, isLoading} = useHeroMetadata(item.link, provider.value);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0.92, 1, 0.92],
      Extrapolate.CLAMP
    );
    return {
      transform: [{scale}],
    };
  });

  const handlePlayPress = useCallback(() => {
    navigation.navigate('Info', {
      link: item.link,
      provider: provider.value,
      poster: heroData?.image || heroData?.poster || item.image,
    });
  }, [navigation, item, provider.value, heroData]);

  const imageSource = React.useMemo(() => {
    return {
      uri: heroData?.background || heroData?.image || heroData?.poster || item.image || 'https://www.br31tech.live/logo.png',
    };
  }, [heroData, item.image]);

  const displayGenres = React.useMemo(() => {
    if (!heroData) return [];
    return (heroData.genre || heroData.tags || []).slice(0, 3);
  }, [heroData]);

  return (
    <Animated.View style={[{width: width, height: '100%'}, animatedStyle]}>
      <Image
        source={imageSource}
        className="h-full w-full"
        style={{resizeMode: 'cover'}}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)', 'black']}
        locations={[0, 0.4, 0.7, 1]}
        className="absolute inset-0"
      />
      
      <View className="absolute bottom-16 w-full px-6 items-center">
        {heroData?.logo ? (
          <Image
            source={{uri: heroData.logo}}
            style={{width: 240, height: 120, resizeMode: 'contain'}}
          />
        ) : (
          <Text className="text-white text-center text-4xl font-black mb-4 shadow-2xl tracking-tighter" style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 15 }} numberOfLines={2}>
            {heroData?.name || heroData?.title || item.title}
          </Text>
        )}

        {displayGenres.length > 0 && (
          <View className="flex-row items-center justify-center space-x-2 mb-6">
            {displayGenres.map((genre: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <View className="w-1 h-1 rounded-full bg-gray-500 mx-1" />}
                <Text className="text-gray-200 text-xs font-bold uppercase tracking-widest">{genre}</Text>
              </React.Fragment>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={handlePlayPress}
          className="bg-primary px-10 py-4 rounded-full flex-row items-center space-x-3 shadow-2xl shadow-primary/40 active:scale-95"
        >
          <MaterialCommunityIcons 
            name="play" 
            size={28} 
            color="white" 
          />
          <Text className="text-white font-black text-xl uppercase tracking-widest">
            Watch Now
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});
;

interface HeroCarouselProps {
  posts: Post[];
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
}

const HeroCarousel = ({posts, isDrawerOpen, onOpenDrawer}: HeroCarouselProps) => {
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const {mode, primary} = useThemeStore(state => state);
  const isLandscape = windowWidth > windowHeight;
  
  // Dynamic height based on device type and orientation
  const isLarge = windowWidth > 1024;
  const isTablet = windowWidth > 768;
  
  const heroHeight = React.useMemo(() => {
    if (isLandscape) {
      return isLarge ? windowHeight * 0.4 : isTablet ? windowHeight * 0.45 : windowHeight * 0.55;
    }
    return isLarge ? windowHeight * 0.45 : isTablet ? windowHeight * 0.55 : windowHeight * 0.65;
  }, [windowHeight, isLandscape, isLarge, isTablet]);

  const [searchActive, setSearchActive] = useState(false);
  const {provider} = useContentStore(state => state);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const searchNavigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();

  const [showHamburgerMenu] = useState(() => settingsStorage.showHamburgerMenu());
  const [isDrawerDisabled] = useState(() => settingsStorage.getBool('disableDrawer') || false);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleSearchSubmit = useCallback((text: string) => {
    if (text.startsWith('https://')) {
      navigation.navigate('Info', {link: text});
    } else {
      searchNavigation.navigate('ScrollList', {
        providerValue: provider.value,
        filter: text,
        title: provider.display_name,
        isSearch: true,
      });
    }
    setSearchActive(false);
  }, [navigation, searchNavigation, provider]);

  // Auto-slide logic
  useEffect(() => {
    if (posts.length <= 1 || searchActive) return;

    const timer = setInterval(() => {
      try {
        const nextIndex = (currentIndex + 1) % posts.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setCurrentIndex(nextIndex);
      } catch (err) {
        console.warn('ScrollToIndex error caught in HeroCarousel:', err);
      }
    }, 6000);

    return () => clearInterval(timer);
  }, [currentIndex, posts.length, searchActive]);

  const onMomentumScrollEnd = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setCurrentIndex(index);
  };

  return (
    <View style={{ height: heroHeight as any }} className="relative w-full overflow-hidden">
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={({item, index}) => (
          <HeroItem 
            item={item} 
            index={index} 
            scrollX={scrollX} 
            width={windowWidth} 
            height={heroHeight} 
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: windowWidth,
          offset: windowWidth * index,
          index,
        })}
        keyExtractor={(item) => item.link}
      />

      {/* Header Controls */}
      <View className="absolute top-12 left-0 right-0 px-6 z-50 flex-col space-y-4">
        {!searchActive ? (
          <View className="flex-row justify-between items-center w-full">
            <View className={showHamburgerMenu && !isDrawerDisabled ? 'opacity-100' : 'opacity-0'}>
              <Pressable
                className={isDrawerOpen ? 'opacity-0' : 'opacity-100'}
                onPress={onOpenDrawer}
              >
                <View className={`${mode === 'dark' ? 'bg-black/20' : 'bg-gray-100/50'} p-2 rounded-full backdrop-blur-md`}>
                  <Feather name="menu" size={24} color={mode === 'dark' ? 'white' : 'black'} />
                </View>
              </Pressable>
            </View>
 
            <Pressable onPress={() => setSearchActive(true)}>
              <View className={`${mode === 'dark' ? 'bg-black/20' : 'bg-gray-100/50'} p-2 rounded-full backdrop-blur-md`}>
                <Feather name="search" size={24} color={mode === 'dark' ? 'white' : 'black'} />
              </View>
            </Pressable>
          </View>
        ) : (
          <Animated.View entering={FadeIn} className="w-full">
            <TextInput
              autoFocus
              onBlur={() => setSearchActive(false)}
              onSubmitEditing={(e) => handleSearchSubmit(e.nativeEvent.text)}
              placeholder={`Search ${provider.display_name}...`}
              className={`w-full ${mode === 'dark' ? 'bg-white/20 border-white/30 text-white' : 'bg-black/10 border-black/20 text-black'} backdrop-blur-xl px-6 h-12 rounded-full border`}
              placeholderTextColor={mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}
            />
          </Animated.View>
        )}
      </View>

      {/* Pagination Indicators */}
      <View className="absolute bottom-8 left-0 right-0 flex-row justify-center space-x-2">
        {posts.map((_, i) => (
          <View
            key={i}
            className={`h-1.5 rounded-full ${i === currentIndex ? 'w-6' : 'w-1.5'}`}
            style={{backgroundColor: i === currentIndex ? primary : 'rgba(255,255,255,0.4)'}}
          />
        ))}
      </View>
    </View>
  );
};

export default memo(HeroCarousel);
