import {View, Text, Platform, FlatList, TextInput, ScrollView, Image} from 'react-native';
import React, {useState, useMemo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {WatchListStackParamList} from '../types/navigation';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import Feather from '@expo/vector-icons/Feather';
import {StatusBar} from 'expo-status-bar';
import {useShowNavBarOnScroll} from '../lib/hooks/useShowNavBarOnScroll';
import useContentStore, {Content} from '../lib/zustand/contentStore';
import WatchListCard from '../components/WatchListCard';
import usePlayerStore from '../lib/zustand/playerStore';

const WatchList = () => {
  const {primary, mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const navigation =
    useNavigation<NativeStackNavigationProp<WatchListStackParamList>>();
  const {handleScroll} = useShowNavBarOnScroll();
  const {watchList, removeItem} = useWatchListStore(state => state);
  const {favorites = []} = usePlayerStore(state => state);
  const {installedProviders, setProvider} = useContentStore((state: Content) => state);

  const [searchText, setSearchText] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<string | null>(null);

  // Extract all available genres and years for filters
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    watchList.forEach(item => {
      item.genres?.forEach(g => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [watchList]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    watchList.forEach(item => {
      if (item.year) years.add(item.year);
    });
    return Array.from(years).sort().reverse();
  }, [watchList]);

  // Filter the watchlist based on search text
  const filteredList = useMemo(() => {
    return watchList.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchText.toLowerCase());
      const matchesGenre = !activeGenre || item.genres?.includes(activeGenre);
      const matchesYear = !activeYear || item.year === activeYear;
      return matchesSearch && matchesGenre && matchesYear;
    }).reverse();
  }, [watchList, searchText, activeGenre, activeYear]);

  const renderItem = ({item}: {item: any}) => (
    <WatchListCard
      item={item}
      onPress={() => {
        // Remember and sync the provider
        if (item.provider) {
          const matchingProvider = installedProviders.find((p: any) => p.value === item.provider);
          if (matchingProvider) {
            setProvider(matchingProvider);
          }
        }

        navigation.navigate('Info', {
          link: item.link,
          provider: item.provider,
          poster: item.poster,
        });
      }}
      onRemove={() => removeItem(item.link)}
    />
  );

  const FilterPill = ({label, isActive, onPress, onClear}: {label: string, isActive: boolean, onPress: () => void, onClear?: () => void}) => (
    <View className="flex-row items-center mr-2">
      <TouchableOpacity
        onPress={onPress}
        className={`flex-row items-center px-4 py-2 rounded-full border ${
          isActive 
            ? `bg-primary/20 border-primary` 
            : isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-gray-100 border-gray-200'
        }`}>
        <Text className={`text-sm ${isActive ? 'text-primary font-bold' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </Text>
        {!isActive && <Feather name="chevron-down" size={14} color={isDark ? '#666' : '#999'} style={{marginLeft: 4}} />}
      </TouchableOpacity>
      {isActive && (
        <TouchableOpacity 
          onPress={onClear}
          className="ml-1 w-6 h-6 items-center justify-center bg-primary/10 rounded-full"
        >
          <Feather name="x" size={12} color={primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View
      className={`flex-1 ${
        isDark ? 'bg-black' : 'bg-white'
      }`}>
      <StatusBar translucent backgroundColor="transparent" />

      {/* Header Space for Status Bar */}
      <View
        style={{
          paddingTop: Platform.OS === 'android' ? 40 : 60,
        }}
      />

      <View className="flex-1 px-4">
        {/* Title and Count */}
        <View className="flex-row items-baseline mb-6">
          <Text
            className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>
            Watchlist
          </Text>
          <Text className={`text-lg ml-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {watchList.length} items
          </Text>
        </View>

        {/* Search Bar */}
        <View
          className={`flex-row items-center px-4 py-3 rounded-2xl mb-6 ${
            isDark ? 'bg-[#121212]' : 'bg-gray-100'
          }`}>
          <Feather name="search" size={20} color="#666" />
          <TextInput
            className={`flex-1 ml-3 text-base ${isDark ? 'text-white' : 'text-black'}`}
            placeholder="Search for movies"
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Wishlisted Channels (Live TV) */}
        {favorites.length > 0 && !searchText && !activeGenre && !activeYear && (
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                Wishlisted Channels
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('FavoriteTV' as any)}>
                <Text className="text-primary text-sm font-bold">See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
              {favorites.map((channel, index) => (
                <TouchableOpacity
                  key={channel.url + index}
                  onPress={() => (navigation.navigate as any)('ChannelInfo', { channel, channels: favorites, initialIndex: index })}
                  className={`mr-4 p-3 rounded-2xl border ${
                    isDark ? 'bg-[#121212] border-white/5' : 'bg-gray-100 border-gray-200'
                  }`}
                  style={{ width: 140 }}
                >
                  <View className="aspect-video bg-black/40 rounded-xl overflow-hidden items-center justify-center mb-2">
                    {channel.logo ? (
                      <Image source={{ uri: channel.logo }} className="w-full h-full" resizeMode="contain" />
                    ) : (
                      <Feather name="tv" size={24} color={primary} />
                    )}
                  </View>
                  <Text 
                    className={`text-xs font-bold ${isDark ? 'text-white' : 'text-black'}`} 
                    numberOfLines={1}
                  >
                    {channel.name}
                  </Text>
                  <Text className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                    {channel.category || 'Live TV'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filters */}
        <View className="mb-8">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <FilterPill 
              label={activeGenre || "Genre"} 
              isActive={!!activeGenre}
              onPress={() => {
                // Simple cycle through genres for now (could be a modal in future)
                const nextIdx = (availableGenres.indexOf(activeGenre || '') + 1) % availableGenres.length;
                setActiveGenre(availableGenres[nextIdx]);
              }}
              onClear={() => setActiveGenre(null)}
            />
            <FilterPill 
              label={activeYear || "Year"} 
              isActive={!!activeYear}
              onPress={() => {
                const nextIdx = (availableYears.indexOf(activeYear || '') + 1) % availableYears.length;
                setActiveYear(availableYears[nextIdx]);
              }}
              onClear={() => setActiveYear(null)}
            />
            {(activeGenre || activeYear || searchText) && (
              <TouchableOpacity 
                onPress={() => {
                   setActiveGenre(null);
                   setActiveYear(null);
                   setSearchText('');
                }}
                className="px-4 py-2"
              >
                <Text className="text-primary text-sm font-bold">Clear All</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {filteredList.length > 0 ? (
          <FlatList
            data={filteredList}
            renderItem={renderItem}
            keyExtractor={(item, index) => item.link + index}
            contentContainerStyle={{
              paddingBottom: 100,
            }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center -mt-20">
            <View
              className={`${
                isDark ? 'bg-white/5' : 'bg-gray-100'
              } rounded-full p-8 mb-6`}>
              <Feather name="film" size={60} color={primary} />
            </View>
            <Text
              className={`${
                isDark ? 'text-white' : 'text-black'
              } font-bold text-lg text-center`}>
              {searchText ? 'No results found' : 'Your WatchList is empty'}
            </Text>
            <Text
              className={`${
                isDark ? 'text-gray-400' : 'text-gray-500'
              } text-sm text-center mt-2`}>
              {searchText ? 'Try reaching for something else' : 'Items you save for later will appear here'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default WatchList;

