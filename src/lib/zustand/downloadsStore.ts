import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {MMKVLoader} from 'react-native-mmkv-storage';
import {DownloadPayload} from '../storage/DownloadsStorage';

const storage = new MMKVLoader().initialize();

export interface DownloadItem extends DownloadPayload {
  progress: number;
  jobId?: number;
}

interface DownloadState {
  activeDownloads: Record<string, DownloadItem>;
  addDownload: (download: DownloadItem) => void;
  updateProgress: (fileName: string, progress: number, jobId?: number) => void;
  removeDownload: (fileName: string) => void;
  markAsCompleted: (fileName: string) => void;
}

const useDownloadStore = create<DownloadState>()(
  persist(
    set => ({
      activeDownloads: {},

      addDownload: (download: DownloadItem) => {
        set(state => ({
          activeDownloads: {
            ...state.activeDownloads,
            [download.fileName]: download,
          },
        }));
      },

      updateProgress: (fileName: string, progress: number, jobId?: number) => {
        set(state => ({
          activeDownloads: {
            ...state.activeDownloads,
            [fileName]: state.activeDownloads[fileName]
              ? {
                  ...state.activeDownloads[fileName],
                  progress,
                  ...(jobId !== undefined && {jobId}),
                }
              : state.activeDownloads[fileName],
          },
        }));
      },

      removeDownload: (fileName: string) => {
        set(state => {
          const newDownloads = {...state.activeDownloads};
          delete newDownloads[fileName];
          return {activeDownloads: newDownloads};
        });
      },

      markAsCompleted: (fileName: string) => {
        set(state => {
          const newDownloads = {...state.activeDownloads};
          const completedDownload = newDownloads[fileName];
          if (completedDownload) {
            delete newDownloads[fileName];
          }
          return {activeDownloads: newDownloads};
        });
      },
    }),
    {
      name: 'downloads-storage',
      //@ts-expect-error
      storage: createJSONStorage(() => storage),
    },
  ),
);

export default useDownloadStore;
