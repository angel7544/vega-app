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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../App';
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
  const [searchActive, setSearchActive] = useState(false);
  const {provider} = useContentStore(state => state);
  const {hero} = useHeroStore(state => state);
  const {mode} = useThemeStore(state => state);

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
    <View className="relative h-[55vh]">
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
              <Feather name="menu" size={27} color={mode === 'dark' ? 'white' : 'black'} />
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
            <Feather name="search" size={24} color={mode === 'dark' ? 'white' : 'black'} />
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
          style={{resizeMode: 'stretch'}}
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
              <Text className="text-white text-center text-2xl font-bold">
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
                  className={`${mode === 'dark' ? 'bg-white' : 'bg-black'} px-10 py-2 rounded-lg flex-row items-center space-x-2`}
                  onPress={handlePlayPress}
                  activeOpacity={0.8}>
                  <MaterialCommunityIcons name="play" size={24} color={mode === 'dark' ? 'black' : 'white'} />
                  <Text className={`${mode === 'dark' ? 'text-black' : 'text-white'} font-bold text-lg`}>Play</Text>
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
        colors={['transparent', 'rgba(0,0,0,0.8)', 'black']}
        locations={[0, 0.7, 1]}
        className="absolute h-full w-full"
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
