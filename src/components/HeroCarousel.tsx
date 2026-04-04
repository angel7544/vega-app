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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import {settingsStorage} from '../lib/storage';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import useThemeStore from '../lib/zustand/themeStore';
import type {Post} from '../lib/providers/types';

const {width: WINDOW_WIDTH} = Dimensions.get('window');

interface HeroCarouselProps {
  posts: Post[];
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
}

const HeroItem = memo(({item, index, scrollX}: {item: Post, index: number, scrollX: any}) => {
  const {provider} = useContentStore(state => state);
  const {mode, primary} = useThemeStore(state => state);
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const {data: heroData, isLoading} = useHeroMetadata(item.link, provider.value);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      [(index - 1) * WINDOW_WIDTH, index * WINDOW_WIDTH, (index + 1) * WINDOW_WIDTH],
      [0.9, 1, 0.9],
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
    <Animated.View style={[{width: WINDOW_WIDTH, height: '100%'}, animatedStyle]}>
      <Image
        source={imageSource}
        className="h-full w-full"
        style={{resizeMode: 'cover'}}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'black']}
        locations={[0, 0.5, 1]}
        className="absolute inset-0"
      />
      
      <View className="absolute bottom-16 w-full px-6 items-center">
        {heroData?.logo ? (
          <Image
            source={{uri: heroData.logo}}
            style={{width: 220, height: 110, resizeMode: 'contain'}}
          />
        ) : (
          <Text className="text-white text-center text-3xl font-bold mb-2 shadow-lg" numberOfLines={2}>
            {heroData?.name || heroData?.title || item.title}
          </Text>
        )}

        {displayGenres.length > 0 && (
          <View className="flex-row items-center justify-center space-x-2 mb-4">
            {displayGenres.map((genre: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <Text className="text-gray-400 text-xs">•</Text>}
                <Text className="text-gray-300 text-xs font-medium">{genre}</Text>
              </React.Fragment>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={handlePlayPress}
          className="bg-white px-8 py-3 rounded-full flex-row items-center space-x-2 active:opacity-80 shadow-xl"
          style={{backgroundColor: mode === 'dark' ? 'white' : 'black'}}
        >
          <MaterialCommunityIcons 
            name="play" 
            size={24} 
            color={mode === 'dark' ? 'black' : 'white'} 
          />
          <Text className={`${mode === 'dark' ? 'text-black' : 'text-white'} font-bold text-lg`}>
            Watch Now
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const HeroCarousel = ({posts, isDrawerOpen, onOpenDrawer}: HeroCarouselProps) => {
  const [searchActive, setSearchActive] = useState(false);
  const {provider} = useContentStore(state => state);
  const {mode, primary} = useThemeStore(state => state);
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
      const nextIndex = (currentIndex + 1) % posts.length;
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 6000);

    return () => clearInterval(timer);
  }, [currentIndex, posts.length, searchActive]);

  const onMomentumScrollEnd = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / WINDOW_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View className="relative h-[65vh] overflow-hidden">
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={({item, index}) => <HeroItem item={item} index={index} scrollX={scrollX} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        keyExtractor={(item) => item.link}
      />

      {/* Header Controls */}
      <View className="absolute top-12 left-0 right-0 px-6 z-50 flex-row justify-between items-center">
        {!searchActive ? (
          <>
            <View className={showHamburgerMenu && !isDrawerDisabled ? 'opacity-100' : 'opacity-0'}>
              <Pressable
                className={isDrawerOpen ? 'opacity-0' : 'opacity-100'}
                onPress={onOpenDrawer}
              >
                <View className="bg-black/20 p-2 rounded-full backdrop-blur-md">
                  <Feather name="menu" size={24} color="white" />
                </View>
              </Pressable>
            </View>

            <Pressable onPress={() => setSearchActive(true)}>
              <View className="bg-black/20 p-2 rounded-full backdrop-blur-md">
                <Feather name="search" size={24} color="white" />
              </View>
            </Pressable>
          </>
        ) : (
          <Animated.View entering={FadeIn} className="w-full">
            <TextInput
              autoFocus
              onBlur={() => setSearchActive(false)}
              onSubmitEditing={(e) => handleSearchSubmit(e.nativeEvent.text)}
              placeholder={`Search ${provider.display_name}...`}
              className="w-full bg-white/20 backdrop-blur-xl px-6 h-12 rounded-full border border-white/30 text-white text-lg"
              placeholderTextColor="rgba(255,255,255,0.6)"
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
