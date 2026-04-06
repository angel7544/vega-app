import {View, Text, TouchableOpacity, useWindowDimensions} from 'react-native';
import React, {useEffect, useState, useRef} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {HomeStackParamList, SearchStackParamList} from '../types/navigation';
import {Post} from '../lib/providers/types';
import {Image} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import useContentStore from '../lib/zustand/contentStore';
import {MaterialIcons} from '@expo/vector-icons';
import {settingsStorage} from '../lib/storage';
import {FlashList} from '@shopify/flash-list';
import SkeletonLoader from '../components/Skeleton';
import useThemeStore from '../lib/zustand/themeStore';
import {providerManager} from '../lib/services/ProviderManager';
import {useShowNavBarOnScroll} from '../lib/hooks/useShowNavBarOnScroll';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Props = NativeStackScreenProps<HomeStackParamList, 'ScrollList'>;

const ScrollList = ({route}: Props): React.ReactElement => {
  const {primary, mode} = useThemeStore(state => state);
  const {handleScroll} = useShowNavBarOnScroll();
  const {width: windowWidth} = useWindowDimensions();
  
  // Dynamic Grid Configuration
  const isLarge = windowWidth > 1024;
  const isTablet = windowWidth > 768;
  const numColumns = route.params.isSearch ? (isLarge ? 5 : isTablet ? 4 : 3) : (isLarge ? 7 : isTablet ? 5 : 3);
  const itemPadding = 12;
  const availableWidth = windowWidth - 32; // Screen padding
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
    setIsLoading(true);
    setPage(prevPage => prevPage + 1);
  };

  const renderSkeletons = () => {
    const skeletonCount = numColumns * 2;
    return Array.from({length: skeletonCount}).map((_, i) => (
      <View
        className="mx-2 mb-4 justify-center items-center"
        key={i}>
        <SkeletonLoader height={itemHeight} width={itemWidth} />
      </View>
    ));
  };

  return (
    <View className={`flex-1 w-full ${mode === 'dark' ? 'bg-black' : 'bg-white'} p-4`}>
      <View className="w-full px-2 font-semibold my-8 flex-row justify-between items-center">
        <View className="flex-row items-center">
            <View style={{ backgroundColor: primary }} className="w-1.5 h-7 rounded-full mr-4" />
            <Text
              className={`text-2xl font-black uppercase tracking-tight ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
              {route.params.title}
            </Text>
        </View>
        <TouchableOpacity
          className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-2.5 rounded-2xl`}
          onPress={() => {
            const newViewType = viewType === 1 ? 2 : 1;
            setViewType(newViewType);
            settingsStorage.setListViewType(newViewType);
          }}>
          <MaterialIcons
            name={viewType === 1 ? 'view-module' : 'view-list'}
            size={24}
            color={mode === 'dark' ? 'white' : 'black'}
          />
        </TouchableOpacity>
      </View>
      
      <FlashList
        estimatedItemSize={250}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            {isLoading && (
              <View
                className={`flex ${
                  viewType === 1 ? 'flex-row flex-wrap' : 'flex-col'
                } justify-center items-center mt-4 mb-20`}>
                {renderSkeletons()}
              </View>
            )}
            <View className="h-32" />
          </>
        }
        data={posts}
        numColumns={viewType === 1 ? numColumns : 1}
        key={`view-type-${viewType}-cols-${numColumns}`}
        contentContainerStyle={{paddingBottom: 100, paddingHorizontal: 8}}
        keyExtractor={(item, i) => `${item.title}-${i}`}
        renderItem={({item, index}) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 20) * 50).springify()}>
            <TouchableOpacity
                activeOpacity={0.9}
                className={
                  viewType === 1
                    ? 'flex flex-col m-2 overflow-hidden'
                    : 'flex-row m-2 items-center p-3 rounded-2xl bg-white/5 border border-white/5'
                }
                onPress={() =>
                  navigation.navigate('Info', {
                    link: item.link,
                    provider: route.params.providerValue || provider.value,
                    poster: item?.image,
                  })
                }>
                <View 
                  className={`rounded-[20px] overflow-hidden border ${mode === 'dark' ? 'border-white/10 bg-[#0F0F0F]' : 'border-black/5 bg-gray-100'} shadow-2xl`}
                  style={
                    viewType === 1
                      ? {width: itemWidth, height: itemHeight}
                      : {width: 70, height: 100}
                  }
                >
                  <Image
                    className="w-full h-full"
                    source={{
                      uri: item.image || 'https://br31tech.live/logo.png',
                    }}
                    style={{ resizeMode: 'cover' }}
                  />
                </View>
                <Text
                  className={
                    viewType === 1
                      ? `${mode === 'dark' ? 'text-white' : 'text-black'} text-center mt-2 font-black uppercase text-[10px] tracking-tighter w-full`
                      : `${mode === 'dark' ? 'text-white' : 'text-black'} ml-4 flex-1 font-black uppercase text-sm tracking-wide`
                  }
                  numberOfLines={2}>
                  {item.title}
                </Text>
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
          <MaterialIcons name="cloud-off" size={64} color={mode === 'dark' ? 'white' : 'black'} style={{ opacity: 0.1 }} />
          <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-center font-black uppercase tracking-widest mt-4`}>
            No Results Found
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default ScrollList;
