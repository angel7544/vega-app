import {
  View,
  Text,
  TouchableNativeFeedback,
  Linking,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import React, {useState} from 'react';
import {Feather} from '@expo/vector-icons';
import {settingsStorage} from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import * as Application from 'expo-application';
import {notificationService} from '../../lib/services/Notification';
import useToastStore from '../../lib/zustand/toastStore';
import UpdateModal from '../../components/UpdateModal';

// download update
const downloadUpdate = async (url: string, name: string) => {
  console.log('downloading', url, name);
  await notificationService.requestPermission();

  try {
    if (await RNFS.exists(`${RNFS.DownloadDirectoryPath}/${name}`)) {
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: 'Download Completed',
        body: 'Tap to install',
        data: {name: `${name}`, action: 'install'},
      });
      return;
    }
  } catch (error) {}
  const {promise} = RNFS.downloadFile({
    fromUrl: url,
    background: true,
    progressInterval: 1000,
    progressDivider: 1,
    toFile: `${RNFS.DownloadDirectoryPath}/${name}`,
    begin: res => {
      console.log('begin', res.jobId, res.statusCode, res.headers);
    },
    progress: res => {
      console.log('progress', res.bytesWritten, res.contentLength);
      notificationService.showUpdateProgress(
        'Downloading Update',
        `Version ${Application.nativeApplicationVersion} -> ${name}`,
        {
          current: res.bytesWritten,
          max: res.contentLength,
          indeterminate: false,
        },
      );
    },
  });
  promise.then(async res => {
    if (res.statusCode === 200) {
      await notificationService.cancelNotification('updateProgress');
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: 'Download Complete',
        body: 'Tap to install',
        data: {name, action: 'install'},
      });
    }
  });
};

// handle check for update
export const checkForUpdate = async (
  setUpdateLoading: React.Dispatch<React.SetStateAction<boolean>>,
  onUpdateFound?: (data: any) => void,
  showToast: boolean = true,
) => {
  setUpdateLoading(true);
  const toast = useToastStore.getState();
  try {
    const res = await fetch(
      'https://api.github.com/repos/Zenda-Cross/vega-app/releases/latest',
    );
    const data = await res.json();
    const localVersion = Application.nativeApplicationVersion;
    if (compareVersions(localVersion || '', data.tag_name.replace('v', ''))) {
      if (onUpdateFound) {
        onUpdateFound(data);
      } else {
        toast.show('New update available', 'info');
        Alert.alert(`Update v${localVersion} -> ${data.tag_name}`, data.body, [
          {text: 'Cancel'},
          {
            text: 'Update',
            onPress: () => Linking.openURL(data.html_url),
          },
        ]);
      }
    } else {
      showToast && toast.show('App is up to date', 'success');
    }
  } catch (error) {
    toast.show('Failed to check for update', 'error');
    console.log('Update error', error);
  }
  setUpdateLoading(false);
};

const About = () => {
  const {primary, mode} = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState<boolean>(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );

  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateData, setUpdateData] = useState<any>(null);

  const handleUpdatePress = () => {
    checkForUpdate(
      setUpdateLoading,
      data => {
        setUpdateData(data);
        setUpdateModalVisible(true);
      },
      true,
    );
  };

  return (
    <View className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-white'} mt-8`}>
      <View className={`px-4 py-3 border-b ${mode === 'dark' ? 'border-white/10' : 'border-black/5'}`}>
        <Text className={`text-2xl font-bold ${mode === 'dark' ? 'text-white' : 'text-black'}`}>About</Text>
        <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} mt-1 text-sm`}>
          App information and updates
        </Text>
      </View>

      <ScrollView className="p-4 space-y-4 pb-24">
        {/* Version */}
        <View className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-4 rounded-lg flex-row justify-between items-center mb-4`}>
          <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Version</Text>
          <Text className={mode === 'dark' ? 'text-white/70' : 'text-black/70'}>
            v{Application.nativeApplicationVersion}
          </Text>
        </View>

        {/* Auto Install Updates */}
        <View className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-4 rounded-lg flex-row justify-between items-center mb-4`}>
          <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Auto Install Updates</Text>
          <Switch
            value={autoDownload}
            onValueChange={() => {
              setAutoDownload(!autoDownload);
              settingsStorage.setAutoDownloadEnabled(!autoDownload);
            }}
            thumbColor={autoDownload ? primary : 'gray'}
          />
        </View>

        {/* Auto Check Updates */}
        <View className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-3 rounded-lg flex-row justify-between items-center mb-4`}>
          <View className="flex-1 mr-2">
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Check Updates on Start</Text>
            <Text className={mode === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              Automatically check for updates when app starts
            </Text>
          </View>
          <Switch
            value={autoCheckUpdate}
            onValueChange={() => {
              setAutoCheckUpdate(!autoCheckUpdate);
              settingsStorage.setAutoCheckUpdateEnabled(!autoCheckUpdate);
            }}
            thumbColor={autoCheckUpdate ? primary : 'gray'}
          />
        </View>

        {/* Check Updates Button */}
        <TouchableNativeFeedback
          onPress={handleUpdatePress}
          disabled={updateLoading}
          background={TouchableNativeFeedback.Ripple(mode === 'dark' ? '#ffffff20' : '#00000010', false)}>
          <View className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-4 rounded-lg flex-row justify-between items-center mt-4`}>
            <View className="flex-row items-center space-x-3">
              <MaterialCommunityIcons name="cloud-refresh" size={22} color={mode === 'dark' ? 'white' : 'black'} />
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Check for Updates</Text>
            </View>
            <Feather name="chevron-right" size={20} color={mode === 'dark' ? 'white' : 'black'} />
          </View>
        </TouchableNativeFeedback>

        {/* Developer Section */}
        <View className={`mt-8 border-t ${mode === 'dark' ? 'border-white/10' : 'border-black/5'} pt-6`}>
          <Text className="text-gray-400 uppercase text-xs font-bold mb-4 tracking-widest">
            Developed By
          </Text>
          
          <View className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-4 rounded-2xl mb-4`}>
            <View className="flex-row items-center mb-4">
              <View className="w-12 h-12 bg-primary/20 rounded-full items-center justify-center mr-4">
                <MaterialCommunityIcons name="code-braces" size={24} color={primary} />
              </View>
              <View>
                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-bold text-lg`}>br31tech.live</Text>
                <Text className={mode === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Digital Solutions & Innovation</Text>
              </View>
            </View>
            
            <Text className={`${mode === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-sm leading-5 mb-4`}>
              Crafted with ❤️ by the team at BR31 Technologies. We specialize in building high-performance digital experiences.
            </Text>

            <View className="flex-row space-x-3">
              <TouchableNativeFeedback
                onPress={() => Linking.openURL('https://www.br31tech.live')}
                background={TouchableNativeFeedback.Ripple(mode === 'dark' ? '#ffffff20' : '#00000010', false)}>
                <View className={`${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'} flex-1 py-3 rounded-xl items-center justify-center flex-row`}>
                  <Feather name="globe" size={16} color={mode === 'dark' ? 'white' : 'black'} className="mr-2" />
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-sm font-medium`}>Website</Text>
                </View>
              </TouchableNativeFeedback>
              
              <TouchableNativeFeedback
                onPress={() => Linking.openURL('mailto:info@br31tech.live')}
                background={TouchableNativeFeedback.Ripple(mode === 'dark' ? '#ffffff20' : '#00000010', false)}>
                <View className={`${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'} flex-1 py-3 rounded-xl items-center justify-center flex-row`}>
                  <Feather name="mail" size={16} color={mode === 'dark' ? 'white' : 'black'} className="mr-2" />
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-sm font-medium`}>Contact</Text>
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>

          <Text className="text-gray-500 text-[10px] text-center mt-4">
            © 2026 BR31 Technologies • All Rights Reserved
          </Text>
        </View>
      </ScrollView>

      {updateData && (
        <UpdateModal
          visible={updateModalVisible}
          version={updateData.tag_name}
          releaseNotes={updateData.body}
          primary={primary}
          onCancel={() => setUpdateModalVisible(false)}
          onUpdate={() => {
            setUpdateModalVisible(false);
            autoDownload
              ? downloadUpdate(
                  updateData?.assets?.[2]?.browser_download_url,
                  updateData.assets?.[2]?.name,
                )
              : Linking.openURL(updateData.html_url);
          }}
        />
      )}
    </View>
  );
};

export default About;

function compareVersions(localVersion: string, remoteVersion: string): boolean {
  try {
    // Split versions into arrays and convert to numbers
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    // Compare major version
    if (remote[0] > local[0]) {
      return true;
    }
    if (remote[0] < local[0]) {
      return false;
    }

    // Compare minor version
    if (remote[1] > local[1]) {
      return true;
    }
    if (remote[1] < local[1]) {
      return false;
    }

    // Compare patch version
    if (remote[2] > local[2]) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Invalid version format');
    return false;
  }
}

