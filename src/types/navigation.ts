import { EpisodeLink } from '../lib/providers/types';

export interface Channel {
  name: string;
  url: string;
  logo?: string;
  category?: string;
  tvgId?: string;
  /** Canonical iptv-org channel ID resolved from channels.json */
  iptvOrgId?: string | null;
  /** Official website from iptv-org API */
  website?: string | null;
  /** New metadata from M3U parser */
  country?: string;
  language?: string;
  quality?: 'SD' | 'HD' | 'FHD' | '4K';
}

export interface Program {
  start: string;
  stop?: string;
  /** Unix ms timestamp for start (for live-now detection) */
  startTs: number;
  /** Unix ms timestamp for stop (for live-now detection) */
  stopTs: number;
  title: string;
  desc?: string;
  icon?: string | null;
  category?: string | null;
  channelId?: string;
  [key: string]: any;
}

export type HomeStackParamList = {
  Home: undefined;
  Info: {link: string; provider?: string; poster?: string};
  ScrollList: {
    filter: string;
    title?: string;
    providerValue?: string;
    isSearch: boolean;
  };
  Webview: {link: string};
};

export type RootStackParamList = {
  TabStack:
    | {
        screen?: keyof TabStackParamList;
        params?: {
          screen?: string;
          params?: {
            screen?: string;
            params?: any;
          };
        };
      }
    | undefined;
  Player: {
    linkIndex: number;
    episodeList: EpisodeLink[];
    directUrl?: string;
    type: string;
    primaryTitle?: string;
    secondaryTitle?: string;
    poster: {
      logo?: string;
      poster?: string;
      background?: string;
    };
    file?: string;
    providerValue?: string;
    infoUrl?: string;
    doNotTrack?: boolean;
  };
  FavoriteTV: undefined;
  ChannelInfo: {
    channel: Channel;
    channels?: Channel[];
    initialIndex?: number;
  };
  SearchStack: undefined;
};

export type SearchStackParamList = {
  Search: undefined;
  ScrollList: {
    filter: string;
    title?: string;
    providerValue?: string;
    isSearch: boolean;
  };
  Info: {link: string; provider?: string; poster?: string};
  SearchResults: {filter: string; availableProviders?: string[]};
  Webview: {link: string};
};

export type WatchListStackParamList = {
  WatchList: undefined;
  Info: {link: string; provider?: string; poster?: string};
};

export type WatchHistoryStackParamList = {
  WatchHistory: undefined;
  Info: {link: string; provider?: string; poster?: string};
  SeriesEpisodes: {
    series: string;
    episodes: Array<{uri: string; size: number}>;
    thumbnails: Record<string, string>;
  };
};

export type SettingsStackParamList = {
  Settings: undefined;
  DisableProviders: undefined;
  About: undefined;
  Preferences: undefined;
  Downloads: undefined;
  WatchHistoryStack: undefined;
  SubTitlesPreferences: undefined;
  Extensions: undefined;
};

export type TabStackParamList = {
  HomeStack: undefined;
  SearchStack: undefined;
  WatchHistoryStack: undefined;
  WatchListStack: undefined;
  LiveTVStack: undefined;
  SettingsStack: undefined;
};
