import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mainStorage } from '../storage/StorageService';

const zustandStorage = {
  setItem: (name: string, value: string) => mainStorage.setString(name, value),
  getItem: (name: string) => mainStorage.getString(name) ?? null,
  removeItem: (name: string) => mainStorage.delete(name),
};

interface PlayerState {
  activeChannel: any | null;
  favorites: any[];
  favoriteGenres: string[];
  setActiveChannel: (channel: any | null) => void;
  toggleFavorite: (channel: any) => void;
  isFavorite: (url: string) => boolean;
  toggleFavoriteGenre: (genre: string) => void;
  isFavoriteGenre: (genre: string) => boolean;
  autoPlayChannel: boolean;
  toggleAutoPlayChannel: () => void;
  customEpgUrl: string | null;
  setCustomEpgUrl: (url: string | null) => void;
  disableEpg: boolean;
  toggleDisableEpg: () => void;
  epgRepoUrl: string;
  setEpgRepoUrl: (url: string) => void;
  epgData: Record<string, any[]>;
  setEpgData: (data: Record<string, any[]>) => void;
  updateChannelEpg: (url: string, programs: any[]) => void;
  epgTimeOffset: number;
  setEpgTimeOffset: (offset: number) => void;
  initRepo: () => void;
}

export const DEFAULT_EPG_REPO = 'https://raw.githubusercontent.com/angel7544/epg-personal/master/src/epg-data';

const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      activeChannel: null,
      favorites: [],
      favoriteGenres: [],
      autoPlayChannel: true,
      customEpgUrl: null,
      disableEpg: false,
      epgRepoUrl: DEFAULT_EPG_REPO,
      epgData: {},
      epgTimeOffset: 0,

      toggleDisableEpg: () => set({ disableEpg: !get().disableEpg }),
      setEpgData: (data) => set({ epgData: data }),
      updateChannelEpg: (url, programs) => set({
        epgData: { ...get().epgData, [url]: programs }
      }),

      setCustomEpgUrl: (url: string | null) => set({ customEpgUrl: url }),
      setEpgRepoUrl: (url: string) => set({ epgRepoUrl: url }),
      setEpgTimeOffset: (offset: number) => set({ epgTimeOffset: offset }),

      setActiveChannel: (channel) => set({ activeChannel: channel }),

      // Migration: Ensure old 'main' branch URLs are updated to 'master'
      initRepo: () => {
        const { epgRepoUrl } = get();
        if (epgRepoUrl.includes('/main/')) {
           set({ epgRepoUrl: DEFAULT_EPG_REPO });
        }
      },

      toggleFavorite: (channel) => {
        const { favorites } = get();
        const exists = favorites.find((f) => f.url === channel.url);
        if (exists) {
          set({ favorites: favorites.filter((f) => f.url !== channel.url) });
        } else {
          set({ favorites: [...favorites, channel] });
        }
      },

      isFavorite: (url) => {
        return !!get().favorites.find((f) => f.url === url);
      },

      toggleFavoriteGenre: (genre) => {
        const { favoriteGenres } = get();
        if (favoriteGenres.includes(genre)) {
          set({ favoriteGenres: favoriteGenres.filter((g) => g !== genre) });
        } else {
          set({ favoriteGenres: [...favoriteGenres, genre] });
        }
      },

      isFavoriteGenre: (genre) => {
        return get().favoriteGenres.includes(genre);
      },

      toggleAutoPlayChannel: () => {
        set({ autoPlayChannel: !get().autoPlayChannel });
      },
    }),
    {
      name: 'vega-player-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

export default usePlayerStore;
