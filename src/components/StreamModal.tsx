import {View, Text, Clipboard} from 'react-native';
import React from 'react';
import {Modal, TouchableOpacity} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as IntentLauncher from 'expo-intent-launcher';

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../lib/zustand/themeStore';
import {settingsStorage} from '../lib/storage';
import SkeletonLoader from './Skeleton';
import useToastStore from '../lib/zustand/toastStore';

const StreamModal = ({
  downloadModal,
  setDownloadModal,
  servers,
  serverLoading,
  downloadFile,
}: {
  downloadModal: boolean;
  setDownloadModal: (value: boolean) => void;
  servers: Array<{server: string; link: string}>;
  serverLoading: boolean;
  downloadFile: (link: string) => void;
}) => {
  const {primary, mode} = useThemeStore(state => state);
  const {show} = useToastStore();

  const openExternalPlayer = async (link: string) => {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: link,
        type: 'video/*',
      });
    } catch (e) {
      show('Failed to open external player', 'error');
    }
  };
  
  return (
    <Modal animationType="fade" visible={downloadModal} transparent={true}>
      <View className="flex-1 bg-black/40 justify-center items-center p-4">
        <View className="bg-tertiary p-3 w-full rounded-md justify-center items-center border border-white/10">
          <Text className="text-lg font-semibold my-3 text-black dark:text-white">
            Select a server to download
          </Text>
          <View className="flex-col items-center w-full my-5">
            {!serverLoading
              ? servers?.map((server, index) => (
                  <View 
                    key={server.server + index}
                    className="flex-row items-center justify-between w-full p-3 mb-2 rounded-md border border-white/5"
                    style={{ backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  >
                    <TouchableOpacity 
                      className="flex-1"
                      onPress={() => {
                        setDownloadModal(false);
                        downloadFile(server.link);
                      }}
                    >
                      <Text className="text-black dark:text-white text-sm font-semibold capitalize">
                        {server.server}
                      </Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center gap-4">
                      <TouchableOpacity 
                        onPress={() => {
                          if (settingsStorage.getBool('hapticFeedback') !== false) {
                            ReactNativeHapticFeedback.trigger('effectHeavyClick', {
                              enableVibrateFallback: true,
                              ignoreAndroidSystemSettings: false,
                            });
                          }
                          Clipboard.setString(server.link);
                          show('Link copied to clipboard', 'success');
                        }}
                      >
                        <MaterialIcons name="content-copy" size={18} color={primary} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => {
                           setDownloadModal(false);
                           openExternalPlayer(server.link);
                        }}
                      >
                        <MaterialIcons name="play-arrow" size={22} color={primary} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => {
                          setDownloadModal(false);
                          downloadFile(server.link);
                        }}
                      >
                        <MaterialIcons name="file-download" size={20} color={primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              : Array.from({length: 3}).map((_, index) => (
                  <View key={index} className="w-full mb-2">
                    <SkeletonLoader
                      show={true}
                      height={50}
                      width="100%"
                    />
                  </View>
                ))}
          </View>
          <View className="flex-row items-center gap-2 w-full">
            <MaterialIcons
              name="info-outline"
              size={14}
              color={mode === 'dark' ? '#c1c4c9' : '#666'}
              onPress={() => setDownloadModal(false)}
            />
            <Text className="text-[10px] text-center text-black/60 dark:text-white/60">
              Select an action for the server link
            </Text>
          </View>
          {/* close modal */}
          <TouchableOpacity
            onPress={() => setDownloadModal(false)}
            className="absolute top-2 right-2">
            <MaterialIcons name="close" size={20} color={mode === 'dark' ? '#c1c4c9' : '#666'} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default StreamModal;

