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
import LinearGradient from 'react-native-linear-gradient';

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

  // Filter the watchlist based on search text
  const filteredList = useMemo(() => {
    return watchList.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchText.toLowerCase());
      return matchesSearch;
    }).reverse();
  }, [watchList, searchText]);

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

  const listHeader = (
    <View className="px-4">
      {/* Title and Count */}
      <View className="flex-row items-baseline mb-6 mt-4">
        <Text
          className={`text-4xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
          Watchlist
        </Text>
        <View className={`ml-4 px-3 py-1 rounded-full ${isDark ? 'bg-white/5 border border-white/5' : 'bg-black/5 border border-black/5'}`}>
           <Text className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {watchList.length} Tracks
           </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View
        className={`flex-row items-center px-6 py-4 rounded-3xl mb-8 ${
          isDark ? 'bg-[#121212] border border-white/5' : 'bg-gray-50 border border-black/5'
        } shadow-2xl`}>
        <Feather name="search" size={18} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"} />
        <TextInput
          className={`flex-1 ml-4 text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}
          placeholder="Search your collection..."
          placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Featured Channels (Live TV) */}
      {favorites.length > 0 && !searchText && (
        <View className="mb-10">
          <View className="flex-row items-center justify-between mb-5 px-1">
             <View className="flex-row items-center">
                <View className="w-1.5 h-6 bg-primary rounded-full mr-3 shadow-lg" />
                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-black'}`}>
                  Featured Channels
                </Text>
             </View>
             <TouchableOpacity 
               activeOpacity={0.7}
               onPress={() => navigation.navigate('FavoriteTV' as any)}
               className={`px-4 py-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
             >
               <Text className="text-primary text-[10px] font-black uppercase tracking-widest">View All</Text>
             </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
            {favorites.map((channel, index) => (
              <TouchableOpacity
                key={channel.url + index}
                activeOpacity={0.85}
                onPress={() => (navigation.navigate as any)('ChannelInfo', { channel, channels: favorites, initialIndex: index })}
                className={`mr-4 p-4 rounded-3xl border ${
                  isDark ? 'bg-[#121212] border-white/5' : 'bg-gray-100 border-gray-200'
                } shadow-sm`}
                style={{ width: 160 }}
              >
                <View className="aspect-square bg-black/40 rounded-2xl overflow-hidden items-center justify-center mb-4 shadow-inner">
                  {channel.logo ? (
                    <Image source={{ uri: channel.logo }} className="w-full h-full" resizeMode="contain" />
                  ) : (
                    <Feather name="tv" size={28} color={primary} />
                  )}
                  <LinearGradient 
                    colors={['transparent', 'rgba(0,0,0,0.6)']} 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <View className="absolute bottom-2 left-2 flex-row items-center bg-red-600 px-1.5 py-0.5 rounded-md">
                     <View className="w-1 h-1 rounded-full bg-white mr-1" />
                     <Text className="text-[7px] font-black text-white uppercase tracking-widest">Live</Text>
                  </View>
                </View>
                <Text 
                  className={`text-sm font-black ${isDark ? 'text-white' : 'text-black'}`} 
                  numberOfLines={1}
                >
                  {channel.name}
                </Text>
                <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 opacity-60">
                  {channel.category?.split(/[;/]/)[0] || 'Premium channel'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
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

      <FlatList
        data={filteredList}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        keyExtractor={(item, index) => item.link + index}
        contentContainerStyle={{
          paddingBottom: 150,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-4">
            <View
              className={`${
                isDark ? 'bg-white/5' : 'bg-gray-100'
              } rounded-full p-10 mb-8 border border-white/5 shadow-2xl`}>
              <Feather name="layers" size={50} color={primary} />
            </View>
            <Text
              className={`${
                isDark ? 'text-white' : 'text-black'
              } font-black text-2xl text-center italic tracking-tight`}>
              {searchText ? 'Nothing found' : 'Empty Vault'}
            </Text>
            <Text
              className={`${
                isDark ? 'text-gray-500' : 'text-gray-400'
              } text-xs font-bold text-center mt-3 uppercase tracking-widest px-10`}>
              {searchText ? 'Try a different search query' : 'Your saved movies and shows will appear here'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default WatchList;
