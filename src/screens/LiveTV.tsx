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
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  SlideInRight,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { iptvParser } from '../lib/iptvParser';
import useThemeStore from '../lib/zustand/themeStore';
import CategoryGrid from '../components/CategoryGrid';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import usePlayerStore from '../lib/zustand/playerStore';
import { settingsStorage } from '../lib/storage';
import useIPTVStore from '../lib/zustand/iptvStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

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

// Sub-components moved outside for performance and fixing focus issues
const TabItem = React.memo(({ name, icon, isActive, onPress, isDark, primary }: any) => (
  <TouchableOpacity 
    onPress={() => onPress(name)}
    className={`flex-row items-center px-6 py-2.5 rounded-2xl mr-3 ${isActive ? 'bg-primary' : (isDark ? 'bg-white/5' : 'bg-black/5')}`}
    style={isActive ? { backgroundColor: primary, shadowColor: primary, shadowRadius: 10, elevation: 10 } : {}}
  >
    <Feather name={icon} size={16} color={isActive ? 'white' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
    <Text className={`ml-2 font-black text-xs uppercase tracking-widest ${isActive ? 'text-white' : (isDark ? 'text-white/40' : 'text-black/40')}`}>
      {name}
    </Text>
  </TouchableOpacity>
));

const RecentChannelItem = React.memo(({ item, index, onPress, isDark, primary }: any) => (
  <Animated.View entering={SlideInRight.delay(index * 100).duration(800)}>
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={() => onPress(item)}
      className="mr-5 items-center"
    >
      <View className={`w-20 h-20 rounded-[28px] overflow-hidden items-center justify-center shadow-2xl ${
        isDark ? 'bg-[#0D0D0D] border border-white/10' : 'bg-white border border-black/5'
      }`}>
         {item.image ? (
          <Image source={{ uri: item.image }} className="w-full h-full" resizeMode="contain" />
        ) : (
          <Feather name="tv" size={24} color={primary} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text className={`text-[10px] font-black mt-3 text-center w-20 uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-black/30'}`} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  </Animated.View>
));

const LiveTV = () => {
  const { width } = useWindowDimensions();
  const numColumns = width > 1200 ? 4 : width > 768 ? 3 : width > 480 ? 2 : 1;
  const cardWidth = (width - (numColumns + 1) * 16) / numColumns;

  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [qualityFilter, setQualityFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVpnInfo, setShowVpnInfo] = useState(false);
  const [activeTab, setActiveTab] = useState('Explore');

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const { history } = useWatchHistoryStore();
  const { toggleFavorite, isFavorite, favorites } = usePlayerStore();
  const { setChannels: setGlobalChannels } = useIPTVStore();
  const isDark = mode === 'dark';

  // Debounce search input
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
      const data = await iptvParser.fetchByCountry('in'); 
      if (data && Array.isArray(data)) {
        setChannels(data);
        setGlobalChannels(data);
        const uniqueCategories = [...new Set(data.map((c: any) => c.category).filter(Boolean))] as string[];
        setCategories(['All', ...uniqueCategories]);
      }
    } catch (error) {
      console.error('Failed to load Live TV:', error);
    } finally {
      setLoading(false);
    }
  };

  const recentChannels = useMemo(() => {
    const seen = new Set();
    return history
      .filter((item: any) => item.isLiveTV)
      .filter((item: any) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      })
      .slice(0, 10);
  }, [history]);


  const filteredChannels = useMemo(() => {
    let result = channels;
    if (activeTab === 'Favorites') result = favorites;
    else if (activeTab === 'Sports') result = result.filter(c => (c.category || '').toLowerCase().includes('sports') || c.name.toLowerCase().includes('sports'));

    if (selectedCategory !== 'All' && activeTab === 'Explore') result = result.filter(c => c.category === selectedCategory);
    if (qualityFilter) {
      const keywords = QUALITY_KEYWORDS[qualityFilter as keyof typeof QUALITY_KEYWORDS] || [qualityFilter];
      result = result.filter(c => keywords.some(k => c.name.toLowerCase().includes(k.toLowerCase())));
    }
    if (debouncedSearch && debouncedSearch.length >= 3) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(query) || (c.category && c.category.toLowerCase().includes(query)));
    }
    return result;
  }, [channels, selectedCategory, qualityFilter, debouncedSearch, activeTab, favorites]);

  const handleChannelPress = (channel: any) => {
    const index = channels.findIndex(c => c.url === channel.url);
    navigation.navigate('ChannelInfo', { channel, channels: filteredChannels, initialIndex: index >= 0 ? index : 0 });
  };


  const renderChannelItem = useCallback(({ item, index }: { item: any, index: number }) => {
    const favorited = isFavorite(item.url);

    return (
      <Animated.View entering={FadeInDown.delay(index % 10 * 50).duration(600).springify()}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleChannelPress(item)}
          className={`mb-6 rounded-[32px] overflow-hidden shadow-2xl border ${isDark ? 'bg-[#0D0D0D] border-white/5' : 'bg-white border-black/10'}`}
          style={{ 
            width: cardWidth, 
            marginHorizontal: 8,
          }}
        >
          <View className="aspect-video bg-black/40 items-center justify-center relative overflow-hidden">
            {item.logo ? (
              <Image source={{ uri: item.logo }} className="w-[75%] h-[70%]" resizeMode="contain" />
            ) : (
              <View className="items-center">
                <Feather name="tv" size={44} color={primary} style={{ opacity: 0.5 }} />
                <Text className="text-white/20 text-[10px] mt-2 font-black uppercase">Signal Lost</Text>
              </View>
            )}

            <View className="absolute top-4 left-4 right-4 flex-row justify-between items-start">
               <View />
               <QualityBadge name={item.name} isDark={isDark} />
            </View>

            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} className="absolute inset-0 justify-end" />
          </View>
          
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} className="p-5 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
               <Text className={`font-black text-lg mb-0.5 ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>{item.name}</Text>
               <View className="flex-row items-center">
                 <View className={`w-1 h-1 rounded-full mr-2 ${isDark ? 'bg-white/30' : 'bg-black/30'}`} />
                 <Text className={`text-[10px] font-black uppercase tracking-[2px] ${isDark ? 'text-white/40' : 'text-black/40'}`}>{item.category || 'Global Select'}</Text>
               </View>
            </View>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }} className={`p-3.5 rounded-2xl ${favorited ? 'bg-primary shadow-lg shadow-primary/40' : (isDark ? 'bg-white/5 border border-white/5' : 'bg-black/5 border border-black/5')}`}>
              <Ionicons name={favorited ? "heart" : "heart-outline"} size={18} color={favorited ? 'white' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)')} />
            </TouchableOpacity>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [cardWidth, isDark, primary, favorites, isFavorite, handleChannelPress]);

  const HeaderTop = () => (
    <View className="pt-14 px-5">

      {/* Recent Signals Section */}
      {recentChannels.length > 0 && activeTab === 'Explore' && (
        <View className="mb-8">
          <View className="mb-5 flex-row items-center justify-between">
            <Text className={`text-[11px] font-black uppercase tracking-[3px] ${isDark ? 'text-white/40' : 'text-black/40'}`}>Recently Played</Text>
            <View className="h-px flex-1 bg-primary/20 ml-4" />
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recentChannels}
            contentContainerStyle={{ paddingRight: 20 }}
            keyExtractor={item => item.link}
            renderItem={({ item, index }) => (
              <RecentChannelItem
                item={item}
                index={index}
                onPress={(c: any) => handleChannelPress({ name: c.title, url: c.link, logo: c.image })}
                isDark={isDark}
                primary={primary}
              />
            )}
          />
        </View>
      )}

      {/* Search Header */}
      <View className="flex-row items-center space-x-3 mb-8">
        <View
          className={`flex-1 overflow-hidden rounded-xl ${
            isDark ? 'bg-[#141414]' : 'bg-gray-100'
          } shadow-lg shadow-black/50`}>
          <View className="px-3 py-3">
            <View className="flex-row items-center">
              <Feather
                name="search"
                size={22}
                color={isFocused ? primary : '#666'}
              />
              <TextInput
                className={`flex-1 ${
                  isDark ? 'text-white' : 'text-black'
                } text-base ml-3`}
                placeholder="Search TV Channels..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  className="bg-gray-800/50 rounded-full p-2 ml-2">
                  <Feather name="x" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowVpnInfo(true)} className="ml-3 p-3.5 bg-primary/10 rounded-xl">
          <Feather name="info" size={24} color={primary} />
        </TouchableOpacity>
      </View>

      {/* Main Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ marginBottom: 32 }}>
        <TabItem name="Explore" icon="grid" isActive={activeTab === 'Explore'} onPress={setActiveTab} isDark={isDark} primary={primary} />
        <TabItem name="Favorites" icon="heart" isActive={activeTab === 'Favorites'} onPress={setActiveTab} isDark={isDark} primary={primary} />
        <TabItem name="Sports" icon="activity" isActive={activeTab === 'Sports'} onPress={setActiveTab} isDark={isDark} primary={primary} />
      </ScrollView>
    </View>
  );

  const ListHeader = () => (
    <View>
      <HeaderTop />
      {activeTab === 'Explore' && (
        <View className={`${isDark ? 'bg-black' : 'bg-white'} pb-2 pt-2 border-b border-black/5`}>
          <CategoryGrid 
            categories={categories} 
            onSelect={setSelectedCategory} 
            selectedCategory={selectedCategory}
            qualityFilter={qualityFilter}
            onQualitySelect={(q: any) => setQualityFilter(qualityFilter === q ? null : q)}
          />
        </View>
      )}
      
      {/* List Title */}
      <View className="px-6 mt-8 mb-4 flex-row items-center justify-between">
        <View>
          <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-black'}`}>
            {activeTab === 'Favorites' ? 'Collected' : (activeTab === 'Sports' ? 'Live Sports' : 'Explore')}
          </Text>
          <Text className={`font-black uppercase text-[9px] tracking-[4px] mt-1 ${isDark ? 'text-white/20' : 'text-black/20'}`}>Active Signals</Text>
        </View>
        <LinearGradient colors={[primary, primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ opacity: 0.9 }} className="px-4 py-1.5 rounded-full shadow-lg">
          <Text className="text-white text-[10px] font-black uppercase tracking-widest">{filteredChannels.length} Channels</Text>
        </LinearGradient>
      </View>
    </View>
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color={primary} size="large" />
          <Text className="text-gray-500 mt-4 font-black uppercase tracking-widest text-xs">Synchronizing Signals...</Text>
        </View>
      ) : (
        <FlashList
          data={filteredChannels}
          renderItem={renderChannelItem}
          estimatedItemSize={280}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          ListHeaderComponent={ListHeader}
          numColumns={numColumns}
          key={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 8 }}
          removeClippedSubviews={Platform.OS === 'android'} 
          drawDistance={500}
        />
      )}

      {/* VPN Info Modal */}
      <Modal visible={showVpnInfo} transparent animationType="fade" onRequestClose={() => setShowVpnInfo(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowVpnInfo(false)} className="flex-1 bg-black/80 justify-center items-center p-8">
          <Animated.View entering={FadeIn.duration(300)} className={`p-10 rounded-[48px] w-full max-w-sm border ${isDark ? 'bg-[#0A0A0A] border-white/10' : 'bg-white border-black/10'}`}>
            <View className="p-6 bg-primary/10 rounded-full self-center mb-8">
              <Feather name="shield" size={48} color={primary} />
            </View>
            <Text className={`text-2xl font-black text-center ${isDark ? 'text-white' : 'text-black'}`}>Signal Access</Text>
            <Text className="text-gray-500 text-center mt-4 font-bold leading-6">
              Some regional signals may require a <Text className="text-primary">VPN Connection</Text> for stable viewing. 
              If a channel fails to synchronize, try connecting to its local region.
            </Text>
            <TouchableOpacity onPress={() => setShowVpnInfo(false)} className="mt-10 py-5 rounded-3xl items-center shadow-xl shadow-primary/30" style={{ backgroundColor: primary }}>
              <Text className="text-white font-black uppercase tracking-[4px] text-xs">Synchronize</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default LiveTV;
