import {create} from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  show: (message: string, type?: ToastType, duration?: number) => void;
  hide: () => void;
}

const useToastStore = create<ToastState>(set => ({
  visible: false,
  message: '',
  type: 'info',
  show: (message, type = 'info', duration = 3000) => {
    set({visible: true, message, type});
    setTimeout(() => {
      set({visible: false});
    }, duration);
  },
  hide: () => set({visible: false}),
}));

export default useToastStore;
