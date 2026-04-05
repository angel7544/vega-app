import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mainStorage } from '../storage/StorageService';

const zustandStorage = {
  setItem: (name: string, value: string) => mainStorage.setString(name, value),
  getItem: (name: string) => mainStorage.getString(name) ?? null,
  removeItem: (name: string) => mainStorage.delete(name),
};

export interface IPTVChannel {
  name: string;
  url: string;
  logo: string;
  category: string;
  tvgId?: string;
}

interface IPTVState {
  channels: IPTVChannel[];
  setChannels: (channels: IPTVChannel[]) => void;
  clearChannels: () => void;
}

const useIPTVStore = create<IPTVState>()(
  persist(
    (set) => ({
      channels: [],
      setChannels: (channels) => set({ channels }),
      clearChannels: () => set({ channels: [] }),
    }),
    {
      name: 'vega-iptv-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

export default useIPTVStore;
