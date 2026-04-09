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
  FlatList,
  useWindowDimensions,
  StyleSheet,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Feather, MaterialCommunityIcons, Ionicons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../types/navigation';
import useContentStore from '../lib/zustand/contentStore';
import {settingsStorage} from '../lib/storage';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import useThemeStore from '../lib/zustand/themeStore';
import type {Post} from '../lib/providers/types';
import {BlurView} from 'expo-blur';
import useWatchListStore from '../lib/zustand/watchListStore';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Use Animated version of FlatList for useAnimatedScrollHandler
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const HeroItem = memo(({item, index, scrollX, width, height}: {item: Post, index: number, scrollX: any, width: number, height: any}) => {
  const {provider} = useContentStore(state => state);
  const {mode, primary} = useThemeStore(state => state);
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const {watchList, addItem, removeItem} = useWatchListStore();

  const {data: heroData, isLoading} = useHeroMetadata(item.link, provider.value);

  const isInWatchlist = React.useMemo(() => 
    watchList.some(w => w.link === item.link), 
  [watchList, item.link]);

  const animatedStyle = useAnimatedStyle(() => {
    // Safety check for width to prevent division by zero or NaN ranges
    const safeWidth = width || 1;
    const scale = interpolate(
      scrollX.value,
      [(index - 1) * safeWidth, index * safeWidth, (index + 1) * safeWidth],
      [0.94, 1, 0.94],
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

  const handleWishlistToggle = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    if (isInWatchlist) {
      removeItem(item.link);
    } else {
      addItem({
        link: item.link,
        title: item.title,
        poster: item.image,
        provider: provider.value,
        type: heroData?.type || 'movie'
      });
    }
  }, [isInWatchlist, item, provider.value, heroData, addItem, removeItem]);

  const handleTrailerPress = useCallback(() => {
    const title = heroData?.name || heroData?.title || item.title;
    const query = encodeURIComponent(`${title} trailer`);
    const url = `https://www.youtube.com/results?search_query=${query}`;
    Linking.openURL(url).catch((err: any) => console.error('Error opening trailer:', err));
  }, [heroData, item.title]);

  const imageSource = React.useMemo(() => {
    return {
      uri: heroData?.background || heroData?.image || heroData?.poster || item.image || 'https://www.br31tech.live/logo.png',
    };
  }, [heroData, item.image]);

  const ratingValue = heroData?.imdbRating || heroData?.vote_average || heroData?.rating;
  const voteCount = heroData?.imdbVotes || heroData?.vote_count || heroData?.votes;

  return (
    <Animated.View style={[{width: width, height: '95%',paddingLeft: 0, paddingRight: 0, paddingBottom: 3}, animatedStyle]}>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={handlePlayPress}
        className="flex-1 overflow-hidden rounded-[20px] shadow-2xl bg-gray-900"
      >
        <Image
          source={imageSource}
          className="h-full w-full"
          style={{resizeMode: 'cover'}}
        />
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', 'black']}
          locations={[0, 0.4, 0.75, 1]}
          className="absolute inset-0"
        />

        <View className={`absolute ${width > 700 ? 'bottom-14 px-12' : 'bottom-10 px-8'} left-0 right-0`}>
          {/* Metadata & Rating Row */}
          <View className="flex-row items-center space-x-3 mb-4">
            <TouchableOpacity 
              onPress={handleTrailerPress}
              className="overflow-hidden rounded-full border border-white/10"
            >
              <BlurView intensity={30} tint="dark" style={styles.blurPill}>
                <Ionicons name="play-circle" size={20} color="#ff0000ff" />
                <Text className="text-white font-bold text-xs uppercase tracking-wider">Trailer</Text>
              </BlurView>
            </TouchableOpacity>

            {ratingValue && (
               <View className="overflow-hidden rounded-full border border-white/10">
                <BlurView intensity={30} tint="dark" style={styles.blurPill}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text className="text-white font-black text-xs">{ratingValue}</Text>
                    {voteCount && (
                      <Text className="text-white/60 text-[10px] font-medium ml-1">
                        ({typeof voteCount === 'string' ? voteCount : voteCount > 1000 ? `${(voteCount/1000).toFixed(1)}k` : voteCount})
                      </Text>
                    )}
                </BlurView>
             </View>
            )}
          </View>
          
  <View style={{
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
}}>

  {/* Left: Logo / Title */}
  <View style={{
    flex: 1,
    marginRight: 12,
    justifyContent: 'flex-end'
  }}>
    {heroData?.logo ? (
      <Image
        source={{ uri: heroData.logo }}
        style={{
          width: width > 700 ? 240 : 180,
          height: width > 700 ? 100 : 80,
        }}
        resizeMode="contain"
      />
    ) : (
      <Text
        numberOfLines={2}
        style={{
          fontSize: width > 700 ? 32 : 22,
          fontWeight: '900',
          color: 'white',
          letterSpacing: -0.5,
          textShadowColor: 'rgba(0,0,0,0.8)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 12,
        }}
      >
        {heroData?.name || heroData?.title || item.title}
      </Text>
    )}
  </View>

  {/* Right: Heart Button */}
  <TouchableOpacity
    onPress={handleWishlistToggle}
    activeOpacity={0.8}
  >
    <BlurView
      intensity={mode === 'dark' ? 30 : 50}
      tint={mode === 'dark' ? 'dark' : 'light'}
      style={{
        padding: width > 700 ? 14 : 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Ionicons
        name={isInWatchlist ? "heart" : "heart-outline"}
        size={width > 700 ? 30 : 24}
        color={isInWatchlist ? primary : (mode === 'dark' ? "white" : "black")}
      />
    </BlurView>
 
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

interface HeroCarouselProps {
  posts: Post[];
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  containerWidth?: number;
}

const HeroCarousel = ({posts, isDrawerOpen, onOpenDrawer, containerWidth}: HeroCarouselProps) => {
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(containerWidth || 0);
  const effectiveWidth = containerWidth || layoutWidth || windowWidth;
  const {mode, primary} = useThemeStore(state => state);
  const isLandscape = windowWidth > windowHeight;
  
  const isLarge = windowWidth > 960
  const isTablet = windowWidth > 720
  
  const heroHeight = React.useMemo(() => {
    if (isLandscape) {
      // Balanced height for tablets to show content below
      return isLarge ? windowHeight * 0.55 : isTablet ? windowHeight * 0.6 : windowHeight * 0.55;
    }
    return isLarge ? windowHeight * 0.45 : isTablet ? windowHeight * 0.55 : windowHeight * 0.65;
  }, [windowHeight, isLandscape, isLarge, isTablet]);

  const [searchActive, setSearchActive] = useState(false);
  const {provider} = useContentStore(state => state);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const searchNavigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();

  const [showHamburgerMenu] = useState(() => settingsStorage.showHamburgerMenu());
  const [isDrawerDisabled] = useState(() => settingsStorage.getBool('disableDrawer') || false);

  // Use the simplified direct function syntax for best compatibility
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
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

  // Auto-slide logic with check for valid index
  useEffect(() => {
    if (posts.length <= 1 || searchActive) return;

    const timer = setInterval(() => {
      try {
        const nextIndex = (currentIndex + 1) % posts.length;
        if (flatListRef.current && !isNaN(nextIndex)) {
          flatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
          setCurrentIndex(nextIndex);
        }
      } catch (err) {
        // Silently handle scroll errors (often caused by unmounted state or layout shifts)
      }
    }, 8000);

    return () => clearInterval(timer);
  }, [currentIndex, posts.length, searchActive]);

  const onMomentumScrollEnd = (event: any) => {
    if (effectiveWidth <= 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / effectiveWidth);
    if (!isNaN(index)) {
      setCurrentIndex(index);
    }
  };

  return (
    <View 
      onLayout={(e) => {
        if (!containerWidth) {
          setLayoutWidth(e.nativeEvent.layout.width);
        }
      }}
      style={{ height: heroHeight as any, width: effectiveWidth }} 
      className="relative overflow-hidden"
    >
      <AnimatedFlatList
        ref={flatListRef}
        data={posts}
        renderItem={({item, index}: any) => (
          <HeroItem 
            item={item} 
            index={index} 
            scrollX={scrollX} 
            width={effectiveWidth} 
            height={heroHeight} 
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_: any, index: number) => ({
          length: effectiveWidth,
          offset: effectiveWidth * index,
          index,
        })}
        keyExtractor={(item: any) => item.link}
      />

      {/* Header Controls */}
      <View className="absolute top-12 left-0 right-0 px-8 z-50 flex-col space-y-4">
        {!searchActive ? (
          <View className="flex-row justify-between items-center w-full">
            <View className={showHamburgerMenu && !isDrawerDisabled ? 'opacity-100' : 'opacity-0'}>
              <Pressable
                className={isDrawerOpen ? 'opacity-0' : 'opacity-100'}
                onPress={onOpenDrawer}
              >
                <View className="rounded-full border border-white/10 overflow-hidden">
                  <BlurView intensity={20} tint="dark" style={styles.blurHeaderIcon}>
                    <Feather name="menu" size={24} color="white" />
                  </BlurView>
                </View>
              </Pressable>
            </View>
 
            <Pressable onPress={() => setSearchActive(true)}>
               <View className="rounded-full border border-white/10 overflow-hidden">
                <BlurView intensity={20} tint="dark" style={styles.blurHeaderIcon}>
                  <Feather name="search" size={24} color="white" />
                </BlurView>
              </View>
            </Pressable>
          </View>
        ) : (
          <Animated.View entering={FadeIn} className="w-full">
            <View className="w-full overflow-hidden rounded-full border border-white/10">
              <BlurView intensity={20} tint="dark" style={styles.blurSearch}>
                <TextInput
                  autoFocus
                  onBlur={() => setSearchActive(false)}
                  onSubmitEditing={(e) => handleSearchSubmit(e.nativeEvent.text)}
                  placeholder={`Search ${provider.display_name}...`}
                  className="w-full px-6 h-12 text-white"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                />
              </BlurView>
            </View>
          </Animated.View>
        )}
      </View>

      <View className="absolute bottom-6 left-0 right-0 flex-row justify-center space-x-2">
        {posts.map((_, i) => (
          <View
            key={i}
            className={`h-1.5 rounded-full ${i === currentIndex ? 'w-8' : 'w-2'}`}
            style={{
              backgroundColor: i === currentIndex ? primary : 'rgba(255,255,255,0.3)',
              opacity: i === currentIndex ? 1 : 0.6
            }}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  blurPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  blurHeart: {
    padding: 12,
  },
  blurHeaderIcon: {
    padding: 10,
  },
  blurSearch: {
    width: '100%',
  }
});

export default memo(HeroCarousel);
