import { TMDBMovie, TMDBMovieDetail, TMDBResponse, TMDBTVShow, TMDBTVDetail } from '../../types/tmdb';
import { settingsStorage } from '../storage';

const BASE_URL = 'https://api.themoviedb.org/3';

const getHeaders = (): Record<string, string> => {
  const token = settingsStorage.getTmdbReadToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json;charset=utf-8',
    };
  }
  return {};
};

const getApiKey = () => settingsStorage.getTmdbApiKey();

export const searchTMDB = async (query: string, type: 'movie' | 'tv' | 'multi' = 'movie'): Promise<TMDBMovie[] | TMDBTVShow[]> => {
  if (!query) return [];
  const apiKey = getApiKey();
  const headers = getHeaders();
  
  try {
    const response = await fetch(
      `${BASE_URL}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}`,
      { headers }
    );
    const data: TMDBResponse<any> = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`TMDB search ${type} error:`, error);
    return [];
  }
};

export const getTMDBDetails = async (id: number, type: 'movie' | 'tv' = 'movie'): Promise<TMDBMovieDetail | TMDBTVDetail | null> => {
  const apiKey = getApiKey();
  const headers = getHeaders();

  try {
    const response = await fetch(
      `${BASE_URL}/${type}/${id}?api_key=${apiKey}`,
      { headers }
    );
    return await response.json();
  } catch (error) {
    console.error(`TMDB get ${type} details error:`, error);
    return null;
  }
};

export const getTMDBTrending = async (type: 'movie' | 'tv' = 'movie', timeWindow: 'day' | 'week' = 'day'): Promise<any[]> => {
  const apiKey = getApiKey();
  const headers = getHeaders();

  try {
    const response = await fetch(
      `${BASE_URL}/trending/${type}/${timeWindow}?api_key=${apiKey}`,
      { headers }
    );
    const data: TMDBResponse<any> = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`TMDB get trending ${type} error:`, error);
    return [];
  }
};

export const getTMDBImage = (path: string, size: 'w500' | 'original' = 'w500') => {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};
