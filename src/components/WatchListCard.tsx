import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTMDBMetadata } from '../lib/hooks/useContentInfo';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface WatchListCardProps {
  item: {
    title: string;
    poster: string;
    link: string;
    provider: string;
    genres?: string[];
    year?: string;
    runtime?: number;
    type?: string;
  };
  index: number;
  layout: 'grid' | 'list';
  onPress: () => void;
  onRemove: () => void;
}

const WatchListCard = ({item, index, layout, onPress, onRemove}: WatchListCardProps) => {
  const {mode, primary} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const {width: windowWidth} = useWindowDimensions();
  
  // Grid calculations
  const isTablet = windowWidth > 768;
  const numColumns = isTablet ? 5 : 3;
  const spacing = 12;
  const itemWidth = (windowWidth - (spacing * (numColumns + 1))) / numColumns;
  const itemHeight = itemWidth * 1.5;

  const cleanTitle = item.title.replace(/\s\(\d{4}\)/, '').replace(/\s\d{4}$/, '').trim();
  const { data: tmdb, isLoading: isTmdbLoading } = useTMDBMetadata(cleanTitle, item.type || '');
  
  const rating = tmdb?.vote_average ? tmdb.vote_average.toFixed(1) : null;
  const year = item.year || (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0];

  if (layout === 'grid') {
    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 30).springify()}
        style={{ width: itemWidth, marginBottom: spacing }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          className={`relative overflow-hidden rounded-[24px] border ${isDark ? 'border-white/10 bg-[#0A0A0A]' : 'border-black/5 bg-gray-50'} shadow-2xl`}
          style={{ height: itemHeight }}
        >
          <Image
            source={{uri: item.poster}}
            className="w-full h-full"
            style={{resizeMode: 'cover'}}
          />

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
            className="absolute inset-0 justify-end p-2.5"
          >
            <Text 
              className="text-white text-[9px] font-black uppercase tracking-tight leading-tight" 
              numberOfLines={2}
            >
              {cleanTitle}
            </Text>
            <Text className="text-white/40 text-[7px] font-bold uppercase tracking-widest mt-0.5">
               {item.provider}
            </Text>
          </LinearGradient>

          {rating && (
            <View className="absolute top-2 left-2 flex-row items-center bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/20">
              <MaterialCommunityIcons name="star" size={10} color="#FFD700" />
              <Text className="text-white text-[9px] font-black ml-1">
                {rating}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={onRemove}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md items-center justify-center border border-white/20"
          >
            <Feather name="x" size={14} color="white" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Row / List Layout
  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 30).springify()}
      className="mb-4 w-full"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        className={`flex-row p-3 rounded-3xl border ${isDark ? 'bg-[#121212] border-white/5' : 'bg-gray-50 border-gray-100'}`}
      >
        <View className="rounded-2xl overflow-hidden" style={{ width: 80, height: 120 }}>
          <Image
            source={{uri: item.poster}}
            className="w-full h-full"
            style={{resizeMode: 'cover'}}
          />
        </View>

        <View className="flex-1 ml-4 justify-between py-1">
          <View>
            <Text className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} font-black uppercase tracking-widest`}>
              {item.provider} • {year || 'N/A'}
            </Text>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'} mt-1`} numberOfLines={1}>
              {cleanTitle}
            </Text>
            <View className="flex-row flex-wrap mt-2">
               {item.genres?.slice(0, 2).map((g, i) => (
                  <View key={i} className="bg-primary/10 px-2 py-0.5 rounded mr-2 mb-1">
                     <Text className="text-primary text-[8px] font-black uppercase tracking-widest">{g}</Text>
                  </View>
               ))}
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-auto">
             {rating && (
                <View className="flex-row items-center bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                   <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
                   <Text className={`text-xs font-black ${isDark ? 'text-yellow-500' : 'text-yellow-600'} ml-1`}>
                      {rating}
                   </Text>
                </View>
             )}
             <TouchableOpacity
               onPress={onRemove}
               className={`flex-row items-center px-4 py-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
               <Feather name="check-square" size={14} color={isDark ? '#999' : '#666'} />
               <Text className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-600'} ml-2`}>
                 Watched
               </Text>
             </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default WatchListCard;
