import {create} from 'zustand';

interface NavBarState {
  isNavBarVisible: boolean;
  show: () => void;
  hide: () => void;
  setVisible: (visible: boolean) => void;
}

const useNavBarStore = create<NavBarState>(set => ({
  isNavBarVisible: true,
  show: () => set({isNavBarVisible: true}),
  hide: () => set({isNavBarVisible: false}),
  setVisible: (visible: boolean) => set({isNavBarVisible: visible}),
}));

export default useNavBarStore;
