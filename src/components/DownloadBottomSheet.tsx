import {
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
  View,
  Clipboard,
} from 'react-native';
import React, {useMemo, useRef, useState} from 'react';
import {Stream} from '../lib/providers/types';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SkeletonLoader from './Skeleton';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../lib/zustand/themeStore';
import {TextTrackType} from 'react-native-video';
import {settingsStorage} from '../lib/storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import useToastStore from '../lib/zustand/toastStore';

type Props = {
  data: Stream[];
  loading: boolean;
  title: string;
  showModal: boolean;
  setModal: (value: boolean) => void;
  onPressVideo: (item: any) => void;
  onPressSubs: (item: any) => void;
  error?: string | null;
};

const DownloadBottomSheet = ({
  data,
  loading,
  showModal,
  setModal,
  title,
  onPressSubs,
  onPressVideo,
  error,
}: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {primary, mode} = useThemeStore(state => state);
  const {show} = useToastStore();
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  const allSubtitles = useMemo(() => {
    return data.flatMap(server => server.subtitles || []);
  }, [data]);

  const hasSubtitles = allSubtitles.length > 0;
  const snapPoints = useMemo(() => ['40%', '65%'], []);

  return (
    <Modal
      onRequestClose={() => setModal(false)}
      visible={showModal}
      transparent={true}
      animationType="fade">
      <GestureHandlerRootView style={{flex: 1}}>
        <Pressable
          onPress={() => setModal(false)}
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <BottomSheet
            enablePanDownToClose={true}
            snapPoints={snapPoints}
            index={showModal ? 0 : -1}
            containerStyle={{marginHorizontal: 0}}
            ref={bottomSheetRef}
            backgroundStyle={{backgroundColor: mode === 'dark' ? '#1a1a1a' : '#ffffff'}}
            handleIndicatorStyle={{backgroundColor: mode === 'dark' ? '#333' : '#ccc'}}
            onClose={() => setModal(false)}>
            <View style={{flex: 1}} onStartShouldSetResponder={() => true}>
              <Text className="text-black dark:text-white text-xl p-2 font-bold text-center">
                {title}
              </Text>
              <BottomSheetScrollView
                contentContainerStyle={{padding: 16, paddingBottom: 40}}
                showsVerticalScrollIndicator={false}>
                {hasSubtitles && (
                  <View className="flex-row items-center justify-center gap-x-6 w-full mb-6 mt-2">
                    <TouchableOpacity
                      onPress={() => setActiveTab(1)}
                      style={{
                        paddingBottom: 8,
                        borderBottomWidth: activeTab === 1 ? 2 : 0,
                        borderBottomColor: primary,
                      }}>
                      <Text
                        className="text-lg font-bold"
                        style={{color: activeTab === 1 ? primary : (mode === 'dark' ? '#999' : '#666')}}>
                        Video
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveTab(2)}
                      style={{
                        paddingBottom: 8,
                        borderBottomWidth: activeTab === 2 ? 2 : 0,
                        borderBottomColor: primary,
                      }}>
                      <Text
                        className="text-lg font-bold"
                        style={{color: activeTab === 2 ? primary : (mode === 'dark' ? '#999' : '#666')}}>
                        Subtitles
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {loading ? (
                  Array.from({length: 4}).map((_, index) => (
                    <SkeletonLoader
                      key={index}
                      width={Dimensions.get('window').width - 30}
                      height={35}
                      marginVertical={5}
                    />
                  ))
                ) : activeTab === 1 ? (
                  data.map(item => (
                    <View
                      key={item.link}
                      className="p-3 bg-black/5 dark:bg-white/10 rounded-lg my-1 flex-row justify-between items-center"
                      style={{borderColor: primary + '40', borderWidth: 1}}>
                      <TouchableOpacity
                        className="flex-1"
                        onPress={() => {
                          onPressVideo(item);
                          setModal(false);
                        }}>
                        <View>
                          <Text className="text-black dark:text-white text-lg font-bold capitalize">
                            {item.server}
                          </Text>
                          <Text className="text-black/60 dark:text-white/60 text-xs">
                            Source: {item.type?.toUpperCase() || 'Direct'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <View className="flex-row gap-x-3 items-center">
                        <TouchableOpacity
                          onPress={() => {
                            Clipboard.setString(item.link);
                            show('Link copied', 'success');
                            if (settingsStorage.isHapticFeedbackEnabled()) {
                              RNReactNativeHapticFeedback.trigger(
                                'effectTick',
                                {
                                  enableVibrateFallback: true,
                                  ignoreAndroidSystemSettings: false,
                                },
                              );
                            }
                          }}>
                          <MaterialIcons
                            name="content-copy"
                            size={22}
                            color={primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            onPressVideo(item);
                            setModal(false);
                          }}
                          className="bg-black/5 dark:bg-white/10 p-2 rounded-full">
                          <MaterialIcons
                            name="file-download"
                            size={22}
                            color={mode === 'dark' ? 'white' : 'black'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : allSubtitles.length > 0 ? (
                  allSubtitles.map((item, index) => (
                    <TouchableOpacity
                      className="p-2 bg-black/5 dark:bg-white/10 rounded-md my-1"
                      key={item.uri + index}
                      onLongPress={() => {
                        if (settingsStorage.isHapticFeedbackEnabled()) {
                          RNReactNativeHapticFeedback.trigger('effectTick', {
                            enableVibrateFallback: true,
                            ignoreAndroidSystemSettings: false,
                          });
                        }
                        Clipboard.setString(item.uri);
                        show('Link copied', 'success');
                      }}
                      onPress={() => {
                        onPressSubs({
                          server: 'Subtitles',
                          link: item.uri,
                          type:
                            item.type === TextTrackType.VTT ? 'vtt' : 'srt',
                          title: item.title,
                        });
                        setModal(false);
                      }}>
                      <Text className="text-black dark:text-white">
                        {item.language}
                        {' - '} {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : null}
                {data.length === 0 && !loading && (
                  <Text className="text-red-500 text-lg text-center">
                    {error || 'No server found'}
                  </Text>
                )}
              </BottomSheetScrollView>
            </View>
          </BottomSheet>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default DownloadBottomSheet;

