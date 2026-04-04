import React, {useEffect, useLayoutEffect, useState} from 'react';
import {View, Text, TouchableOpacity, Modal, Pressable} from 'react-native';
import {ifExists} from '../lib/file/ifExists';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import {Stream} from '../lib/providers/types';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../lib/zustand/contentStore';
import * as IntentLauncher from 'expo-intent-launcher';
import {downloadManager} from '../lib/downloader';
import {cancelHlsDownload} from '../lib/hlsDownloader2';
// import {FFmpegKit} from 'ffmpeg-kit-react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {downloadFolder} from '../lib/constants';
import useThemeStore from '../lib/zustand/themeStore';
import {settingsStorage} from '../lib/storage';
import {providerManager} from '../lib/services/ProviderManager';

type Props = {
  link: string;
  fileName: string;
  type: string;
  providerValue: string;
  title: string;
  downloadActive: boolean;
  setDownloadActive: (value: boolean) => void;
  onOpenDownloadModal: (data: {
    title: string;
    link: string;
    type: string;
    fileName: string;
  }) => void;
};

const DownloadComponent = ({
  link,
  fileName,
  type,
  providerValue,
  title,
  downloadActive,
  setDownloadActive,
  onOpenDownloadModal,
}: Props) => {
  const {primary} = useThemeStore(state => state);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState<string | boolean>(
    false,
  );
  const [deleteModal, setDeleteModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [downloadId, setDownloadId] = useState<number | null>(null);

  // check if file already exists
  useLayoutEffect(() => {
    const checkIfDownloaded = async () => {
      const exists = await ifExists(fileName);
      setAlreadyDownloaded(exists);
    };
    checkIfDownloaded();
  }, [fileName]);

  // handle download deletion
  const deleteDownload = async () => {
    try {
      const fileList = await RNFS.readDir(downloadFolder);
      // Find a file with the given name (without extension)
      const foundFile = fileList.find(fileItem => {
        const nameWithoutExtension = fileItem.name
          .split('.')
          .slice(0, -1)
          .join('.');
        return nameWithoutExtension === fileName;
      });
      if (foundFile) {
        await RNFS.unlink(foundFile.path);
        setAlreadyDownloaded(false);
        setDeleteModal(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const animatedStyles = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.5, {duration: 500}), -1, true),
  }));

  return (
    <>
      <View className="flex-row items-center mt-1 justify-between rounded-full bg-white/30 p-1">
        {downloadActive ? (
          <Animated.View
            style={[
              {
                marginHorizontal: 4,
              },
              animatedStyles,
            ]}>
            <TouchableOpacity
              onPress={() => {
                setCancelModal(prev => !prev);
                console.log('pressed');
              }}>
              <MaterialIcons name="downloading" size={27} color={primary} />
            </TouchableOpacity>
          </Animated.View>
        ) : alreadyDownloaded ? (
          <TouchableOpacity
            onPress={() => setDeleteModal(true)}
            className="mx-1">
            <MaterialIcons name="delete-outline" size={27} color="#c1c4c9" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              onOpenDownloadModal({title, link, type, fileName});
            }}
            onLongPress={() => {
              if (settingsStorage.getBool('hapticFeedback') !== false) {
                ReactNativeHapticFeedback.trigger('effectHeavyClick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              onOpenDownloadModal({title, link, type, fileName});
            }}
            className="mx-2">
            <Octicons name="download" size={25} color="#c1c4c9" />
          </TouchableOpacity>
        )}
        {/* delete modal */}
        {
          <Modal animationType="fade" visible={deleteModal} transparent={true}>
            <View className="flex-1 bg-black/10 justify-center items-center p-4">
              <View className="bg-tertiary p-3 w-80 rounded-md justify-center items-center">
                <Text className="text-2xl font-semibold my-3 text-white">
                  Confirm to delete
                </Text>
                <View className="flex-row items-center justify-evenly w-full my-5">
                  <TouchableOpacity
                    onPress={deleteDownload}
                    className="p-2 rounded-md m-1 px-3"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDeleteModal(false)}
                    className="p-2 px-4 rounded-md m-1"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        }
      </View>
      {cancelModal && downloadId && (
        <Pressable
          onPress={async () => {
            setCancelModal(false);
            try {
              // Check if this is an HLS download (ID >= 1000) or regular download
              if (typeof downloadId === 'number' && downloadId >= 1000) {
                // HLS download cancellation
                cancelHlsDownload(downloadId);
              } else {
                // Regular download cancellation
                RNFS.stopDownload(downloadId);
                //FFMPEGKIT CANCEL
                // FFmpegKit.cancel(downloadId);
              }
              setDownloadActive(false);

              const files = await RNFS.readDir(downloadFolder);
              // Find a file with the given name (without extension)
              const foundFile = files.find(fileItem => {
                const nameWithoutExtension = fileItem.name
                  .split('.')
                  .slice(0, -1)
                  .join('.');
                return nameWithoutExtension === fileName;
              });
              if (foundFile) {
                await RNFS.unlink(foundFile.path);
              }
            } catch (error) {
              console.log('Error cancelling download', error);
            }
          }}
          className="absolute right-12 bg-quaternary/80 bottom-3 rounded-md px-2">
          <Text className="text-lg text-white">Cancel</Text>
        </Pressable>
      )}
    </>
  );
};

export default DownloadComponent;
