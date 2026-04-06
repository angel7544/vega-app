import Animated, {FadeIn} from 'react-native-reanimated';
import React, {memo, useState, useCallback} from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../types/navigation';
import useContentStore from '../lib/zustand/contentStore';
import useHeroStore from '../lib/zustand/herostore';
import {settingsStorage} from '../lib/storage';
import {useHeroMetadata} from '../lib/hooks/useHomePageData';
import useThemeStore from '../lib/zustand/themeStore';

interface HeroProps {
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
}

const Hero = memo(({isDrawerOpen, onOpenDrawer}: HeroProps) => {
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const {mode} = useThemeStore(state => state);
  const {provider} = useContentStore(state => state);
  const {hero} = useHeroStore(state => state);
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

  // Memoize settings to prevent re-renders
  const [showHamburgerMenu] = useState(() =>
    settingsStorage.showHamburgerMenu(),
  );
  const [isDrawerDisabled] = useState(
    () => settingsStorage.getBool('disableDrawer') || false,
  );

  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();

  // Use React Query for hero metadata
  const {
    data: heroData,
    isLoading,
    error,
  } = useHeroMetadata(hero?.link || '', provider.value);

  // Memoized keyboard handler
  const handleKeyboardHide = useCallback(() => {
    setSearchActive(false);
  }, []);

  // Set up keyboard listener once
  React.useEffect(() => {
    const subscription = Keyboard.addListener(
      'keyboardDidHide',
      handleKeyboardHide,
    );
    return () => subscription?.remove();
  }, [handleKeyboardHide]);

  // Memoized handlers
  const handleSearchSubmit = useCallback(
    (text: string) => {
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
    },
    [navigation, searchNavigation, provider.value, provider.display_name],
  );

  const handlePlayPress = useCallback(() => {
    if (hero?.link) {
      navigation.navigate('Info', {
        link: hero.link,
        provider: provider.value,
        poster: heroData?.image || heroData?.poster || heroData?.background,
      });
    }
  }, [navigation, hero?.link, provider.value, heroData]);

  const handleImageError = useCallback(() => {
    // Handle image error silently - React Query will manage retries
    console.warn('Hero image failed to load');
  }, []);

  // Memoized image source
  const imageSource = React.useMemo(() => {
    const fallbackImage =
      'https://www.br31tech.live/logo.pngtext=OrbixPlay';
    if (!heroData) {
      return {uri: fallbackImage};
    }

    return {
      uri:
        heroData.background ||
        heroData.image ||
        heroData.poster ||
        fallbackImage,
    };
  }, [heroData]);

  // Memoized genres
  const displayGenres = React.useMemo(() => {
    if (!heroData) {
      return [];
    }
    return (heroData.genre || heroData.tags || []).slice(0, 3);
  }, [heroData]);

  if (error) {
    console.error('Hero metadata error:', error);
  }

  return (
    <View style={{ height: heroHeight as any }} className="relative w-full">
      {/* Header Controls */}
      <View className="absolute pt-3 w-full top-6 px-3 mt-2 z-30 flex-row justify-between items-center">
        {!searchActive && (
          <View
            className={`${
              showHamburgerMenu && !isDrawerDisabled
                ? 'opacity-100'
                : 'opacity-0'
            }`}>
            <Pressable
              className={`${isDrawerOpen ? 'opacity-0' : 'opacity-100'}`}
              onPress={onOpenDrawer}>
              <View className={`${mode === 'dark' ? 'bg-black/20' : 'bg-gray-100/50'} p-2 rounded-full backdrop-blur-md`}>
                <Feather name="menu" size={27} color={mode === 'dark' ? 'white' : 'black'} />
              </View>
            </Pressable>
          </View>
        )}

        {searchActive && (
          <Animated.View
            entering={FadeIn.duration(300)}
            className="w-full items-center justify-center">
            <TextInput
              onBlur={() => setSearchActive(false)}
              autoFocus={true}
              onSubmitEditing={e => handleSearchSubmit(e.nativeEvent.text)}
              placeholder={`Search in ${provider.display_name}`}
              className={`w-[95%] px-4 h-10 rounded-full border ${mode === 'dark' ? 'border-white text-white' : 'border-black text-black'}`}
              placeholderTextColor={mode === 'dark' ? '#999' : '#666'}
            />
          </Animated.View>
        )}

        {!searchActive && (
          <Pressable onPress={() => setSearchActive(true)}>
            <View className={`${mode === 'dark' ? 'bg-black/20' : 'bg-gray-100/50'} p-2 rounded-full backdrop-blur-md`}>
              <Feather name="search" size={24} color={mode === 'dark' ? 'white' : 'black'} />
            </View>
          </Pressable>
        )}
      </View>

      {/* Hero Image */}
      {isLoading ? (
        <View className="h-full w-full bg-gray-800" />
      ) : (
        <Image
          source={imageSource}
          onError={handleImageError}
          className="h-full w-full"
          style={{resizeMode: 'cover'}}
        />
      )}

      {/* Hero Content */}
      <View className="absolute bottom-12 w-full z-20 px-6">
        {!isLoading && heroData && (
          <View className="gap-4 items-center">
            {/* Title/Logo */}
            {heroData.logo ? (
              <Image
                source={{uri: heroData.logo}}
                style={{
                  width: 200,
                  height: 100,
                  resizeMode: 'contain',
                }}
                onError={() => console.warn('Logo failed to load')}
              />
            ) : (
              <Text className="text-white text-center text-4xl font-black shadow-2xl tracking-tighter" style={{ textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 }}>
                {heroData.name || heroData.title}
              </Text>
            )}

            {/* Genres */}
            {displayGenres.length > 0 && (
              <View className="flex-row items-center justify-center space-x-2">
                {displayGenres.map((genre: string, index: number) => (
                  <Text
                    key={index}
                    className="text-white text-sm font-semibold">
                    • {genre}
                  </Text>
                ))}
              </View>
            )}

            {/* Play Button */}
            <View className="flex-1 items-center justify-center">
              {hero?.link && (
                <TouchableOpacity
                  className="bg-primary px-12 py-4 rounded-full flex-row items-center space-x-3 shadow-xl shadow-primary/40"
                  onPress={handlePlayPress}
                  activeOpacity={0.8}>
                  <MaterialCommunityIcons name="play" size={28} color="white" />
                  <Text className="text-white font-black text-xl uppercase tracking-widest">Watch Now</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Loading state */}
        {isLoading && (
          <View className="items-center">
            <View className="h-[45px] w-[140px] bg-gray-700 rounded" />
          </View>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <View className="items-center">
            <Text className="text-white text-center text-xl font-bold">
              {hero?.title || 'Content Unavailable'}
            </Text>
            <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm mt-2`}>
              Unable to load details
            </Text>
          </View>
        )}
      </View>

      {/* Gradients */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.5)', 
          'transparent', 
          mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.4)', 
          mode === 'dark' ? 'black' : 'white'
        ]}
        locations={[0, 0.4, 0.7, 1]}
        className="absolute inset-0"
      />

      {searchActive && (
        <LinearGradient
          colors={['black', 'transparent']}
          locations={[0, 0.3]}
          className="absolute h-[30%] w-full"
        />
      )}
    </View>
  );
});

Hero.displayName = 'Hero';

export default Hero;
