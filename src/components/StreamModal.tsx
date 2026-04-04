import {View, Text, Clipboard} from 'react-native';
import React from 'react';
import {Modal, TouchableOpacity} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  
  return (
    <Modal animationType="fade" visible={downloadModal} transparent={true}>
      <View className="flex-1 bg-black/40 justify-center items-center p-4">
        <View className="bg-tertiary p-3 w-full rounded-md justify-center items-center border border-white/10">
          <Text className="text-lg font-semibold my-3 text-black dark:text-white">
            Select a server to download
          </Text>
          <View className="flex-row items-center flex-wrap gap-1 justify-evenly w-full my-5">
            {!serverLoading
              ? servers?.map((server, index) => (
                  <TouchableOpacity
                    key={server.server + index}
                    onPress={() => {
                      setDownloadModal(false);
                      downloadFile(server.link);
                    }}
                    onLongPress={() => {
                      if (settingsStorage.getBool('hapticFeedback') !== false) {
                        ReactNativeHapticFeedback.trigger('effectHeavyClick', {
                          enableVibrateFallback: true,
                          ignoreAndroidSystemSettings: false,
                        });
                      }
                      Clipboard.setString(server.link);
                      show('Link copied to clipboard', 'success');
                    }}
                    className="p-2 rounded-md m-1"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white text-xs rounded-md capitalize px-1 font-semibold">
                      {server.server}
                    </Text>
                  </TouchableOpacity>
                ))
              : Array.from({length: 3}).map((_, index) => (
                  <SkeletonLoader
                    key={index}
                    show={true}
                    height={30}
                    width={90}
                  />
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
              Long press to copy download link
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

