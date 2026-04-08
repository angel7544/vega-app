import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import axios from 'axios';
import { searchTMDB, getTMDBDetails, getTMDBSeasonDetails } from '../services/tmdb';

// Hook for fetching content info/metadata
export const useContentInfo = (link: string, providerValue: string) => {
  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      console.log('Fetching content info for:', link);

      const data = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });
      if (!data || (!data?.title && !data?.synopsis && !data?.image)) {
        throw new Error('Error: No data returned from provider');
      }

      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => {
      const cached = cacheStorage.getString(link);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: any) => {
        if (data) {
          cacheStorage.setString(link, JSON.stringify(data));
        }
      },
    },
  });
};

// Hook for fetching enhanced metadata from Stremio
export const useEnhancedMetadata = (imdbId: string, type: string) => {
  return useQuery({
    queryKey: ['enhancedMeta', imdbId, type],
    queryFn: async () => {
      console.log('Fetching enhanced metadata for:', imdbId);
      try {
        // Validate imdbId and type
        if (!imdbId || !type) {
          throw new Error('Invalid imdbId or type');
        }
      } catch (error) {
        console.log('Error validating imdbId or type:', error);
        return {};
      }
      const response = await axios.get(
        `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`,
        {timeout: 10000},
      );

      return response.data?.meta;
    },
    enabled: !!imdbId && !!type,
    staleTime: 30 * 60 * 1000, // 30 minutes - metadata changes rarely
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Don't retry too much for external API
    // Use cached data as initial data
    initialData: () => {
      const cached = cacheStorage.getString(imdbId);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: any) => {
        if (data && imdbId) {
          cacheStorage.setString(imdbId, JSON.stringify(data));
        }
      },
    },
  });
};

// Hook for fetching TMDb Season details
export const useTMDBSeasonDetails = (seriesId: number, seasonNumber: number) => {
  return useQuery({
    queryKey: ['tmdbSeason', seriesId, seasonNumber],
    queryFn: async () => {
      if (!seriesId) return null;
      console.log('Fetching TMDB season metadata for series:', seriesId, 'season:', seasonNumber);
      try {
        const details = await getTMDBSeasonDetails(seriesId, seasonNumber);
        return details;
      } catch (error) {
        console.error('Error fetching TMDB season metadata:', error);
      }
      return null;
    },
    enabled: !!seriesId,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
};

// Hook for fetching TMDb metadata
export const useTMDBMetadata = (title: string, type: string) => {
  return useQuery({
    queryKey: ['tmdbMeta', title, type],
    queryFn: async () => {
      if (!title) return null;
      console.log('Fetching TMDB metadata for:', title);
      try {
        const tmdbType = type === 'series' || type === 'tv' ? 'tv' : type === 'movie' ? 'movie' : 'multi';
        const searchResults = await searchTMDB(title.split('(')[0].trim(), tmdbType);
        if (searchResults && searchResults.length > 0) {
          const result = searchResults[0] as any;
          const finalType = tmdbType === 'multi' ? result.media_type : tmdbType;
          if (finalType === 'movie' || finalType === 'tv') {
            const details = await getTMDBDetails(result.id, finalType);
            return details;
          }
        }
      } catch (error) {
        console.error('Error fetching TMDB metadata:', error);
      }
      return null;
    },
    enabled: !!title,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
};

// Combined hook for both info and metadata
export const useContentDetails = (link: string, providerValue: string) => {
  // First, get the basic content info
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
    refetch: refetchInfo,
  } = useContentInfo(link, providerValue);

  // Then, get enhanced metadata if imdbId is available
  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useEnhancedMetadata(info?.imdbId || '', info?.type || '');

  // Third, get TMDb metadata
  const {
    data: tmdb,
    isLoading: tmdbLoading,
    refetch: refetchTmdb,
  } = useTMDBMetadata(info?.title || meta?.name || '', info?.type || meta?.type || '');

  return {
    info,
    meta,
    tmdb,
    isLoading: infoLoading || metaLoading || tmdbLoading,
    error: infoError || metaError,
    refetch: async () => {
      await Promise.all([refetchInfo(), refetchMeta(), refetchTmdb()]);
    },
  };
};
