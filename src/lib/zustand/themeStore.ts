import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {MMKVLoader} from 'react-native-mmkv-storage';
import {settingsStorage} from '../storage';

const storage = new MMKVLoader().initialize();

export interface Theme {
  primary: string;
  isCustom: boolean;
  mode: 'light' | 'dark';
  setPrimary: (type: Theme['primary']) => void;
  setCustom: (isCustom: boolean) => void;
  setMode: (mode: Theme['mode']) => void;
  toggleMode: () => void;
}

const useThemeStore = create<Theme>()(
  persist(
    set => ({
      primary: settingsStorage.getPrimaryColor(),
      isCustom: settingsStorage.isCustomTheme(),
      mode: settingsStorage.getThemeMode(),

      setPrimary: (primary: Theme['primary']) => {
        set({primary});
        settingsStorage.setPrimaryColor(primary);
      },
      setCustom: (isCustom: Theme['isCustom']) => {
        set({isCustom});
        settingsStorage.setCustomTheme(isCustom);
      },
      setMode: (mode: Theme['mode']) => {
        set({mode});
        settingsStorage.setThemeMode(mode);
      },
      toggleMode: () => {
        set((state) => {
          const newMode = state.mode === 'dark' ? 'light' : 'dark';
          settingsStorage.setThemeMode(newMode);
          return {mode: newMode};
        });
      },
    }),
    {
      name: 'content-storage',
      //@ts-expect-error
      storage: createJSONStorage(() => storage),
    },
  ),
);

export default useThemeStore;
