import {useQuery} from '@tanstack/react-query';
import {getHomePageData, HomePageData} from '../getHomepagedata';
import {Content} from '../zustand/contentStore';
import {cacheStorage} from '../storage';

interface UseHomePageDataOptions {
  provider: Content['provider'];
  enabled?: boolean;
}

export const useHomePageData = ({
  provider,
  enabled = true,
}: UseHomePageDataOptions) => {
  return useQuery<HomePageData[], Error>({
    queryKey: ['homePageData', provider.value],
    queryFn: async ({signal}) => {
      // Fetch fresh data - cache is handled by React Query
      const data = await getHomePageData(provider, signal);
      
      // Manually cache successful responses
      if (data && data.length > 0) {
        cacheStorage.setString(
          'homeData' + provider.value,
          JSON.stringify(data),
        );
      }
      return data;
    },
    enabled: enabled && !!provider?.value,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Store hero selection per provider to prevent re-randomization on tab switch
const heroSelectionCache = new Map<
  string,
  {postIndex: number; categoryIndex: number}
>();

// Memoized hero selection with stable reference - uses cached index to prevent re-randomization
export const getRandomHeroPost = (
  homeData: HomePageData[],
  providerValue?: string,
) => {
  if (!homeData || homeData.length === 0) {
    return null;
  }

  const lastCategory = homeData[homeData.length - 1];
  if (!lastCategory.Posts || lastCategory.Posts.length === 0) {
    return null;
  }

  const cacheKey = providerValue || 'default';
  const cached = heroSelectionCache.get(cacheKey);

  // If we have a cached index and it's still valid for this data, use it
  if (cached && cached.postIndex < lastCategory.Posts.length) {
    return lastCategory.Posts[cached.postIndex];
  }

  // Otherwise, generate a new random index and cache it
  const randomIndex = Math.floor(Math.random() * lastCategory.Posts.length);
  heroSelectionCache.set(cacheKey, {
    postIndex: randomIndex,
    categoryIndex: homeData.length - 1,
  });

  return lastCategory.Posts[randomIndex];
};

// Function to clear hero cache when explicitly refreshing
export const clearHeroCache = (providerValue?: string) => {
  if (providerValue) {
    heroSelectionCache.delete(providerValue);
  } else {
    heroSelectionCache.clear();
  }
};

/**
 * Gets a randomized list of posts for the hero carousel.
 * Collects posts from categories with significant content, filters for valid images,
 * and shuffles them to ensure a fresh experience on every refresh.
 */
export const getHeroPosts = (
  homeData: HomePageData[],
  limit: number = 4
) => {
  if (!homeData || homeData.length === 0) {
    return [];
  }

  // Collect all posts from categories that have significant content
  let pool: any[] = [];
  
  // We prefer categories with at least 10 items (usually Featured/Trending)
  homeData.forEach(category => {
    if (category.Posts && category.Posts.length >= 10) {
      pool = [...pool, ...category.Posts];
    }
  });

  // Fallback: if no category is large enough, pool everything
  if (pool.length === 0) {
    homeData.forEach(category => {
      if (category.Posts) {
        pool = [...pool, ...category.Posts];
      }
    });
  }

  // Deduplicate by link and filter for items that actually have content (title + image)
  const uniqueMap = new Map();
  pool.forEach(post => {
    if (post.link && post.title && post.image) {
      if (!uniqueMap.has(post.link)) {
        uniqueMap.set(post.link, post);
      }
    }
  });

  const validPosts = Array.from(uniqueMap.values());

  if (validPosts.length === 0) {
    // If we filtered out everything, fall back to whatever is available
    return (homeData[0]?.Posts || []).slice(0, limit);
  }

  // Fisher-Yates Shuffle
  const shuffled = [...validPosts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, limit);
};

// New hook for hero metadata with React Query
export const useHeroMetadata = (heroLink: string, providerValue: string) => {
  return useQuery({
    queryKey: ['heroMetadata', heroLink, providerValue],
    queryFn: async () => {
      const {providerManager} = await import('../services/ProviderManager');
      const {default: axios} = await import('axios');

      const info = await providerManager.getMetaData({
        link: heroLink,
        provider: providerValue,
      });

      // Try to get enhanced metadata from Stremio if imdbId is available
      if (info.imdbId) {
        try {
          const response = await axios.get(
            `https://v3-cinemeta.strem.io/meta/${info.type}/${info.imdbId}.json`,
            {timeout: 5000},
          );
          const metaData = response.data?.meta || info;
          cacheStorage.setString(heroLink, JSON.stringify(metaData));
          return metaData;
        } catch {
          cacheStorage.setString(heroLink, JSON.stringify(info));
          return info; // Fallback to original info if Stremio fails
        }
      }

      cacheStorage.setString(heroLink, JSON.stringify(info));
      return info;
    },
    enabled: !!heroLink && !!providerValue,
    staleTime: 10 * 60 * 1000, // 10 minutes - hero metadata changes less frequently
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => {
      const cached = cacheStorage.getString(heroLink);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
  });
};
