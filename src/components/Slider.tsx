import {Image, Pressable, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import React, {memo, useCallback} from 'react';
import type {Post} from '../lib/providers/types';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {HomeStackParamList} from '../App';
import useContentStore from '../lib/zustand/contentStore';
import {FlashList} from '@shopify/flash-list';
import SkeletonLoader from './Skeleton';
import LinearGradient from 'react-native-linear-gradient';

// import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';
import {Feather} from '@expo/vector-icons';
import {extractMetadata} from '../lib/utils';

const Slider = ({
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
  error,
}: {
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
  error?: string;
}): React.ReactElement => {
  const {provider} = useContentStore(state => state);
  const {primary, mode} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [isSelected, setSelected] = React.useState('');
  const {width: windowWidth} = useWindowDimensions();
  const isTablet = windowWidth > 768;
  const itemWidth = isTablet ? 150 : 100;
  const itemHeight = isTablet ? 225 : 150;

  const handleMorePress = useCallback(() => {
    navigation.navigate('ScrollList', {
      title: title,
      filter: filter,
      providerValue: providerValue,
      isSearch: isSearch,
    });
  }, [navigation, title, filter, providerValue, isSearch]);

  const handleItemPress = useCallback(
    (item: Post) => {
      setSelected('');
      navigation.navigate('Info', {
        link: item.link,
        provider: item.provider || providerValue || provider?.value,
        poster: item?.image,
      });
    },
    [navigation, providerValue, provider?.value],
  );

  const renderItem = useCallback(
    ({item}: {item: Post}) => (
      <View className="flex flex-col mr-4">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleItemPress(item)}
          className="relative overflow-hidden rounded-2xl shadow-xl"
          style={{ width: itemWidth, height: itemHeight, backgroundColor: '#1a1a1a' }}
        >
          <Image
            source={{
              uri: item?.image || 'https://www.br31tech.live/logo.pngtext=OrbixPlay',
            }}
            className="w-full h-full"
            style={{ resizeMode: 'cover' }}
          />
          
          {/* Metadata Overlay */}
          <View className="absolute top-2 left-2 flex-row flex-wrap">
            {(() => {
              const meta = extractMetadata(item.title);
              return [...meta.quality, ...meta.technical].slice(0, 2).map((ext, i) => (
                <View key={i} className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md mr-1 mb-1 border border-white/10">
                  <Text className="text-white text-[8px] font-bold uppercase tracking-wider">{ext}</Text>
                </View>
              ));
            })()}
          </View>

          {/* Bottom Gradient for Text */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
            className="absolute bottom-0 left-0 right-0 h-1/2 justify-end p-2"
          >
            <Text 
              className="text-white text-[10px] font-semibold leading-tight" 
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    ),
    [handleItemPress, itemWidth, itemHeight],
  );

  const keyExtractor = useCallback((item: Post) => item.link, []);

  return (
    <Pressable onPress={() => setSelected('')} className="gap-3 mt-3 px-2">
      <View className="flex flex-row items-center justify-between">
        <Text
          className={`text-xl font-bold flex-1 ${mode === 'dark' ? 'text-white' : 'text-black'}`}
          numberOfLines={1}>
          {title}
        </Text>
        {filter !== 'recent' && (
          <TouchableOpacity 
            onPress={handleMorePress}
            className="flex-row items-center space-x-1 py-1 px-3 bg-white/10 rounded-full"
          >
            <Text className={`${mode === 'dark' ? 'text-gray-300' : 'text-gray-600'} text-xs font-bold`}>
              See All
            </Text>
            <Feather name="chevron-right" size={14} color={mode === 'dark' ? '#999' : '#666'} />
          </TouchableOpacity>
        )}
      </View>
      {isLoading ? (
        <View className="flex flex-row gap-2 overflow-hidden">
          {Array.from({length: 20}).map((_, index) => (
            <View
              className="mx-3 gap-0 flex mb-3 justify-center items-center"
              key={index}>
              <SkeletonLoader height={itemHeight} width={itemWidth} />
              <SkeletonLoader height={12} width={itemWidth * 0.9} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          estimatedItemSize={100}
          showsHorizontalScrollIndicator={false}
          data={posts}
          extraData={isSelected}
          horizontal
          contentContainerStyle={{paddingHorizontal: 3, paddingTop: 7}}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          removeClippedSubviews={true}
          drawDistance={300}
          ListFooterComponent={
            !isLoading && error ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            ) : !isLoading && posts.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className={`text-center ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                  No content found
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </Pressable>
  );
};

export default memo(Slider);
