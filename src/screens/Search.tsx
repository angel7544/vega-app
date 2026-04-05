import {View, Text, FlatList} from 'react-native';
import React, {useState, useEffect, useCallback, useMemo, memo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../types/navigation';
import {Feather} from '@expo/vector-icons';
import {TextInput, TouchableOpacity, ScrollView, Image} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {MMKV} from '../lib/Mmkv';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useShowNavBarOnScroll} from '../lib/hooks/useShowNavBarOnScroll';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInRight,
  Layout,
  withTiming,
} from 'react-native-reanimated';
import {searchOMDB} from '../lib/services/omdb';
import debounce from 'lodash/debounce';
import {OMDBResult} from '../types/omdb';
import useIPTVStore, {IPTVChannel} from '../lib/zustand/iptvStore';

const MAX_VISIBLE_RESULTS = 15; // Limit number of animated items to prevent excessive callbacks
const MAX_HISTORY_ITEMS = 30; // Maximum number of history items to store

// Memoized search result item to prevent unnecessary re-renders
const SearchResultItem = memo(
  ({
    item,
    onPress,
    mode,
  }: {
    item: OMDBResult;
    onPress: (title: string) => void;
    mode: 'light' | 'dark';
  }) => {
    const handlePress = useCallback(() => {
      onPress(item.Title);
    }, [item.Title, onPress]);

    return (
      <View className="px-4">
        <TouchableOpacity
          className={`py-3 border-b ${
            mode === 'dark' ? 'border-white/10' : 'border-gray-200'
          }`}
          onPress={handlePress}>
          <View className="flex-row items-center">
            <Feather
              name="search"
              size={20}
              color="#666"
              style={{marginRight: 12}}
            />
            <View>
              <Text
                className={`${
                  mode === 'dark' ? 'text-white' : 'text-black'
                } text-base`}>
                {item.Title}
              </Text>
              <Text
                className={`${
                  mode === 'dark' ? 'text-white/50' : 'text-black/50'
                } text-xs`}>
                {item.Type === 'series' ? 'TV Show' : 'Movie'} • {item.Year}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  },
);

// Memoized history item component
const HistoryItem = memo(
  ({
    search,
    onPress,
    onRemove,
    primary,
    mode,
  }: {
    search: string;
    onPress: (text: string) => void;
    onRemove: (text: string) => void;
    primary: string;
    mode: 'light' | 'dark';
  }) => {
    const handlePress = useCallback(() => {
      onPress(search);
    }, [search, onPress]);

    const handleRemove = useCallback(() => {
      onRemove(search);
    }, [search, onRemove]);

    return (
      <View
        className={`${
          mode === 'dark' ? 'bg-[#141414]' : 'bg-gray-100'
        } rounded-lg p-3 mb-2 flex-row justify-between items-center border ${
          mode === 'dark' ? 'border-white/5' : 'border-gray-200'
        }`}>
        <TouchableOpacity
          onPress={handlePress}
          className="flex-row flex-1 items-center space-x-2">
          <View
            className={`${
              mode === 'dark' ? 'bg-white/10' : 'bg-gray-200'
            } rounded-full p-1.5`}>
            <Feather name="clock" size={16} color={primary} />
          </View>
          <Text
            className={`${
              mode === 'dark' ? 'text-white' : 'text-black'
            } text-sm ml-2`}>
            {search}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRemove}
          className={`${
            mode === 'dark' ? 'bg-white/5' : 'bg-gray-200'
          } rounded-full p-1.5`}>
          <Feather name="x" size={14} color="#999" />
        </TouchableOpacity>
      </View>
    );
  },
);

const Search = () => {
  const {primary, mode} = useThemeStore(state => state);
  const {handleScroll} = useShowNavBarOnScroll();
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    MMKV.getArray<string>('searchHistory') || [],
  );
  const {channels: allChannels = []} = useIPTVStore();
  const [searchResults, setSearchResults] = useState<OMDBResult[]>([]);
  const [channelResults, setChannelResults] = useState<IPTVChannel[]>([]);
  const [searchMode, setSearchMode] = useState<'vod' | 'live'>('vod');

  const debouncedSearch = useCallback(
    debounce(async (text: string, mode: 'vod' | 'live') => {
      if (text.length >= 2) {
        if (mode === 'vod') {
          setSearchResults([]); // Clear previous results
          const results = await searchOMDB(text);
          if (results.length > 0) {
            const uniqueResults = results.reduce((acc, current) => {
              const x = acc.find(
                (item: OMDBResult) => item.imdbID === current.imdbID,
              );
              if (!x) return acc.concat([current]);
              return acc;
            }, [] as OMDBResult[]);
            setSearchResults(uniqueResults.slice(0, MAX_VISIBLE_RESULTS));
          }

          // In VOD mode, also show a small preview of matching channels
          const filteredChannels = allChannels
            .filter(
              c =>
                c.name.toLowerCase().includes(text.toLowerCase()) ||
                (c.category &&
                  c.category.toLowerCase().includes(text.toLowerCase())),
            )
            .slice(0, 5);
          setChannelResults(filteredChannels);
        } else {
          // Live mode: search only channels, no limit
          setSearchResults([]);
          const filteredChannels = allChannels
            .filter(
              c =>
                c.name.toLowerCase().includes(text.toLowerCase()) ||
                (c.category &&
                  c.category.toLowerCase().includes(text.toLowerCase())),
            );
          setChannelResults(filteredChannels);
        }
      } else {
        setSearchResults([]);
        setChannelResults([]);
      }
    }, 300),
    [allChannels],
  );

  useEffect(() => {
    debouncedSearch(searchText, searchMode);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchText, searchMode, debouncedSearch]);

  const handleSearch = useCallback(
    (text: string) => {
      if (text.trim()) {
        // Save to search history
        const prevSearches = MMKV.getArray<string>('searchHistory') || [];
        if (!prevSearches.includes(text.trim())) {
          const newSearches = [text.trim(), ...prevSearches].slice(
            0,
            MAX_HISTORY_ITEMS,
          );
          MMKV.setArray('searchHistory', newSearches);
          setSearchHistory(newSearches);
        }

        navigation.navigate('SearchResults', {
          filter: text.trim(),
        });
      }
    },
    [navigation],
  );

  const removeHistoryItem = useCallback(
    (search: string) => {
      const newSearches = searchHistory.filter(item => item !== search);
      MMKV.setArray('searchHistory', newSearches);
      setSearchHistory(newSearches);
    },
    [searchHistory],
  );

  const clearHistory = useCallback(() => {
    MMKV.setArray('searchHistory', []);
    setSearchHistory([]);
  }, []);

  const handleResultPress = useCallback(
    (title: string) => {
      // Save to search history
      const prevSearches = MMKV.getArray<string>('searchHistory') || [];
      if (!prevSearches.includes(title)) {
        const newSearches = [title, ...prevSearches].slice(
          0,
          MAX_HISTORY_ITEMS,
        );
        MMKV.setArray('searchHistory', newSearches);
        setSearchHistory(newSearches);
      }
      navigation.navigate('SearchResults', {
        filter: title,
      });
    },
    [navigation],
  );

  // Memoized render function for search results
  const renderSearchResult = useCallback(
    ({item}: {item: OMDBResult}) => (
      <SearchResultItem item={item} onPress={handleResultPress} mode={mode} />
    ),
    [handleResultPress, mode],
  );

  // Memoized render function for history items
  const renderHistoryItem = useCallback(
    ({item}: {item: string}) => (
      <HistoryItem
        search={item}
        onPress={handleSearch}
        onRemove={removeHistoryItem}
        primary={primary}
        mode={mode}
      />
    ),
    [handleSearch, removeHistoryItem, primary, mode],
  );

  // Memoized key extractors
  const searchResultKeyExtractor = useCallback(
    (item: OMDBResult) => item.imdbID.toString(),
    [],
  );
  const historyKeyExtractor = useCallback(
    (item: string, index: number) => `history-${index}`,
    [],
  );

  // Conditionally render animations based on state
  const AnimatedContainer = Animated.View;

  const showToggle = !isFocused && searchText.length === 0;

  return (
    <SafeAreaView
      className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
      {/* Title Section */}
      <AnimatedContainer
        entering={FadeInDown.springify()}
        layout={Layout.springify()}
        className="px-4 pt-4">
        <Text
          className={`${
            mode === 'dark' ? 'text-white' : 'text-black'
          } text-xl font-bold mb-3`}>
          Search
        </Text>
        <View className="flex-row items-center space-x-3 mb-2">
          {/* Animated Search Bar Container */}
          <AnimatedContainer 
            layout={Layout.springify()}
            className="flex-1"
          >
            <View
              className={`overflow-hidden rounded-xl ${
                mode === 'dark' ? 'bg-[#141414]' : 'bg-gray-100'
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
                      mode === 'dark' ? 'text-white' : 'text-black'
                    } text-base ml-3`}
                    placeholder={`Search ${searchMode === 'vod' ? 'movies & series' : 'TV channels'}...`}
                    placeholderTextColor="#666"
                    value={searchText}
                    onChangeText={setSearchText}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onSubmitEditing={e => handleSearch(e.nativeEvent.text)}
                    returnKeyType="search"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchText('')}
                      className="bg-gray-800/50 rounded-full p-2">
                      <Feather name="x" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </AnimatedContainer>

          {/* Vertical Expandable Toggle Column */}
          {showToggle && (
            <AnimatedContainer 
              entering={SlideInRight.springify()} 
              exiting={FadeOut.duration(200)}
              className="flex-col space-y-1"
            >
              <TouchableOpacity 
                onPress={() => setSearchMode('vod')}
                className={`p-2.5 rounded-xl items-center justify-center ${searchMode === 'vod' ? 'bg-primary' : 'bg-white/5'}`}
              >
                <Feather name="film" size={16} color={searchMode === 'vod' ? 'white' : '#666'} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setSearchMode('live')}
                className={`p-2.5 rounded-xl items-center justify-center ${searchMode === 'live' ? 'bg-primary' : 'bg-white/5'}`}
              >
                <Feather name="tv" size={16} color={searchMode === 'live' ? 'white' : '#666'} />
              </TouchableOpacity>
            </AnimatedContainer>
          )}
        </View>

        {/* Small Mode Indicator when searching */}
        {!showToggle && (
           <AnimatedContainer entering={FadeInDown.duration(300)} className="absolute -bottom-8 right-6 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              <View className="flex-row items-center">
                 <Feather name={searchMode === 'vod' ? "film" : "tv"} size={10} color={primary} />
                 <Text className="text-primary text-[8px] font-black uppercase ml-2 tracking-widest">{searchMode === 'vod' ? 'Movies & Series' : 'TV Channels'}</Text>
              </View>
           </AnimatedContainer>
        )}
      </AnimatedContainer>

      {/* Search Results */}
      <AnimatedContainer
        layout={Layout.springify()}
        className="flex-1"
        key={
          searchResults.length > 0
            ? 'results'
            : searchHistory.length > 0
              ? 'history'
              : 'empty'
        }>
        {searchResults.length > 0 || (searchMode === 'live' && channelResults.length > 0) ? (
          <FlatList
            data={searchMode === 'vod' ? searchResults : channelResults}
            keyExtractor={(item: any) => item.imdbID ? item.imdbID.toString() : item.url}
            renderItem={searchMode === 'vod' ? renderSearchResult : ({item}) => (
              <TouchableOpacity
                onPress={() => (navigation.navigate as any)('ChannelInfo', { channel: item, channels: allChannels, initialIndex: 0 })}
                className={`mx-4 mb-3 p-4 rounded-[28px] border flex-row items-center ${
                  mode === 'dark' ? 'bg-[#141414] border-white/5' : 'bg-gray-100 border-gray-200'
                }`}
              >
                <View className="w-16 h-16 bg-black/40 rounded-2xl items-center justify-center overflow-hidden mr-4">
                   {item.logo ? (
                     <Image source={{ uri: item.logo }} className="w-[75%] h-[75%]" resizeMode="contain" />
                   ) : (
                     <Feather name="tv" size={24} color={primary} />
                   )}
                </View>
                <View className="flex-1">
                   <Text className={`text-lg font-black ${mode === 'dark' ? 'text-white' : 'text-black'}`} numberOfLines={1}>
                     {item.name}
                   </Text>
                   <View className="flex-row items-center mt-1">
                     <View className="bg-primary/20 px-2 py-0.5 rounded-md mr-2">
                        <Text className="text-primary text-[8px] font-black uppercase">Live</Text>
                     </View>
                     <Text className={`text-[10px] font-black uppercase tracking-widest ${mode === 'dark' ? 'text-white/40' : 'text-black/40'}`} numberOfLines={1}>
                        {item.category || 'General'}
                     </Text>
                   </View>
                </View>
                <Feather name="chevron-right" size={20} color={mode === 'dark' ? '#333' : '#CCC'} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{paddingTop: 12, paddingBottom: 100}}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            ListHeaderComponent={() => (
              <>
                {searchMode === 'vod' && channelResults.length > 0 && (
                  <View className="mb-6">
                    <View className="px-4 mb-4 flex-row items-center justify-between">
                      <Text className={`text-base font-bold ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                        Live Channels
                      </Text>
                      <TouchableOpacity onPress={() => setSearchMode('live')} className="bg-primary/10 px-3 py-1 rounded-full">
                         <Text className="text-primary text-[10px] font-black uppercase italic">View All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-4">
                      {channelResults.slice(0, 5).map((channel, index) => (
                        <TouchableOpacity
                          key={channel.url + index}
                          onPress={() => (navigation.navigate as any)('ChannelInfo', { channel, channels: allChannels, initialIndex: 0 })}
                          className={`mr-4 p-3 rounded-2xl border ${
                            mode === 'dark' ? 'bg-[#141414] border-white/5' : 'bg-gray-100 border-gray-200'
                          }`}
                          style={{ width: 120 }}
                        >
                          <View className="aspect-video bg-black rounded-xl overflow-hidden items-center justify-center mb-2">
                             {channel.logo ? (
                               <Image source={{ uri: channel.logo }} className="w-[70%] h-[70%]" resizeMode="contain" />
                             ) : (
                               <Feather name="tv" size={24} color={primary} />
                             )}
                          </View>
                          <Text className={`text-[10px] font-bold ${mode === 'dark' ? 'text-white' : 'text-black'}`} numberOfLines={1}>
                            {channel.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View className={`mt-6 mx-4 h-px ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`} />
                  </View>
                )}
                {searchMode === 'vod' && searchResults.length > 0 && (
                  <Text className={`px-4 mb-2 text-base font-bold ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                    Movies & Series
                  </Text>
                )}
              </>
            )}
          />
        ) : searchHistory.length > 0 ? (
          <AnimatedContainer
            entering={SlideInRight.springify()}
            layout={Layout.springify()}
            className="px-4 flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className={`${
                  mode === 'dark' ? 'text-white/90' : 'text-black/90'
                } text-base font-semibold`}>
                Recent Searches
              </Text>
              <TouchableOpacity
                onPress={clearHistory}
                className="bg-red-500/10 rounded-full px-2 py-0.5">
                <Text className="text-red-500 text-xs">Clear All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={searchHistory}
              keyExtractor={historyKeyExtractor}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingBottom: 20}}
              renderItem={renderHistoryItem}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
              initialNumToRender={10}
            />
          </AnimatedContainer>
        ) : (
          // Empty State - Only show when no history and no results
          <AnimatedContainer
            layout={Layout.springify()}
            className="items-center justify-center flex-1">
            <View
              className={`${
                mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'
              } rounded-full p-8 mb-4`}>
              <Feather name="search" size={40} color={primary} />
            </View>
            <Text
              className={`${
                mode === 'dark' ? 'text-white' : 'text-black'
              } font-bold text-lg text-center`}>
              Search for your favorites
            </Text>
            <Text
              className={`${
                mode === 'dark' ? 'text-white/40' : 'text-black/40'
              } text-sm text-center mt-1`}>
              Your recent searches will appear here
            </Text>
          </AnimatedContainer>
        )}
      </AnimatedContainer>
    </SafeAreaView>
  );
};

export default Search;
