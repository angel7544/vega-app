import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Modal,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather, MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withTiming,
} from 'react-native-reanimated';
import { TVGuideGrid } from '../components/TVGuideGrid';

import { iptvParser } from '../lib/iptvParser';
import useThemeStore from '../lib/zustand/themeStore';
import CategoryGrid from '../components/CategoryGrid';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import usePlayerStore from '../lib/zustand/playerStore';
import { settingsStorage } from '../lib/storage';
import useIPTVStore from '../lib/zustand/iptvStore';
import { useNow } from '../lib/hooks/useNow';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const QUALITY_KEYWORDS = {
  '1080p': ['1080p', 'fhd', 'full hd', '1920x1080', '1080'],
  '576p': ['576p', 'sd', 'dvd', '720x576', '480p', '360p'],
  '720p': ['720p', 'hd', '1280x720', '720'],
};

const QualityBadge = ({ name, isDark }: { name: string, isDark: boolean }) => {
  const getQuality = () => {
    const n = name.toLowerCase();
    if (n.includes('4k') || n.includes('uhd')) return '4K';
    if (QUALITY_KEYWORDS['1080p'].some(k => n.includes(k))) return 'FHD';
    if (QUALITY_KEYWORDS['720p'].some(k => n.includes(k))) return 'HD';
    if (QUALITY_KEYWORDS['576p'].some(k => n.includes(k))) return 'SD';
    return null;
  };

  const quality = getQuality();
  if (!quality) return null;

  return (
    <View className={`px-2 py-0.5 rounded-md border ${
      isDark ? 'bg-white/10 border-white/20' : 'bg-black/5 border-black/10'
    }`}>
      <Text className={`text-[8px] font-black tracking-tighter ${isDark ? 'text-white/60' : 'text-black/60'}`}>
        {quality}
      </Text>
    </View>
  );
};

const EPGInfo = React.memo(({ channel, isDark, primary, showNext = true }: any) => {
  const { epgData } = usePlayerStore();
  const now = useNow();

  const info = useMemo(() => {
    const programs = epgData[channel.url];
    if (!programs || programs.length === 0) return null;
    const nowTime = Date.now();
    const idx = programs.findIndex(p => p.startTs <= nowTime && p.stopTs > nowTime);
    if (idx === -1) return { now: null, next: programs.find(p => p.startTs > nowTime) || null };
    return { now: programs[idx], next: programs[idx+1] || null };
  }, [epgData, channel.url, now]);

  if (!info || (!info.now && !info.next)) return null;

  return (
    <View className="mt-1.5">
      {info.now && (
        <View className="mb-1">
          <View className="flex-row items-center mb-1">
            <View className="w-1 h-1 rounded-full bg-red-500 mr-1.5" />
            <Text className={`text-[9px] font-black uppercase tracking-tight ${isDark ? 'text-white/80' : 'text-black/80'}`} numberOfLines={1}>
              {info.now.title}
            </Text>
          </View>
          <View className={`h-[1px] w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
             <View 
               className="h-full bg-red-500/60" 
               style={{ 
                 width: `${Math.max(5, Math.min(95, ((Date.now() - info.now.startTs) / (info.now.stopTs - info.now.startTs)) * 100))}%` 
               }} 
             />
          </View>
        </View>
      )}
      {showNext && info.next && (
        <View className="flex-row items-center opacity-40">
           <Text className={`text-[7px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
             Up Next: {info.next.title}
           </Text>
        </View>
      )}
    </View>
  );
});

// Sub-components
const TabItem = React.memo(({ name, isActive, onPress, isDark, primary }: any) => (
  <TouchableOpacity 
    onPress={() => onPress(name)}
    className="mr-8 items-center"
  >
    <Text className={`font-black text-[10px] uppercase tracking-[3px] ${isActive ? (isDark ? 'text-white' : 'text-black') : (isDark ? 'text-white/20' : 'text-black/20')}`}>
      {name}
    </Text>
    {isActive && (
      <Animated.View 
        entering={FadeIn.duration(400)}
        className="h-[3px] rounded-full absolute -bottom-3 w-4"
        style={{ backgroundColor: primary }} 
      />
    )}
  </TouchableOpacity>
));

const HeroItem = React.memo(({ item, index, scrollX, isDark, primary, onPlay }: any) => {
  const animatedOverlay = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(index - 1) * WINDOW_WIDTH, index * WINDOW_WIDTH, (index + 1) * WINDOW_WIDTH],
      [0.8, 0, 0.8],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const animatedImage = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      [(index - 1) * WINDOW_WIDTH, index * WINDOW_WIDTH, (index + 1) * WINDOW_WIDTH],
      [1.2, 1, 1.2],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale }] };
  });

  return (
    <View style={{ width: WINDOW_WIDTH, height: 500 }} className="relative overflow-hidden">
      <Animated.Image
        source={{ uri: item.logo || 'https://www.br31tech.live/placeholder.png' }}
        className="w-full h-full"
        resizeMode="cover"
        style={[{ opacity: 0.7 }, animatedImage]}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)', isDark ? '#000' : '#fff']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }, animatedOverlay]} />
      
      <View className="absolute bottom-16 w-full px-10 items-start">
        <View className="bg-red-600 px-3 py-1 rounded-lg mb-4 shadow-lg shadow-red-600/20">
           <Text className="text-white text-[10px] font-black uppercase tracking-[2px]">Trending Live</Text>
        </View>
        
        <Text className="text-white text-4xl font-black mb-2 tracking-tighter" numberOfLines={2}>
           {item.name}
        </Text>
        
        <Text className="text-white/60 text-xs font-bold uppercase tracking-[4px] mb-8">
           {item.category?.split(/[;/]/)[0] || 'Premium Signal'}
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onPlay(item)}
          className="flex-row items-center px-8 py-4 rounded-3xl shadow-2xl"
          style={{ backgroundColor: primary }}
        >
          <MaterialCommunityIcons 
            name="play-circle" 
            size={28} 
            color="white" 
          />
          <Text className="ml-3 font-black text-xs uppercase tracking-[3px] text-white">
            Watch Now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const LiveHeroCarousel = ({ channels, isDark, primary, onPlay }: any) => {
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  useEffect(() => {
    if (channels.length <= 1) return;
    const timer = setInterval(() => {
      try {
        const nextIndex = (currentIndex + 1) % Math.min(channels.length, 5); // Hero is limited to 5
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setCurrentIndex(nextIndex);
      } catch (err) {
        console.warn('ScrollToIndex error caught in HeroCarousel:', err);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [currentIndex, channels.length]);

  return (
    <View className="relative">
      <AnimatedFlatList
        ref={flatListRef}
        data={channels.slice(0, 5)}
        renderItem={({ item, index }: any) => (
          <HeroItem 
            item={item} 
            index={index} 
            scrollX={scrollX} 
            isDark={isDark} 
            primary={primary} 
            onPlay={onPlay}
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e: any) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / WINDOW_WIDTH))}
        getItemLayout={(_, index) => ({
          length: WINDOW_WIDTH,
          offset: WINDOW_WIDTH * index,
          index,
        })}
        keyExtractor={(item: any, index: number) => `${item.url}-${index}`}
      />
      <View className="absolute bottom-6 left-0 right-0 flex-row justify-center space-x-2">
        {channels.slice(0, 5).map((_: any, i: number) => (
          <View
            key={i}
            className={`h-1 rounded-full ${i === currentIndex ? 'w-6' : 'w-2'}`}
            style={{ backgroundColor: i === currentIndex ? primary : 'rgba(255,255,255,0.3)' }}
          />
        ))}
      </View>
    </View>
  );
};

const SectionHeader = ({ title, isDark, primary, onPress }: any) => (
  <View className="px-5 mt-10 mb-5 flex-row items-center justify-between">
    <Text className={`text-sm font-black uppercase tracking-[3px] ${isDark ? 'text-white' : 'text-black'}`}>
      {title}
    </Text>
    {onPress && (
      <TouchableOpacity onPress={onPress}>
        <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}>View All</Text>
      </TouchableOpacity>
    )}
  </View>
);

const CircularItem = React.memo(({ item, onPress, isDark, primary }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => onPress(item)}
    className="mr-6 items-center"
  >
    <View className={`w-20 h-20 rounded-full items-center justify-center border-2 ${
      isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'
    } shadow-lg`} style={{ padding: 10 }}>
      {item.logo ? (
        <Image source={{ uri: item.logo }} className="w-full h-full" resizeMode="contain" />
      ) : (
        <Feather name="tv" size={24} color={primary} />
      )}
      <View className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-black items-center justify-center">
        <View className="w-1.5 h-1.5 bg-white rounded-full" />
      </View>
    </View>
    <Text className={`text-[8px] font-black mt-3 text-center w-20 uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-black/40'}`} numberOfLines={1}>
      {item.name}
    </Text>
  </TouchableOpacity>
));

const WideCardItem = React.memo(({ item, onPress, isDark, primary }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => onPress(item)}
    className="mr-5"
  >
    <View className={`w-40 aspect-[16/9] rounded-2xl overflow-hidden shadow-xl border ${
      isDark ? 'bg-[#141414] border-white/5' : 'bg-white border-black/5'
    }`}>
      <View className="flex-1 items-center justify-center p-6 bg-black/20">
         {item.logo ? (
          <Image source={{ uri: item.logo }} className="w-full h-full" resizeMode="contain" />
        ) : (
          <Feather name="tv" size={24} color={primary} />
        )}
      </View>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} className="absolute inset-0 justify-end p-3">
         <Text className="text-white text-[9px] font-black uppercase tracking-widest mb-0.5" numberOfLines={1}>
           {item.name}
         </Text>
         <EPGInfo channel={item} isDark={true} primary={primary} showNext={false} />
      </LinearGradient>
    </View>
  </TouchableOpacity>
));

const LiveTV = () => {
  const { width } = useWindowDimensions();
  const numColumns = width > 1200 ? 5 : width > 768 ? 4 : width > 480 ? 3 : 2;
  const cardWidth = (width - (numColumns + 1) * 16) / numColumns;

  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [qualityFilter, setQualityFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEpg, setLoadingEpg] = useState(false);
  const [activeTab, setActiveTab] = useState('FOR YOU');

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const { toggleFavorite, isFavorite, favorites, epgData, setEpgData } = usePlayerStore();
  const { setChannels: setGlobalChannels } = useIPTVStore();
  const isDark = mode === 'dark';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const countryCode = settingsStorage.getIptvCountry() || 'in';
      const languageCode = settingsStorage.getIptvLanguage() || 'all';
      
      let data;
      if (languageCode !== 'all') {
         data = await iptvParser.fetchByLanguage(languageCode);
      } else {
         data = await iptvParser.fetchByCountry(countryCode);
      }
      
      if (data && Array.isArray(data)) {
        setChannels(data);
        setGlobalChannels(data);
        
        // Smart Category Extraction: Split by ; and /
        const allCats: string[] = [];
        data.forEach((c: any) => {
           if (!c.category) return;
           const split = c.category.split(/[;/]/);
           split.forEach((part: string) => {
             const trimmed = part.trim();
             if (trimmed && trimmed.length > 1) {
               allCats.push(trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase());
             }
           });
        });
        
        const uniqueCategories = [...new Set(allCats)] as string[];
        uniqueCategories.sort();
        setCategories(['All', ...uniqueCategories]);
      }
    } catch (error) {
      console.error('Failed to load Live TV:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (channels.length > 0 && Object.keys(epgData).length === 0) {
      const fetchBulk = async () => {
        // Only show loading indicator if user is actively looking at the TV GUIDE
        if (activeTab === 'TV GUIDE') {
           setLoadingEpg(true);
        }
        
        const countryCode = settingsStorage.getIptvCountry() || 'in';
        try {
          // Pre-fetch EPG for top 40 channels (Home screen & Guide)
          // Reduced from 100 to 40 to stabilize memory on Android
          const map = await iptvParser.fetchBulkEPG(channels.slice(0, 40), countryCode);
          setEpgData(map);
        } catch (e) {
          console.error('[EPG] Background sync failed:', e);
        } finally {
          setLoadingEpg(false);
        }
      };
      
      // Delay background sync slightly to prioritize initial UI rendering
      const timer = setTimeout(fetchBulk, 2500);
      return () => clearTimeout(timer);
    }
  }, [channels, activeTab === 'TV GUIDE']);

  const sections = useMemo(() => {
    if (channels.length === 0) return null;
    
    // News Channels
    const newsChannels = channels.filter(c => (c.category || '').toLowerCase().includes('news') || c.name.toLowerCase().includes('news'));
    
    // Entertainment/Movies
    const watchFree = channels.filter(c => 
      ['entertainment', 'movies', 'series', 'general'].some(k => (c.category || '').toLowerCase().includes(k))
    );

    // Sports (for Hero or sections)
    const sports = channels.filter(c => (c.category || '').toLowerCase().includes('sports') || c.name.toLowerCase().includes('sports'));

    return {
      trending: newsChannels.slice(0, 15),
      acrossIndia: newsChannels.slice(15, 30),
      watchFree: watchFree.slice(0, 15),
      sports: sports.slice(0, 10),
      hero: [...newsChannels.slice(0, 3), ...sports.slice(0, 3)].sort(() => Math.random() - 0.5)
    };
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let result = channels;
    
    if (activeTab === 'NEWS') {
      result = channels.filter(c => (c.category || '').toLowerCase().includes('news') || c.name.toLowerCase().includes('news'));
    } else if (activeTab === 'SPORTS') {
      result = channels.filter(c => (c.category || '').toLowerCase().includes('sports') || c.name.toLowerCase().includes('sports'));
    } else if (activeTab === 'SHOWS') {
      result = channels.filter(c => ['entertainment', 'tv', 'general', 'shows'].some(k => (c.category || '').toLowerCase().includes(k)));
    } else if (activeTab === 'FOR YOU') {
      // In grid mode under FOR YOU (if search is active)
    }

    if (isSearchActive && debouncedSearch.length >= 2) {
      const query = debouncedSearch.toLowerCase();
      result = channels.filter(c => c.name.toLowerCase().includes(query) || (c.category && c.category.toLowerCase().includes(query)));
    }

    if (selectedCategory !== 'All') {
      const targetCat = selectedCategory.toLowerCase();
      result = result.filter(c => {
        if (!c.category) return false;
        return c.category.toLowerCase().split(/[;/]/).some((cat: string) => cat.trim() === targetCat);
      });
    }
    
    if (qualityFilter) {
      result = result.filter(c => c.quality === qualityFilter);
    }

    return result;
  }, [channels, debouncedSearch, activeTab, isSearchActive, selectedCategory, qualityFilter]);

  const handleChannelPress = useCallback((channel: any) => {
    const list = isSearchActive ? filteredChannels : channels;
    const index = list.findIndex(c => c.url === channel.url);
    navigation.navigate('ChannelInfo', { channel, channels: list, initialIndex: index >= 0 ? index : 0 });
  }, [navigation, channels, filteredChannels, isSearchActive]);

  const renderChannelItem = useCallback(({ item, index }: { item: any, index: number }) => {
    const favorited = isFavorite(item.url);

    return (
      <Animated.View entering={FadeInDown.delay(index % 10 * 50).duration(800).springify()}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleChannelPress(item)}
          className={`mb-6 rounded-[32px] overflow-hidden border ${isDark ? 'bg-[#0A0A0A] border-white/5' : 'bg-white border-black/5'} shadow-2xl`}
          style={{ width: cardWidth, marginHorizontal: 8 }}
        >
          <View className="aspect-video bg-black/60 items-center justify-center relative overflow-hidden">
            {item.logo ? (
              <Image source={{ uri: item.logo }} className="w-[85%] h-[85%]" resizeMode="contain" />
            ) : (
              <View className="items-center">
                <Feather name="tv" size={40} color={primary} style={{ opacity: 0.3 }} />
                <Text className="text-white/20 text-[10px] mt-2 font-black uppercase tracking-widest">No Signal</Text>
              </View>
            )}
            
            {/* Glossy Overlay */}
            <LinearGradient 
              colors={['rgba(255,255,255,0.05)', 'transparent', 'rgba(0,0,0,0.4)']} 
              className="absolute inset-0" 
            />

            {/* Quality Badge Overlay */}
            <View className="absolute top-3 right-3">
               <QualityBadge name={item.quality || 'SD'} isDark={true} />
            </View>
          </View>
          
          <View className={`p-5 ${isDark ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 mr-3">
                 <Text className={`font-black text-xs leading-tight ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
                   {item.name}
                 </Text>
                 <Text className={`text-[8px] font-bold uppercase tracking-[2px] mt-1 opacity-40 ${isDark ? 'text-white' : 'text-black'}`}>
                   {item.category?.split(/[;/]/)[0] || 'Live Signal'}
                 </Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}
                className={`p-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
              >
                <Ionicons 
                  name={favorited ? "heart" : "heart-outline"} 
                  size={14} 
                  color={favorited ? primary : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')} 
                />
              </TouchableOpacity>
            </View>
            
            <EPGInfo channel={item} isDark={isDark} primary={primary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [cardWidth, isDark, primary, toggleFavorite, isFavorite, handleChannelPress]);

  const Header = () => (
    <View className="absolute top-0 left-0 right-0 z-50 pt-12">
      <BlurView intensity={40} tint={isDark ? "dark" : "light"} className="px-6 py-5 flex-row items-center justify-between mx-4 mt-2 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl">
        <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-2xl bg-primary items-center justify-center mr-3 shadow-lg shadow-primary/30">
               <MaterialCommunityIcons name="television-play" size={24} color="white" />
            </View>
            <View>
               <Text className={`text-xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>OrbixTv</Text>
               <Text className="text-gray-500 text-[8px] font-black uppercase tracking-[2px]">Premium Live</Text>
            </View>
        </View>
        
        <View className="flex-row items-center space-x-3">
          <TouchableOpacity 
            onPress={() => setIsSearchActive(!isSearchActive)} 
            className={`w-10 h-10 items-center justify-center rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'} border border-white/5`}
          >
             <Feather name={isSearchActive ? "x" : "search"} size={18} color={isDark ? "white" : "black"} />
          </TouchableOpacity>
          
          <View className="bg-red-600/10 px-3 py-1.5 rounded-xl border border-red-600/20 flex-row items-center">
             <View className="w-1.5 h-1.5 rounded-full bg-red-600 mr-2 shadow-sm" />
             <Text className="text-red-600 text-[9px] font-black tracking-widest">{channels.length}</Text>
          </View>
        </View>
      </BlurView>
      
      {!isSearchActive && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="mt-6 ml-6"
          contentContainerStyle={{ paddingRight: 40 }}
        >
           {['FOR YOU', 'TV GUIDE', 'NEWS', 'SPORTS', 'SHOWS'].map(tab => (
             <TabItem 
                key={tab} 
                name={tab} 
                isActive={activeTab === tab} 
                onPress={setActiveTab} 
                isDark={isDark} 
                primary={primary} 
             />
           ))}
        </ScrollView>
      )}

      {isSearchActive && (
        <Animated.View entering={FadeInUp} className="px-5 mt-4">
           <TextInput
              autoFocus
              className="bg-white/10 h-12 rounded-2xl px-6 text-white font-bold"
              placeholder="Search Live Channels..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
           />
        </Animated.View>
      )}
    </View>
  );

  const SectionedView = () => {
    if (!sections) return null;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <LiveHeroCarousel channels={sections.hero} isDark={isDark} primary={primary} onPlay={handleChannelPress} />
        
        <SectionHeader title="Live News" isDark={isDark} primary={primary} onPress={() => setActiveTab('NEWS')} />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sections.trending}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => <CircularItem item={item} onPress={handleChannelPress} isDark={isDark} primary={primary} />}
          keyExtractor={(item, index) => `circ-${index}`}
        />

        <SectionHeader title="Trending Across India" isDark={isDark} primary={primary} onPress={() => setActiveTab('NEWS')} />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sections.acrossIndia}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => <WideCardItem item={item} onPress={handleChannelPress} isDark={isDark} primary={primary} />}
          keyExtractor={(item, index) => `wide-${index}`}
        />

        <SectionHeader title="Watch Free Now" isDark={isDark} primary={primary} onPress={() => setActiveTab('SHOWS')} />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sections.watchFree}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => <CircularItem item={item} onPress={handleChannelPress} isDark={isDark} primary={primary} />}
          keyExtractor={(item, index) => `circ-free-${index}`}
        />
        
        <SectionHeader title="Sports Central" isDark={isDark} primary={primary} onPress={() => setActiveTab('SPORTS')} />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sections.sports}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => <WideCardItem item={item} onPress={handleChannelPress} isDark={isDark} primary={primary} />}
          keyExtractor={(item, index) => `wide-sports-${index}`}
        />
      </ScrollView>
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Header />
      
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color={primary} size="large" />
          <Text className="text-gray-500 mt-4 font-black uppercase tracking-widest text-[10px]">Syncing Signal Hub...</Text>
        </View>
      ) : (
        <View className="flex-1 mt-48">
          {((activeTab === 'FOR YOU' && !isSearchActive) || isSearchActive) ? (
             <CategoryGrid
                categories={categories}
                onSelect={setSelectedCategory}
                selectedCategory={selectedCategory}
                qualityFilter={qualityFilter}
                onQualitySelect={(q: string | null) => setQualityFilter(qualityFilter === q ? null : q)}
             />
          ) : null}
          
          {activeTab === 'TV GUIDE' && !isSearchActive ? (
            <View className="flex-1">
              {loadingEpg ? (
                 <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color={primary} size="large" />
                    <Text className="text-gray-500 mt-4 font-black uppercase tracking-widest text-[10px]">Loading Timetables...</Text>
                 </View>
              ) : (
                 <TVGuideGrid 
                   channels={filteredChannels} 
                   epgData={epgData} 
                   isDark={isDark} 
                   primary={primary} 
                   onPlay={handleChannelPress} 
                   onVisibleChannelsChanged={(visibleChannels: any[]) => {
                     if (!visibleChannels || visibleChannels.length === 0) return;
                     
                     // Filter out channels already being fetched or already in cache
                     const countryCode = settingsStorage.getIptvCountry() || 'in';
                     const needed = visibleChannels.filter(c => !epgData[c.url]);
                     
                     if (needed.length > 0) {
                       iptvParser.fetchBulkEPG(needed, countryCode).then(map => {
                         if (Object.keys(map).length > 0) {
                           // Merge into global store
                           setEpgData({ ...epgData, ...map });
                         }
                       });
                     }
                   }}
                 />
              )}
            </View>
          ) : activeTab === 'FOR YOU' && !isSearchActive && selectedCategory === 'All' && !qualityFilter ? (
            <View className="flex-1">
               <SectionedView />
            </View>
          ) : (
            <FlashList
              data={filteredChannels}
              renderItem={renderChannelItem}
              estimatedItemSize={250}
              numColumns={numColumns}
              key={numColumns}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 150, paddingTop: 20 }}
            />
          )}
        </View>
      )}
    </View>
  );
};

export default LiveTV;
