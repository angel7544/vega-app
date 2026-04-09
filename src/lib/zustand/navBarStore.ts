import {create} from 'zustand';

interface NavBarState {
  isNavBarVisible: boolean;
  isDrawerOpen: boolean;
  show: () => void;
  hide: () => void;
  setVisible: (visible: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
}

const useNavBarStore = create<NavBarState>(set => ({
  isNavBarVisible: true,
  isDrawerOpen: false,
  show: () => set({isNavBarVisible: true}),
  hide: () => set({isNavBarVisible: false}),
  setVisible: (visible: boolean) => set({isNavBarVisible: visible}),
  setDrawerOpen: (open: boolean) => set({isDrawerOpen: open}),
}));

export default useNavBarStore;
