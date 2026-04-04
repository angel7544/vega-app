import {
  View,
  Text,
  Image,
  Platform,
  TouchableOpacity,
} from 'react-native';
import requestStoragePermission from '../../lib/file/getStoragePermission';
import {downloadFolder} from '../../lib/constants';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, {useState, useEffect, useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {downloadsStorage, settingsStorage} from '../../lib/storage';
import useThemeStore from '../../lib/zustand/themeStore';
import useDownloadStore from '../../lib/zustand/downloadsStore';
import * as RNFS from '@dr.pogodin/react-native-fs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../App';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {FlashList} from '@shopify/flash-list';
import useToastStore from '../../lib/zustand/toastStore';
import * as FileSystem from 'expo-file-system/legacy';

// Define supported video extensions
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
];

const isVideoFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return VIDEO_EXTENSIONS.includes(extension);
};

interface DownloadedFile {
  uri: string;
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  modificationTime?: number;
}

interface MediaGroup {
  title: string;
  episodes: DownloadedFile[];
  thumbnail?: string;
  isMovie: boolean;
}

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[\s.-]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
};

const getBaseName = (fileName: string): string => {
  let baseName = fileName
    .replace(/\.(mp4|mkv|avi|mov)$/i, '')
    .replace(/(?:480p|720p|1080p|2160p|HEVC|x264|BluRay|WEB-DL|HDRip).*$/i, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/(?:episode|ep)[\s-]*\d+/gi, '')
    .replace(/s\d{1,2}e\d{1,2}/gi, '')
    .replace(/season[\s-]*\d+/gi, '')
    .replace(/\s*-\s*\d+/, '')
    .replace(/\s*\d+\s*$/, '')
    .replace(/[_.]/g, ' ')
    .trim();

  baseName = baseName.replace(/[\s.-]*\d+$/, '');
  return baseName;
};

const getEpisodeInfo = (
  fileName: string,
): {season: number; episode: number} => {
  let match = fileName.match(/s(\d{1,2})e(\d{1,2})/i);
  if (match) {
    return {season: parseInt(match[1], 10), episode: parseInt(match[2], 10)};
  }

  match = fileName.match(/season[\s.-]*(\d{1,2}).*?episode[\s.-]*(\d{1,2})/i);
  if (match) {
    return {season: parseInt(match[1], 10), episode: parseInt(match[2], 10)};
  }

  match =
    fileName.match(/(?:episode|ep)[\s.-]*(\d{1,2})/i) ||
    fileName.match(/[\s.-](\d{1,2})(?:\s*$|\s*\.)/);

  if (match) {
    return {season: 1, episode: parseInt(match[1], 10)};
  }

  return {season: 1, episode: 0};
};

const Downloads = () => {
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const {primary, mode} = useThemeStore(state => state);
  const {show} = useToastStore();
  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  const {activeDownloads} = useDownloadStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const loadData = async () => {
    const cachedFiles = downloadsStorage.getFilesInfo();
    const cachedThumbnails = downloadsStorage.getThumbnails();

    if (cachedFiles && cachedFiles.length > 0) {
      const validCachedFiles: DownloadedFile[] = cachedFiles
        .filter(f => f.uri)
        .map(f => ({
          uri: f.uri!,
          exists: f.exists,
          isDirectory:
            'isDirectory' in f ? (f.isDirectory as boolean) : undefined,
          size: 'size' in f ? (f as any).size : undefined,
          modificationTime:
            'modificationTime' in f ? (f as any).modificationTime : undefined,
        }));
      setFiles(validCachedFiles);
      setLoading(false);
    }
    if (cachedThumbnails) {
      setThumbnails(cachedThumbnails);
    }

    const granted = await requestStoragePermission();
    if (granted) {
      try {
        if (!(await RNFS.exists(downloadFolder))) {
          await RNFS.mkdir(downloadFolder);
        }

        const allFiles = await RNFS.readDir(downloadFolder);

        const validFiles: DownloadedFile[] = allFiles
          .filter(item => item.isFile() && isVideoFile(item.name))
          .map(item => ({
            uri: Platform.OS === 'android' ? `file://${item.path}` : item.path,
            exists: true,
            isDirectory: false,
            size: item.size,
            modificationTime: item.mtime ? new Date(item.mtime).getTime() : undefined,
          }));

        downloadsStorage.saveFilesInfo(validFiles as any);
        setFiles(validFiles);
      } catch (error) {
        console.error('Error reading files:', error);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [Object.keys(activeDownloads).length]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function getThumbnail(file: DownloadedFile) {
    try {
      const fileName = file.uri.split('/').pop();
      if (!fileName || !isVideoFile(fileName)) {
        return null;
      }

      const {uri} = await VideoThumbnails.getThumbnailAsync(file.uri, {
        time: 100000,
      });
      return uri;
    } catch (error) {
      console.log('error in getThumbnail:', error);
      return null;
    }
  }

  useEffect(() => {
    const getThumbnails = async () => {
      try {
        const filesToProcess = files.filter(file => !thumbnails[file.uri]);
        if (filesToProcess.length === 0) return;

        const thumbnailPromises = filesToProcess.map(async file => {
          const thumbnail = await getThumbnail(file);
          if (thumbnail) {
            return {[file.uri]: thumbnail};
          }
          return null;
        });

        const thumbnailResults = await Promise.all(thumbnailPromises);
        const newThumbnails = thumbnailResults.reduce<Record<string, string>>(
          (acc, curr) => (curr ? {...acc, ...curr} : acc),
          {},
        );

        if (Object.keys(newThumbnails).length > 0) {
          const mergedThumbnails = {...thumbnails, ...newThumbnails};
          downloadsStorage.saveThumbnails(mergedThumbnails);
          setThumbnails(mergedThumbnails);
        }
      } catch (error) {
        console.error('Error generating thumbnails:', error);
      }
    };

    if (files.length > 0) {
      getThumbnails();
    }
  }, [files]);

  const cancelDownload = async (fileName: string, jobId?: number) => {
    try {
      if (jobId) {
        await RNFS.stopDownload(jobId);
      }
      useDownloadStore.getState().removeDownload(fileName);
      const path = `${downloadFolder}/${fileName}`;
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path);
      }
      show('Download cancelled', 'info');
    } catch (error) {
      console.error('Error cancelling download:', error);
    }
  };

  const deleteFiles = async () => {
    try {
      await Promise.all(
        groupSelected.map(async fileUri => {
          try {
            const path =
              Platform.OS === 'android'
                ? fileUri.replace('file://', '')
                : fileUri;

            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists) {
              await RNFS.unlink(path);
            }
          } catch (error) {
            console.error(`Error deleting file ${fileUri}:`, error);
            throw error;
          }
        }),
      );

      const newFiles = files.filter(file => !groupSelected.includes(file.uri));
      setFiles(newFiles);
      setGroupSelected([]);
      setIsSelecting(false);
      show(`Deleted ${groupSelected.length} file(s)`, 'success');
    } catch (error) {
      console.error('Error deleting files:', error);
      show('Error deleting files', 'error');
    }
  };

  const groupMediaFiles = React.useMemo((): MediaGroup[] => {
    const groups: Record<string, MediaGroup> = {};

    files.forEach(file => {
      const fileName = file.uri.split('/').pop() || '';
      const baseName = getBaseName(fileName);
      const normalizedBaseName = normalizeString(baseName);

      if (!groups[normalizedBaseName]) {
        groups[normalizedBaseName] = {
          title: baseName,
          episodes: [],
          thumbnail: undefined,
          isMovie: true,
        };
      }
      groups[normalizedBaseName].episodes.push(file);
    });

    Object.values(groups).forEach(group => {
      const hasEpisodeIndicators = group.episodes.some(file => {
        const fileName = file.uri.split('/').pop() || '';
        return getEpisodeInfo(fileName).episode > 0;
      });

      group.isMovie = !(group.episodes.length > 1 || hasEpisodeIndicators);

      if (!group.isMovie) {
        group.episodes.sort((a, b) => {
          const aName = a.uri.split('/').pop() || '';
          const bName = b.uri.split('/').pop() || '';
          const aInfo = getEpisodeInfo(aName);
          const bInfo = getEpisodeInfo(bName);

          if (aInfo.season !== bInfo.season) {
            return aInfo.season - bInfo.season;
          }
          return aInfo.episode - bInfo.episode;
        });
      }

      for (const episode of group.episodes) {
        if (thumbnails[episode.uri]) {
          group.thumbnail = thumbnails[episode.uri];
          break;
        }
      }
    });

    return Object.values(groups);
  }, [files, thumbnails]);

  const isGroupSelected = (group: MediaGroup): boolean => {
    return group.episodes.some(ep => groupSelected.includes(ep.uri));
  };

  const getGroupUris = (group: MediaGroup): string[] => {
    return group.episodes.map(ep => ep.uri);
  };

  const isDarkMode = mode === 'dark';

  return (
    <View className={`mt-14 px-2 w-full h-full ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      <View className="flex-row justify-between items-center mb-4 px-2">
        <Text className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>Downloads</Text>
        <View className="flex-row gap-x-7 items-center">
          {isSelecting && (
            <MaterialCommunityIcons
              name="close"
              size={28}
              color={primary}
              onPress={() => {
                setGroupSelected([]);
                setIsSelecting(false);
              }}
            />
          )}
          {isSelecting && groupSelected.length > 0 && (
            <MaterialCommunityIcons
              name="delete-outline"
              size={28}
              color={primary}
              onPress={deleteFiles}
            />
          )}
        </View>
      </View>

      {Object.values(activeDownloads).length > 0 && (
        <View className="mb-4">
          <Text className={`text-lg font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-2 px-1`}>Downloading</Text>
          {Object.values(activeDownloads).map((item) => (
            <View key={`active-${item.fileName}`} className={`flex-row w-full p-2 mb-2 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} items-center`}>
              <View className={`w-40 aspect-video rounded-md overflow-hidden ${isDarkMode ? 'bg-quaternary' : 'bg-black/10'} mr-3 justify-center items-center`}>
                <MaterialCommunityIcons
                  name="download"
                  size={32}
                  color={primary}
                />
              </View>
              <View className="flex-1">
                <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold text-lg mb-1`} numberOfLines={1}>
                  {item.title}
                </Text>
                <View className={`w-full h-1.5 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'} rounded-full overflow-hidden mt-1`}>
                  <View 
                    className="h-full" 
                    style={{ 
                      width: `${Math.round((item.progress || 0) * 100)}%`, 
                      backgroundColor: primary 
                    }} 
                  />
                </View>
                <Text className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-xs mt-1`}>
                  {Math.round((item.progress || 0) * 100)}% • {item.fileType.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => cancelDownload(item.fileName, item.jobId)}
                className="p-2"
              >
                <MaterialCommunityIcons name="close-circle-outline" size={24} color={isDarkMode ? 'gray' : '#666'} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <FlashList
        data={groupMediaFiles}
        estimatedItemSize={100}
        ListEmptyComponent={() =>
          !loading && (
            <View className="flex-1 justify-center items-center mt-10">
              <Text className={`text-center text-lg ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>Looks Empty Here!</Text>
            </View>
          )
        }
        renderItem={({item}) => (
          <TouchableOpacity
            className={`flex-row w-full p-2 mb-2 rounded-lg overflow-hidden items-center ${
              isSelecting && isGroupSelected(item)
                ? (isDarkMode ? 'bg-quaternary' : 'bg-black/10')
                : 'bg-transparent'
            }`}
            onLongPress={() => {
              if (settingsStorage.isHapticFeedbackEnabled()) {
                RNReactNativeHapticFeedback.trigger('effectTick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              setGroupSelected(getGroupUris(item));
              setIsSelecting(true);
            }}
            onPress={() => {
              if (isSelecting) {
                if (settingsStorage.isHapticFeedbackEnabled()) {
                  RNReactNativeHapticFeedback.trigger('effectTick', {
                    enableVibrateFallback: true,
                    ignoreAndroidSystemSettings: false,
                  });
                }
                const groupUris = getGroupUris(item);
                if (isGroupSelected(item)) {
                  setGroupSelected(
                    groupSelected.filter(uri => !groupUris.includes(uri)),
                  );
                } else {
                  setGroupSelected([...groupSelected, ...groupUris]);
                }
                const remainingSelected = groupSelected.filter(
                  uri => !groupUris.includes(uri),
                );
                if (isGroupSelected(item) && remainingSelected.length === 0) {
                  setIsSelecting(false);
                  setGroupSelected([]);
                }
              } else {
                if (item.isMovie) {
                  const file = item.episodes[0];
                  const fileName = file.uri.split('/').pop() || '';
                  navigation.navigate('Player', {
                    episodeList: [{title: fileName, link: file.uri}],
                    linkIndex: 0,
                    type: '',
                    directUrl: file.uri,
                    primaryTitle: item.title,
                    poster: {},
                    providerValue: 'OrbixPlay',
                    doNotTrack: true,
                  });
                } else {
                  navigation.navigate('TabStack', {
                    screen: 'SettingsStack',
                    params: {
                      screen: 'WatchHistoryStack',
                      params: {
                        screen: 'SeriesEpisodes',
                        params: {
                          episodes: item.episodes as any,
                          series: item.title,
                          thumbnails: thumbnails,
                        },
                      },
                    },
                  });
                }
              }
            }}>
            <View className={`w-40 aspect-video rounded-md overflow-hidden ${isDarkMode ? 'bg-quaternary' : 'bg-black/10'} mr-3`}>
              {item.thumbnail ? (
                <Image
                  source={{uri: item.thumbnail}}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <MaterialCommunityIcons
                    name="movie-open-outline"
                    size={32}
                    color={primary}
                  />
                </View>
              )}
            </View>

            <View className="flex-1 justify-center">
              <Text
                className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold text-lg mb-1`}
                numberOfLines={2}>
                {item.title}
              </Text>
              {!item.isMovie && (
                <Text className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  {item.episodes.length} episode
                  {item.episodes.length > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default Downloads;

