/**
 * iptv-org REST API Client
 * https://iptv-org.github.io/api/
 *
 * Provides typed JSON access to the iptv-org database with in-memory
 * TTL caching so large JSON files are only fetched once per session.
 */

const BASE = 'https://iptv-org.github.io/api';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── API Types ────────────────────────────────────────────────────────────────

export interface IptvChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

export interface IptvFeed {
  channel: string;
  id: string;
  name: string;
  alt_names: string[];
  is_main: boolean;
  broadcast_area: string[];
  timezones: string[];
  languages: string[];
  format: string;
}

export interface IptvLogo {
  channel: string;
  feed: string | null;
  tags: string[];
  width: number;
  height: number;
  format: string | null;
  url: string;
}

export interface IptvStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  referrer: string | null;
  user_agent: string | null;
  quality: string | null;
  label: string | null;
}

export interface IptvGuide {
  channel: string | null;
  feed: string | null;
  site: string;
  site_id: string;
  site_name: string;
  lang: string;
}

export interface IptvCountry {
  name: string;
  code: string;
  languages: string[];
  flag: string;
}

export interface IptvCategory {
  id: string;
  name: string;
  description: string;
}

export interface EnrichedChannel {
  iptvOrgId: string | null;
  logo: string | null;
  categories: string[];
  country: string | null;
  website: string | null;
  guides: IptvGuide[];
  feeds: IptvFeed[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry<any>> = {};

async function fetchWithCache<T>(key: string, url: string): Promise<T> {
  const now = Date.now();
  const entry = cache[key];
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.data as T;
  }
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`iptv-org API error ${response.status} for ${url}`);
  }
  const data: T = await response.json();
  cache[key] = { data, fetchedAt: now };
  return data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a string for fuzzy comparison (lowercase, alphanum only) */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── Main API Object ──────────────────────────────────────────────────────────

export const iptvOrgApi = {
  // ─── Fetch Methods ──────────────────────────────────────────────────────────

  /** Fetch all channels (cached) */
  async fetchChannels(): Promise<IptvChannel[]> {
    return fetchWithCache<IptvChannel[]>('channels', `${BASE}/channels.json`);
  },

  /** Fetch all feeds (cached) */
  async fetchFeeds(): Promise<IptvFeed[]> {
    return fetchWithCache<IptvFeed[]>('feeds', `${BASE}/feeds.json`);
  },

  /** Fetch all logos (cached) */
  async fetchLogos(): Promise<IptvLogo[]> {
    return fetchWithCache<IptvLogo[]>('logos', `${BASE}/logos.json`);
  },

  /** Fetch all streams (cached) */
  async fetchStreams(): Promise<IptvStream[]> {
    return fetchWithCache<IptvStream[]>('streams', `${BASE}/streams.json`);
  },

  /** Fetch all EPG guides (cached) */
  async fetchGuides(): Promise<IptvGuide[]> {
    return fetchWithCache<IptvGuide[]>('guides', `${BASE}/guides.json`);
  },

  /** Fetch all countries (cached) */
  async fetchCountries(): Promise<IptvCountry[]> {
    return fetchWithCache<IptvCountry[]>('countries', `${BASE}/countries.json`);
  },

  /** Fetch all categories (cached) */
  async fetchCategories(): Promise<IptvCategory[]> {
    return fetchWithCache<IptvCategory[]>(
      'categories',
      `${BASE}/categories.json`,
    );
  },

  // ─── Lookup Methods ─────────────────────────────────────────────────────────

  /**
   * Find the canonical iptv-org channel entry that best matches a local channel.
   * Tries (in order):
   *   1. tvgId exact match against channel.id
   *   2. tvgId case-insensitive match
   *   3. Normalized name match
   *   4. Normalized alt_name match
   */
  async findChannel(
    tvgId?: string | null,
    name?: string | null,
    country?: string | null,
  ): Promise<IptvChannel | null> {
    try {
      const channels = await this.fetchChannels();

      // 1. Exact tvgId match
      if (tvgId) {
        const exact = channels.find(c => c.id === tvgId);
        if (exact) return exact;

        // 2. Case-insensitive tvgId
        const lId = tvgId.toLowerCase();
        const caseInsensitive = channels.find(
          c => c.id.toLowerCase() === lId,
        );
        if (caseInsensitive) return caseInsensitive;
      }

      // 3 & 4. Name matching (with optional country filter for precision)
      if (name) {
        const normName = normalize(name);
        const countryCode = country?.toUpperCase();

        const candidates = channels.filter(c => {
          if (countryCode && c.country !== countryCode) return false;
          const normId = normalize(c.name);
          if (normId === normName) return true;
          if (normId.includes(normName) || normName.includes(normId))
            return true;
          return c.alt_names.some(alt => {
            const normAlt = normalize(alt);
            return normAlt === normName || normAlt.includes(normName) || normName.includes(normAlt);
          });
        });

        if (candidates.length === 1) return candidates[0];

        // Prefer exact name match if multiple
        const exact = candidates.find(c => normalize(c.name) === normName);
        if (exact) return exact;

        if (candidates.length > 0) return candidates[0];

        // Retry without country filter
        if (countryCode) {
          const anyCountry = channels.filter(c => {
            const normId = normalize(c.name);
            return (
              normId === normName ||
              normId.includes(normName) ||
              normName.includes(normId)
            );
          });
          if (anyCountry.length > 0) return anyCountry[0];
        }
      }

      return null;
    } catch (e) {
      console.warn('[iptvOrgApi] findChannel error:', e);
      return null;
    }
  },

  /**
   * Get the best logo URL for a channel.
   * Prefers horizontal SVG/PNG logos.
   */
  async getBestLogo(channelId: string): Promise<string | null> {
    try {
      const logos = await this.fetchLogos();
      const channelLogos = logos.filter(l => l.channel === channelId);
      if (channelLogos.length === 0) return null;

      // Prefer main feed / horizontal / SVG
      const sorted = [...channelLogos].sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.feed === null) scoreA += 3; // channel-level (not feed-specific)
        if (b.feed === null) scoreB += 3;
        if (a.tags.includes('horizontal')) scoreA += 2;
        if (b.tags.includes('horizontal')) scoreB += 2;
        if (a.format === 'SVG') scoreA += 1;
        if (b.format === 'SVG') scoreB += 1;
        return scoreB - scoreA;
      });

      return sorted[0]?.url ?? null;
    } catch (e) {
      console.warn('[iptvOrgApi] getBestLogo error:', e);
      return null;
    }
  },

  /**
   * Get EPG guide entries for a channel.
   */
  async getGuides(channelId: string): Promise<IptvGuide[]> {
    try {
      const guides = await this.fetchGuides();
      return guides.filter(g => g.channel === channelId);
    } catch (e) {
      console.warn('[iptvOrgApi] getGuides error:', e);
      return [];
    }
  },

  /**
   * Get all feeds for a channel.
   */
  async getFeeds(channelId: string): Promise<IptvFeed[]> {
    try {
      const feeds = await this.fetchFeeds();
      return feeds.filter(f => f.channel === channelId);
    } catch (e) {
      console.warn('[iptvOrgApi] getFeeds error:', e);
      return [];
    }
  },

  /**
   * Get active streams for a channel from the API.
   */
  async getStreams(channelId: string): Promise<IptvStream[]> {
    try {
      const streams = await this.fetchStreams();
      return streams.filter(s => s.channel === channelId);
    } catch (e) {
      console.warn('[iptvOrgApi] getStreams error:', e);
      return [];
    }
  },

  // ─── Enrichment ─────────────────────────────────────────────────────────────

  /**
   * Given a local channel (from M3U), look it up in the iptv-org API and return
   * enriched metadata. Returns null fields if no match found.
   *
   * This is the primary integration point for LivePlayer and M3U channels.
   */
  async enrichChannel(
    tvgId?: string | null,
    name?: string | null,
    country?: string | null,
    existingLogo?: string | null,
  ): Promise<EnrichedChannel> {
    const result: EnrichedChannel = {
      iptvOrgId: null,
      logo: existingLogo ?? null,
      categories: [],
      country: null,
      website: null,
      guides: [],
      feeds: [],
    };

    try {
      const match = await this.findChannel(tvgId, name, country);
      if (!match) return result;

      result.iptvOrgId = match.id;
      result.categories = match.categories;
      result.country = match.country;
      result.website = match.website;

      // Try to get a better logo from the API
      const apiLogo = await this.getBestLogo(match.id);
      if (apiLogo) result.logo = apiLogo;

      // Get guides and feeds in parallel
      const [guides, feeds] = await Promise.all([
        this.getGuides(match.id),
        this.getFeeds(match.id),
      ]);
      result.guides = guides;
      result.feeds = feeds;

      return result;
    } catch (e) {
      console.warn('[iptvOrgApi] enrichChannel error:', e);
      return result;
    }
  },

  /**
   * Build the EPG XML URL for a channel using its tvgId or a country fallback.
   * iptv-org EPG guide XML is organized by country.
   */
  buildEpgUrl(countryCode: string): string {
    return `https://iptv-org.github.io/epg/guides/${countryCode.toLowerCase()}.xml`;
  },

  /** Clear the entire in-memory cache (useful on app resume or settings change) */
  clearCache(): void {
    Object.keys(cache).forEach(k => delete cache[k]);
  },
};
