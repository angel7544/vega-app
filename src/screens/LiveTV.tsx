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
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchInfo = async () => {
      const data = await iptvParser.getNowAndNext(channel);
      if (isMounted) setInfo(data);
    };
    fetchInfo();
    return () => { isMounted = false; };
  }, [channel.url]);

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
    className="mr-6 items-center"
  >
    <Text className={`font-black text-sm uppercase tracking-[2px] ${isActive ? (isDark ? 'text-white' : 'text-black') : (isDark ? 'text-white/40' : 'text-black/40')}`}>
      {name}
    </Text>
    {isActive && (
      <Animated.View 
        entering={FadeIn.duration(300)}
        className="h-1 rounded-full absolute -bottom-2 w-full"
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
      [0.6, 0, 0.6],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <View style={{ width: WINDOW_WIDTH, height: 450 }} className="relative overflow-hidden">
      <Image
        source={{ uri: item.logo || 'https://www.br31tech.live/placeholder.png' }}
        className="w-full h-full"
        resizeMode="cover"
        style={{ opacity: 0.8 }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(0,0,0,0.9)', isDark ? '#000' : '#fff']}
        locations={[0, 0.2, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }, animatedOverlay]} />
      
      <View className="absolute bottom-12 w-full px-8 items-center">
        <Image
          source={{ uri: item.logo }}
          style={{ width: 150, height: 80, resizeMode: 'contain' }}
          className="mb-4"
        />
        <Text className="text-white text-center text-xs font-black uppercase tracking-[4px] mb-6 opacity-60">
          Now Streaming Live
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onPlay(item)}
          className="bg-white flex-row items-center px-10 py-4 rounded-full shadow-2xl"
          style={{ backgroundColor: isDark ? 'white' : 'black' }}
        >
          <MaterialCommunityIcons 
            name="play" 
            size={24} 
            color={isDark ? 'black' : 'white'} 
          />
          <Text className={`ml-2 font-black text-xs uppercase tracking-[3px] ${isDark ? 'text-black' : 'text-white'}`}>
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
  const [epgData, setEpgData] = useState<Record<string, any>>({});

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const { toggleFavorite, isFavorite, favorites } = usePlayerStore();
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
        const mapCats = data.map((c: any) => {
           if (!c.category) return null;
           const cat = c.category.trim();
           return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        }).filter(Boolean);
        const uniqueCategories = [...new Set(mapCats)] as string[];
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
    if (activeTab === 'TV GUIDE' && channels.length > 0 && Object.keys(epgData).length === 0) {
      const fetchBulk = async () => {
        setLoadingEpg(true);
        const countryCode = settingsStorage.getIptvCountry() || 'in';
        try {
          const map = await iptvParser.fetchBulkEPG(channels.slice(0, 100), countryCode); // limit to top 100 for perf initially
          setEpgData(map);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingEpg(false);
        }
      };
      fetchBulk();
    }
  }, [activeTab, channels]);

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
      result = result.filter(c => c.category === selectedCategory);
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
      <Animated.View entering={FadeInDown.delay(index % 10 * 50).duration(600).springify()}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleChannelPress(item)}
          className={`mb-6 rounded-3xl overflow-hidden border ${isDark ? 'bg-[#0D0D0D] border-white/5' : 'bg-white border-black/10'}`}
          style={{ width: cardWidth, marginHorizontal: 8 }}
        >
          <View className="aspect-video bg-black/40 items-center justify-center relative overflow-hidden">
            {item.logo ? (
              <Image source={{ uri: item.logo }} className="w-[70%] h-[70%]" resizeMode="contain" />
            ) : (
              <Feather name="tv" size={32} color={primary} style={{ opacity: 0.5 }} />
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute inset-0 justify-end" />
          </View>
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-1 mr-2">
               <Text className={`font-black text-xs ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>{item.name}</Text>
               <EPGInfo channel={item} isDark={isDark} primary={primary} />
               <Text className={`text-[7px] font-black uppercase tracking-widest mt-1.5 opacity-30 ${isDark ? 'text-white' : 'text-black'}`}>{item.category || 'Live Signal'}</Text>
            </View>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}>
              <Ionicons name={favorited ? "heart" : "heart-outline"} size={16} color={favorited ? primary : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [cardWidth, isDark, primary, toggleFavorite, isFavorite, handleChannelPress]);

  const Header = () => (
    <View className="absolute top-0 left-0 right-0 z-50 pt-12">
      <BlurView intensity={20} tint="dark" className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-baseline">
           <Text className={`text-2xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>OrbixTv</Text>
           <Text className="text-primary text-[8px] font-black ml-2 tracking-widest bg-white/10 px-1.5 py-0.5 rounded">LIVE ({channels.length})</Text>
        </View>
        <TouchableOpacity onPress={() => setIsSearchActive(!isSearchActive)} className="p-2 bg-white/10 rounded-full">
           <Feather name={isSearchActive ? "x" : "search"} size={20} color="white" />
        </TouchableOpacity>
      </BlurView>
      
      {!isSearchActive && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 px-5">
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
        <View className="flex-1 mt-44">
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
                   channels={filteredChannels.slice(0, 100)} 
                   epgData={epgData} 
                   isDark={isDark} 
                   primary={primary} 
                   onPlay={handleChannelPress} 
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
              estimatedItemSize={200}
              numColumns={numColumns}
              key={numColumns}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100, paddingTop: 20 }}
            />
          )}
        </View>
      )}
    </View>
  );
};

export default LiveTV;
