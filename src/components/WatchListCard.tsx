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
  onPress: () => void;
  onRemove: () => void;
}

const WatchListCard = ({item, index, onPress, onRemove}: WatchListCardProps) => {
  const {mode, primary} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const {width: windowWidth} = useWindowDimensions();
  
  // Calculate grid dimensions (3 columns on mobile, 5 on tablet)
  const isTablet = windowWidth > 768;
  const numColumns = isTablet ? 5 : 3;
  const spacing = 12;
  const itemWidth = (windowWidth - (spacing * (numColumns + 1))) / numColumns;
  const itemHeight = itemWidth * 1.5; // 2:3 aspect ratio

  // Clean title for TMDb lookup
  const cleanTitle = item.title.replace(/\s\(\d{4}\)/, '').replace(/\s\d{4}$/, '').trim();
  const { data: tmdb, isLoading: isTmdbLoading } = useTMDBMetadata(cleanTitle, item.type || '');
  
  const rating = tmdb?.vote_average ? tmdb.vote_average.toFixed(1) : null;

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      style={{ width: itemWidth, marginBottom: spacing }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        className={`relative overflow-hidden rounded-[24px] border ${isDark ? 'border-white/10 bg-[#0A0A0A]' : 'border-black/5 bg-gray-50'} shadow-2xl`}
        style={{ height: itemHeight }}
      >
        {/* Poster Image */}
        <Image
          source={{uri: item.poster}}
          className="w-full h-full"
          style={{resizeMode: 'cover'}}
        />

        {/* Cinematic Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
          className="absolute inset-0 justify-end p-2.5"
        >
          <Text 
            className="text-white text-[10px] font-black uppercase tracking-tight leading-tight" 
            numberOfLines={2}
          >
            {cleanTitle}
          </Text>
          
          <View className="flex-row items-center mt-1">
             <Text className="text-white/40 text-[7px] font-bold uppercase tracking-widest">
                {item.provider}
             </Text>
          </View>
        </LinearGradient>

        {/* TMDb Rating Badge */}
        {rating && (
          <View className="absolute top-2 left-2 flex-row items-center bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/20">
            <MaterialCommunityIcons name="star" size={10} color="#FFD700" />
            <Text className="text-white text-[9px] font-black ml-1">
              {rating}
            </Text>
          </View>
        )}

        {/* Watched/Remove Button */}
        <TouchableOpacity
          onPress={onRemove}
          activeOpacity={0.7}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md items-center justify-center border border-white/20"
        >
          <Feather name="x" size={14} color="white" />
        </TouchableOpacity>

        {/* Bottom Aura Glow */}
        <View 
           className="absolute bottom-0 left-0 right-0 h-[2px]" 
           style={{ 
              backgroundColor: primary, 
              opacity: 0.4,
              shadowColor: primary,
              shadowRadius: 10,
              shadowOpacity: 1,
              elevation: 10
           }} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default WatchListCard;
