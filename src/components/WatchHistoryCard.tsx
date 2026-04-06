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
import Ionicons from '@expo/vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface WatchHistoryCardProps {
  item: {
    title: string;
    image: string;
    poster?: string;
    link: string;
    provider?: string;
    episodeTitle?: string;
    currentTime?: number;
    duration?: number;
  };
  index: number;
  layout: 'grid' | 'list';
  progress: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const WatchHistoryCard = ({
  item,
  index,
  layout,
  progress,
  isSelectionMode,
  isSelected,
  onPress,
  onLongPress,
}: WatchHistoryCardProps) => {
  const {mode, primary} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const {width: windowWidth} = useWindowDimensions();
  
  const isCompleted = progress >= 95;
  const isTablet = windowWidth > 768;

  // Grid calculations
  const numColumns = isTablet ? 5 : 3;
  const spacing = 12;
  const itemWidth = (windowWidth - (spacing * (numColumns + 1))) / numColumns;
  const itemHeight = itemWidth * 1.5;

  const extractEpisodeInfo = (title?: string) => {
    if (!title) return null;
    const match = title.match(/(?:S|Season\s*)(\d+)?.*(?:E|Episode\s*|EP\s*)(\d+)/i);
    if (match) {
      const s = match[1] ? `S${match[1].padStart(2, '0')}` : '';
      const e = match[2] ? `EP ${match[2].padStart(2, '0')}` : `EP ${match[0].match(/\d+/)?.[0].padStart(2, '0') || ''}`;
      return s ? `${s} ${e}` : e;
    }
    const standaloneMatch = title.match(/(?:^|\s)(\d+)(?:\s|$)/);
    if (standaloneMatch) return `EP ${standaloneMatch[1].padStart(2, '0')}`;
    return null;
  };

  const epCode = extractEpisodeInfo(item.episodeTitle);

  if (layout === 'grid') {
    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 30).springify()}
        style={{ width: itemWidth, marginBottom: spacing }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={300}
          className={`relative overflow-hidden rounded-[24px] border ${
            isSelected 
              ? 'border-primary' 
              : (isDark ? 'border-white/10 bg-[#0A0A0A]' : 'border-black/5 bg-gray-50')
          } shadow-2xl`}
          style={{ height: itemHeight }}
        >
          <Image
            source={{uri: item.poster || item.image}}
            className="w-full h-full"
            style={{resizeMode: 'cover'}}
          />

          {/* Progress Bar Overlay */}
          <View className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
            <View 
              style={{ width: `${progress}%`, backgroundColor: primary }} 
              className="h-full" 
            />
          </View>

          {/* Cinematic Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
            className="absolute inset-0 justify-end p-2"
          >
            <Text className="text-white text-[9px] font-black uppercase tracking-tight leading-tight" numberOfLines={1}>
              {item.title}
            </Text>
            {epCode && (
               <Text className="text-primary text-[7px] font-black uppercase mt-0.5">{epCode}</Text>
            )}
          </LinearGradient>

          {/* Status Badge */}
          {isCompleted ? (
            <View className="absolute top-2 right-2 bg-primary w-5 h-5 rounded-full items-center justify-center shadow-lg">
               <MaterialCommunityIcons name="check" size={12} color="white" />
            </View>
          ) : (
             <View className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10">
               <Text className="text-white text-[7px] font-black">{Math.round(progress)}%</Text>
             </View>
          )}

          {/* Selection State Overlay */}
          {isSelectionMode && (
            <View className={`absolute inset-0 items-center justify-center ${isSelected ? 'bg-primary/40' : 'bg-black/20'}`}>
              <Ionicons 
                name={isSelected ? "checkbox" : "square-outline"} 
                size={32} 
                color={isSelected ? "white" : "rgba(255,255,255,0.7)"} 
              />
            </View>
          )}
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
        onLongPress={onLongPress}
        delayLongPress={300}
        className={`flex-row p-3 rounded-3xl border ${
          isSelected 
            ? (isDark ? 'bg-primary/20 border-primary' : 'bg-primary/10 border-primary')
            : (isDark ? 'bg-[#121212] border-white/5' : 'bg-gray-50 border-gray-100')
        }`}
      >
        {/* Row Poster */}
        <View className="rounded-2xl overflow-hidden" style={{ width: 80, height: 120 }}>
          <Image
            source={{uri: item.poster || item.image}}
            className="w-full h-full"
            style={{resizeMode: 'cover'}}
          />
          {isSelectionMode && (
            <View className={`absolute inset-0 items-center justify-center ${isSelected ? 'bg-primary/40' : 'bg-black/20'}`}>
              <Ionicons 
                name={isSelected ? "checkbox" : "square-outline"} 
                size={24} 
                color={isSelected ? "white" : "rgba(255,255,255,0.7)"} 
              />
            </View>
          )}
        </View>

        {/* Row Details */}
        <View className="flex-1 ml-4 justify-between py-1">
          <View>
            <Text className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} font-black uppercase tracking-widest`}>
              {item.provider || 'Media'}
            </Text>
            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'} mt-1`} numberOfLines={1}>
              {item.title}
            </Text>
            {item.episodeTitle && (
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-0.5`} numberOfLines={1}>
                {epCode ? <Text className="text-primary font-black">{epCode} </Text> : ''}{item.episodeTitle}
              </Text>
            )}
          </View>

          <View className="mt-auto">
            <View className="flex-row items-center justify-between mb-2">
               <View className="flex-row items-center">
                 <Feather name="play-circle" size={12} color={isCompleted ? primary : (isDark ? '#666' : '#999')} />
                 <Text className={`text-[10px] font-black ml-1.5 uppercase tracking-tighter ${isCompleted ? 'text-primary' : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                    {isCompleted ? 'Finished' : `${Math.round(progress)}% Watched`}
                 </Text>
               </View>
            </View>
            <View className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-gray-200'}`}>
              <View 
                style={{ width: `${progress}%`, backgroundColor: primary }} 
                className="h-full rounded-full" 
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default WatchHistoryCard;
