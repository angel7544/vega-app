import {View, Text, TouchableOpacity, useWindowDimensions, StyleSheet} from 'react-native';
import React, {useEffect, useState, useRef} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../types/navigation';
import {Post} from '../lib/providers/types';
import {Image} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import useContentStore from '../lib/zustand/contentStore';
import {MaterialIcons, Feather} from '@expo/vector-icons';
import {settingsStorage} from '../lib/storage';
import {FlashList} from '@shopify/flash-list';
import SkeletonLoader from '../components/Skeleton';
import useThemeStore from '../lib/zustand/themeStore';
import {providerManager} from '../lib/services/ProviderManager';
import {useShowNavBarOnScroll} from '../lib/hooks/useShowNavBarOnScroll';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {BlurView} from 'expo-blur';
import {StatusBar} from 'expo-status-bar';

type Props = NativeStackScreenProps<HomeStackParamList, 'ScrollList'>;

const ScrollList = ({route}: Props): React.ReactElement => {
  const {primary, mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const {handleScroll} = useShowNavBarOnScroll();
  const {width: windowWidth} = useWindowDimensions();
  
  // Dynamic Grid Configuration
  const isLarge = windowWidth > 1024;
  const isTablet = windowWidth > 768;
  const numColumns = route.params.isSearch ? (isLarge ? 6 : isTablet ? 5 : 3) : (isLarge ? 7 : isTablet ? 5 : 3);
  const itemPadding = 6;
  const availableWidth = windowWidth - 24; 
  const itemWidth = (availableWidth / numColumns) - (itemPadding * 2);
  const itemHeight = itemWidth * 1.5;

  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  const {filter, providerValue} = route.params;
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEnd, setIsEnd] = useState<boolean>(false);
  const {provider} = useContentStore(state => state);
  const [viewType, setViewType] = useState<number>(
    settingsStorage.getListViewType(),
  );
  const abortController = useRef<AbortController | null>(null);
  const isMounted = useRef(true);
  const isLoadingMore = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();
    const signal = abortController.current.signal;

    const fetchPosts = async () => {
      if (isEnd) return;

      try {
        if (isLoadingMore.current) return;
        isLoadingMore.current = true;
        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 300));
        if (!isMounted.current || signal.aborted) return;

        const getNewPosts = route.params.isSearch
          ? providerManager.getSearchPosts({
              searchQuery: filter,
              page,
              providerValue: providerValue || provider.value,
              signal,
            })
          : providerManager.getPosts({
              filter,
              page,
              providerValue: providerValue || provider.value,
              signal,
            });

        const newPosts = await getNewPosts;
        if (!isMounted.current || signal.aborted) return;

        if (!newPosts || newPosts.length === 0) {
          setIsEnd(true);
          setIsLoading(false);
          isLoadingMore.current = false;
          return;
        }

        setPosts(prev => [...prev, ...newPosts]);
      } catch (error) {
        if (!isMounted.current || (error as any)?.name === 'AbortError') return;
        console.error('Error fetching posts:', error);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          isLoadingMore.current = false;
        }
      }
    };

    fetchPosts();
  }, [page, route.params, filter, provider.value]);

  const onEndReached = async () => {
    if (isLoading || isEnd || isLoadingMore.current) {
      return;
    }
    setPage(prevPage => prevPage + 1);
  };

  const renderSkeletons = () => {
    const skeletonCount = numColumns * 2;
    return Array.from({length: skeletonCount}).map((_, i) => (
      <View
        className="m-1 justify-center items-center"
        key={i}>
        <SkeletonLoader height={itemHeight} width={itemWidth} />
      </View>
    ));
  };

  return (
    <View className={`flex-1 w-full ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar translucent backgroundColor="transparent" style={isDark ? 'light' : 'dark'}/>
      
      {/* Sticky Premium Header */}
      <View 
        className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 flex-row items-center justify-between"
        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }}
      >
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View className="flex-row items-center flex-1 pr-4">
            <View style={{ backgroundColor: primary }} className="w-1.5 h-6 rounded-full mr-3 shadow-lg" />
            <Text
              numberOfLines={1}
              className={`text-xl font-black italic tracking-tighter uppercase ${isDark ? 'text-white' : 'text-black'}`}>
              {route.params.title}
            </Text>
        </View>
        <TouchableOpacity
          className={`${isDark ? 'bg-white/10' : 'bg-black/5'} p-2 rounded-full`}
          onPress={() => {
            const newViewType = viewType === 1 ? 2 : 1;
            setViewType(newViewType);
            settingsStorage.setListViewType(newViewType);
          }}>
          <MaterialIcons
            name={viewType === 1 ? 'view-list' : 'view-module'}
            size={22}
            color={isDark ? 'white' : 'black'}
          />
        </TouchableOpacity>
      </View>

      <FlashList
        estimatedItemSize={250}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<View className="h-32" />}
        ListFooterComponent={
          <>
            {isLoading && (
              <View
                className={`flex ${
                  viewType === 1 ? 'flex-row flex-wrap' : 'flex-col'
                } justify-center items-center mt-4 mb-20 px-2`}>
                {renderSkeletons()}
              </View>
            )}
            <View className="h-32" />
          </>
        }
        data={posts}
        numColumns={viewType === 1 ? numColumns : 1}
        key={`view-type-${viewType}-cols-${numColumns}`}
        contentContainerStyle={{paddingBottom: 100, paddingHorizontal: 6}}
        keyExtractor={(item, i) => `${item.title}-${i}`}
        renderItem={({item, index}) => (
          <Animated.View 
             entering={FadeInDown.delay(Math.min(index % (numColumns * 2), 10) * 50).springify()}
             className={viewType === 1 ? 'p-1.5' : 'px-3 py-2'}
          >
            <TouchableOpacity
                activeOpacity={0.9}
                className={
                  viewType === 1
                    ? 'relative overflow-hidden rounded-[24px]'
                    : 'flex-row items-center p-3 rounded-[28px] border bg-[#0F0F0F05] border-black/5'
                }
                style={viewType === 1 ? { width: itemWidth, height: itemHeight } : {}}
                onPress={() =>
                  navigation.navigate('Info', {
                    link: item.link,
                    provider: route.params.providerValue || provider.value,
                    poster: item?.image,
                  })
                }>
                
                {/* Poster Image */}
                <View 
                  className={`overflow-hidden border ${isDark ? 'border-white/10 bg-[#0F0F0F]' : 'border-black/5 bg-gray-100'} shadow-2xl ${viewType === 1 ? 'rounded-[24px] w-full h-full' : 'rounded-2xl w-[70px] h-[100px]'}`}
                >
                  <Image
                    className="w-full h-full"
                    source={{
                      uri: item.image || 'https://br31tech.live/logo.png',
                    }}
                    style={{ resizeMode: 'cover' }}
                  />
                  
                  {/* Cinematic Overlay (Only in Grid) */}
                  {viewType === 1 && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
                      className="absolute inset-0 justify-end p-2.5"
                    >
                      <Text 
                        className="text-white text-[9px] font-black uppercase tracking-tight leading-tight" 
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <View className="w-1.5 h-[2px] rounded-full mr-1.5" style={{ backgroundColor: primary }} />
                        <Text className="text-white/40 text-[7px] font-bold uppercase tracking-widest">
                           Explore
                        </Text>
                      </View>
                    </LinearGradient>
                  )}
                </View>

                {/* List Title (Only in List Mode) */}
                {viewType === 2 && (
                   <View className="flex-1 ml-5">
                      <Text className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} font-black uppercase tracking-widest`}>
                        {route.params.title}
                      </Text>
                      <Text
                        className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'} mt-1`}
                        numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View className="flex-row items-center mt-3">
                         <View className="bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                            <Text className="text-primary text-[8px] font-black uppercase tracking-widest italic">View Details</Text>
                         </View>
                      </View>
                   </View>
                )}
            </TouchableOpacity>
          </Animated.View>
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      {!isLoading && posts.length === 0 ? (
        <View className="w-full h-full flex items-center justify-center -mt-20">
          <View className={`w-28 h-28 rounded-[40px] items-center justify-center mb-8 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5 shadow-lg'}`}>
            <Feather name="search" size={44} color={primary} />
          </View>
          <Text className={`${isDark ? 'text-white' : 'text-black'} font-black text-2xl text-center italic tracking-tighter`}>
            No Results Found
          </Text>
          <Text className={`text-[10px] font-black text-center mt-3 uppercase tracking-[3px] opacity-40 px-10 leading-4 ${isDark ? 'text-white' : 'text-black'}`}>
            The provider returned no content. Try a different query or explore other catalogs.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default ScrollList;
