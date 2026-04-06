import {Image, Pressable, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import React, {memo, useCallback} from 'react';
import type {Post} from '../lib/providers/types';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {HomeStackParamList} from '../types/navigation';
import useContentStore from '../lib/zustand/contentStore';
import {FlashList} from '@shopify/flash-list';
import SkeletonLoader from './Skeleton';
import LinearGradient from 'react-native-linear-gradient';
import useThemeStore from '../lib/zustand/themeStore';
import {Feather} from '@expo/vector-icons';
import {extractMetadata} from '../lib/utils';
import Animated, { FadeInRight, Layout } from 'react-native-reanimated';

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
  
  // More granular responsiveness
  const isLarge = windowWidth > 1024;
  const isTablet = windowWidth > 768;
  const itemWidth = isLarge ? 180 : isTablet ? 140 : 110;
  const itemHeight = isLarge ? 270 : isTablet ? 210 : 165; // Consistent 2:3 aspect ratio

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
    ({item, index}: {item: Post, index: number}) => (
      <Animated.View 
         entering={FadeInRight.delay(index * 50).springify()}
         className="flex flex-col mr-4"
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleItemPress(item)}
          className={`relative overflow-hidden rounded-[20px] border ${mode === 'dark' ? 'border-white/10 bg-[#0F0F0F]' : 'border-black/5 bg-gray-100'} shadow-2xl`}
          style={{ width: itemWidth, height: itemHeight }}
        >
          <Image
            source={{
              uri: item?.image || 'https://www.br31tech.live/logo.png',
            }}
            className="w-full h-full"
            style={{ resizeMode: 'cover' }}
          />
          
          {/* Metadata Overlay */}
          <View className="absolute top-2 left-2 flex-row flex-wrap">
            {(() => {
              const meta = extractMetadata(item.title);
              return [...meta.quality, ...meta.technical].slice(0, 2).map((ext, i) => (
                <View key={i} className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md mr-1 mb-1 border border-white/20">
                  <Text className="text-white text-[8px] font-black uppercase tracking-[1px]">{ext}</Text>
                </View>
              ));
            })()}
          </View>

          {/* Cinematic Gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
            className="absolute bottom-0 left-0 right-0 h-[40%] justify-end p-2.5"
          >
            <Text 
              className="text-white text-[10px] font-black uppercase tracking-tight leading-tight" 
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    ),
    [handleItemPress, itemWidth, itemHeight, mode],
  );

  const keyExtractor = useCallback((item: Post) => item.link, []);

  return (
    <View className="gap-4 mt-6 px-4">
      <View className="flex flex-row items-center justify-between px-1">
        <View className="flex-row items-center">
            <View style={{ backgroundColor: primary }} className="w-1 h-5 rounded-full mr-3" />
            <Text
              className={`text-xl font-black tracking-tight ${mode === 'dark' ? 'text-white' : 'text-black'}`}
              numberOfLines={1}>
              {title}
            </Text>
        </View>
        {filter !== 'recent' && (
          <TouchableOpacity 
            onPress={handleMorePress}
            className="flex-row items-center space-x-1.5 py-1.5 px-4 bg-primary/10 rounded-full border border-primary/20"
          >
            <Text className="text-primary text-[10px] font-black uppercase tracking-widest italic">
              Explore
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {isLoading ? (
        <View className="flex flex-row gap-3 overflow-hidden ml-1">
          {Array.from({length: 10}).map((_, index) => (
            <View
              className="mr-3"
              key={index}>
              <SkeletonLoader height={itemHeight} width={itemWidth} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          estimatedItemSize={itemWidth}
          showsHorizontalScrollIndicator={false}
          data={posts}
          extraData={isSelected}
          horizontal
          contentContainerStyle={{paddingLeft: 4, paddingRight: 30, paddingBottom: 10}}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          removeClippedSubviews={true}
          drawDistance={400}
          ListFooterComponent={
            !isLoading && error ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-red-500 text-center font-bold">{error}</Text>
              </View>
            ) : !isLoading && posts.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className={`text-center font-bold ${mode === 'dark' ? 'text-white/40' : 'text-black/40'}`}>
                  Queue Empty
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

export default memo(Slider);
