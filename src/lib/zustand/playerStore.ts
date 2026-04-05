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
}

const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      activeChannel: null,
      favorites: [],
      favoriteGenres: [],

      setActiveChannel: (channel) => set({ activeChannel: channel }),

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
    }),
    {
      name: 'vega-player-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

export default usePlayerStore;
