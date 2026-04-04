import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import GenrePill from './GenrePill';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTMDBMetadata } from '../lib/hooks/useContentInfo';

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
  onPress: () => void;
  onRemove: () => void;
}

const WatchListCard = ({item, onPress, onRemove}: WatchListCardProps) => {
  const {mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const {primary} = useThemeStore(state => state);

  // Try to extract year from title if present (e.g. "Movie (2024)")
  const yearMatch = item.title.match(/\((\d{4})\)/) || item.title.match(/\s(\d{4})$/);
  const cleanTitle = item.title.replace(/\s\(\d{4}\)/, '').replace(/\s\d{4}$/, '').trim();
  const year = yearMatch ? yearMatch[1] : '';

  const { data: tmdb, isLoading: isTmdbLoading } = useTMDBMetadata(cleanTitle, item.type || '');
  
  // Use stored metadata if available, otherwise fallback to TMDb hook data
  const genres = item.genres || tmdb?.genres?.map((g: any) => g.name);
  const displayYear = item.year || year || (tmdb as any)?.release_date?.split('-')[0] || (tmdb as any)?.first_air_date?.split('-')[0] || 'N/A';
  const runtime = item.runtime || (tmdb as any)?.runtime || (tmdb as any)?.episode_run_time?.[0];
  const seasons = (tmdb as any)?.number_of_seasons;
  const episodes = (tmdb as any)?.number_of_episodes;
  
  const isLoading = !item.genres && isTmdbLoading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className={`flex-row p-3 mb-4 rounded-3xl ${
        isDark ? 'bg-[#121212]' : 'bg-gray-50'
      } border ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      
      {/* Poster */}
      <View
        className="rounded-2xl overflow-hidden shadow-xl"
        style={{width: 100, height: 150, backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0'}}>
        <Image
          source={{uri: item.poster}}
          className="w-full h-full"
          style={{resizeMode: 'cover'}}
        />
      </View>

      {/* Details */}
      <View className="flex-1 ml-4 justify-between py-1">
        <View>
          <Text className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} font-black uppercase tracking-widest`}>
            {displayYear}
          </Text>
          <Text
            className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'} mt-1`}
            numberOfLines={1}>
            {cleanTitle}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {item.provider}
          </Text>

          {/* Timing / Length info */}
          <View className="flex-row items-center mt-2 space-x-3">
             {runtime ? (
               <View className="flex-row items-center">
                 <Feather name="clock" size={10} color={isDark ? '#666' : '#999'} />
                 <Text className={`text-[10px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'} ml-1`}>
                    {runtime} min
                 </Text>
               </View>
             ) : seasons ? (
               <View className="flex-row items-center">
                 <MaterialCommunityIcons name="television-classic" size={10} color={isDark ? '#666' : '#999'} />
                 <Text className={`text-[10px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'} ml-1`}>
                    {seasons} Season{seasons > 1 ? 's' : ''}
                 </Text>
               </View>
             ) : null}
             
             {episodes && (
               <View className="flex-row items-center">
                 <Feather name="list" size={10} color={isDark ? '#666' : '#999'} />
                 <Text className={`text-[10px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'} ml-1`}>
                    {episodes} Ep
                 </Text>
               </View>
             )}
          </View>

          {/* Genres (Stored or TMDb) */}
          <View className="flex-row flex-wrap mt-2">
            {genres ? (
              genres.slice(0, 2).map((g: any, i: number) => (
                <GenrePill key={i} label={g} />
              ))
            ) : isLoading ? (
              <View className="h-4 w-20 bg-white/5 rounded-full animate-pulse" />
            ) : (
              <GenrePill label="Media" />
            )}
          </View>
        </View>

        {/* Bottom Row */}
        <View className="flex-row items-center justify-between mt-auto">
          {(tmdb?.vote_average || isLoading) && (
            <View className="flex-row items-center bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
              <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
              <Text className={`text-xs font-black ${isDark ? 'text-yellow-500' : 'text-yellow-600'} ml-1`}>
                {isLoading ? '...' : (tmdb?.vote_average ? tmdb.vote_average.toFixed(1) : 'N/A')}
              </Text>
              {tmdb?.vote_count && (
                 <Text className="text-yellow-500/40 text-[8px] font-bold ml-1">({tmdb.vote_count})</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={onRemove}
            className="flex-row items-center space-x-2 bg-white/5 px-3 py-2 rounded-xl">
            <Feather name="check-square" size={16} color={isDark ? '#999' : '#666'} />
            <Text className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'} ml-1`}>
              Watched
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default WatchListCard;
