import {
  View,
  Text,
  FlatList,
  TextInput,
  ScrollView,
  Image,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import React, {useState, useMemo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {WatchListStackParamList} from '../types/navigation';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import Feather from '@expo/vector-icons/Feather';
import {StatusBar} from 'expo-status-bar';
import useContentStore, {Content} from '../lib/zustand/contentStore';
import WatchListCard from '../components/WatchListCard';
import usePlayerStore from '../lib/zustand/playerStore';
import {BlurView} from 'expo-blur';
import Animated, {FadeInDown} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {settingsStorage} from '../lib/storage';

const WatchList = () => {
  const {primary, mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const navigation =
    useNavigation<NativeStackNavigationProp<WatchListStackParamList>>();
  const {watchList, removeItem} = useWatchListStore(state => state);
  const {favorites = []} = usePlayerStore(state => state);
  const {installedProviders, setProvider} = useContentStore((state: Content) => state);
  const {width: windowWidth} = useWindowDimensions();

  // Layout Preference (1 = Grid, 0 = List)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(
    settingsStorage.getListViewType() === 1 ? 'grid' : 'list'
  );
  
  const toggleLayout = () => {
    const next = layoutMode === 'grid' ? 'list' : 'grid';
    setLayoutMode(next);
    settingsStorage.setListViewType(next === 'grid' ? 1 : 0);
  };

  const [searchText, setSearchText] = useState('');

  // Grid calculations
  const isTablet = windowWidth > 768;
  const numColumns = layoutMode === 'grid' ? (isTablet ? 5 : 3) : 1;

  // Filter the watchlist
  const filteredList = useMemo(() => {
    return watchList.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchText.toLowerCase());
      return matchesSearch;
    }).reverse();
  }, [watchList, searchText]);

  const renderItem = ({item, index}: {item: any, index: number}) => (
    <WatchListCard
      item={item}
      index={index}
      layout={layoutMode}
      onPress={() => {
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
      {/* Featured Channels Slider (Only shown if no search) */}
      {favorites.length > 0 && !searchText && (
        <View className="mb-10">
          <View className="flex-row items-center justify-between mb-5 px-1">
             <View className="flex-row items-center">
                <View style={{ backgroundColor: primary }} className="w-1.5 h-6 rounded-full mr-3 shadow-lg" />
                <Text className={`text-xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
                   Featured Channels
                </Text>
             </View>
             <TouchableOpacity 
               activeOpacity={0.7}
               onPress={() => navigation.navigate('FavoriteTV' as any)}
               className={`px-4 py-2 rounded-full border ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}
             >
               <Text className="text-primary text-[10px] font-black uppercase tracking-widest">View All</Text>
             </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
            {favorites.slice(0, 10).map((channel, index) => (
              <TouchableOpacity
                key={channel.url + index}
                activeOpacity={0.9}
                onPress={() => (navigation.navigate as any)('ChannelInfo', { channel, channels: favorites, initialIndex: index })}
                className={`mr-4 items-center rounded-[32px] border overflow-hidden ${
                  isDark ? 'bg-[#0A0A0A] border-white/10' : 'bg-gray-50 border-black/5'
                }`}
                style={{ width: isTablet ? 220 : 180, height: isTablet ? 120 : 100 }}
              >
                <View className="flex-1 w-full flex-row">
                   <View className="w-1/3 h-full p-4 items-center justify-center">
                     {channel.logo ? (
                       <Image source={{ uri: channel.logo }} className="w-full h-full" resizeMode="contain" />
                     ) : (
                       <Feather name="tv" size={24} color={primary} />
                     )}
                   </View>
                   <View className="flex-1 h-full justify-center pr-3">
                      <Text className={`text-[11px] font-black uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
                        {channel.name}
                      </Text>
                      <View className="flex-row items-center">
                        <View className="w-1 h-1 rounded-full bg-red-500 mr-2" />
                        <Text className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Live Now</Text>
                      </View>
                   </View>
                </View>
                <View className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: primary, opacity: 0.3 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main List Section Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-baseline">
           <Text className={`text-2xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
             Your Vault
           </Text>
           <Text className={`ml-3 text-[10px] font-black uppercase tracking-[2px] opacity-40 ${isDark ? 'text-white' : 'text-black'}`}>
             {filteredList.length} Tracks
           </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar translucent backgroundColor="transparent" style={isDark ? 'light' : 'dark'}/>

      {/* Premium Sticky Header */}
      <View 
        className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 flex-row items-center justify-between"
        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }}
      >
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View className="flex-row items-baseline">
          <Text className={`text-2xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
            Watchlist     
          </Text>
          <View className="w-1.5 h-1.5 rounded-full ml-2" style={{ backgroundColor: primary }} />
        </View>
        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={toggleLayout}
            className={`w-10 h-10 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-black/5'}`}
          >
            <Feather name={layoutMode === 'grid' ? "list" : "grid"} size={20} color={isDark ? 'white' : 'black'} />
          </TouchableOpacity>
          {/* <TouchableOpacity
            onPress={() => setSearchText(searchText ? '' : ' ')}
            className={`w-10 h-10 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-black/5'}`}
          >
            <Feather name="search" size={20} color={isDark ? 'white' : 'black'} />
          </TouchableOpacity> */}
        </View>
      </View>

      <FlatList
        key={`${layoutMode}-${isTablet}`} // Force full re-render when changing layout mode or orientation to avoid numColumns error
        data={filteredList}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <View style={{ height: 120 }} />
            <View className="px-6 mb-8">
               <View className={`flex-row items-center px-6 h-14 rounded-[28px] border ${isDark ? 'bg-[#1A1A1A] border-white/5 shadow-2xl' : 'bg-gray-50 border-black/5 shadow-xl'}`}>
                  <Feather name="search" size={18} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} />
                  <TextInput
                    className={`flex-1 ml-4 text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}
                    placeholder="Search your collection..."
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"}
                    value={searchText}
                    onChangeText={setSearchText}
                  />
               </View>
            </View>
            {listHeader}
          </>
        }
        keyExtractor={(item, index) => item.link + index}
        numColumns={numColumns}
        columnWrapperStyle={layoutMode === 'grid' ? { paddingHorizontal: 12, gap: 12 } : null}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.delay(200).springify()} className="items-center justify-center py-20 px-8">
            <View className={`w-28 h-28 rounded-[40px] items-center justify-center mb-8 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5 shadow-lg'}`}>
              <Feather name="layers" size={44} color={primary} />
            </View>
            <Text className={`${isDark ? 'text-white' : 'text-black'} font-black text-2xl text-center italic tracking-tighter`}>
              {searchText ? 'Found No Tracks' : 'Your Vault is Silent'}
            </Text>
            <Text className={`text-[10px] font-black text-center mt-3 uppercase tracking-[3px] opacity-40 px-10 leading-4 ${isDark ? 'text-white' : 'text-black'}`}>
              {searchText ? 'The index returned nothing. Refine your query.' : 'Commence your digital hoard. Save movies or series to see them here.'}
            </Text>
          </Animated.View>
        }
      />
    </View>
  );
};

export default WatchList;
