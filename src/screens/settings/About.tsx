import {
  View,
  Text,
  Linking,
  Alert,
  Switch,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import React, {useState} from 'react';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {settingsStorage} from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import useThemeStore from '../../lib/zustand/themeStore';
import * as Application from 'expo-application';
import {notificationService} from '../../lib/services/Notification';
import useToastStore from '../../lib/zustand/toastStore';
import UpdateModal from '../../components/UpdateModal';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

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
  const {width: windowWidth} = useWindowDimensions();
  const navigation = useNavigation();
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

  const OptionCard = ({ icon, label, subLabel, value, onToggle, onPress, delay }: any) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity 
        activeOpacity={onPress ? 0.7 : 1}
        onPress={onPress}
        className={`${mode === 'dark' ? 'bg-[#121212]' : 'bg-gray-100'} rounded-2xl p-4 mb-4 border ${mode === 'dark' ? 'border-white/5' : 'border-black/5'} flex-row items-center justify-between shadow-sm`}
      >
        <View className="flex-row items-center flex-1">
          <View style={{ backgroundColor: `${primary}15` }} className="w-10 h-10 rounded-xl items-center justify-center mr-4">
             <MaterialCommunityIcons name={icon} size={22} color={primary} />
          </View>
          <View className="flex-1">
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-bold text-base`}>{label}</Text>
            {subLabel && <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-xs mt-0.5`}>{subLabel}</Text>}
          </View>
        </View>
        {onToggle ? (
          <Switch
            value={value}
            onValueChange={onToggle}
            thumbColor={value ? primary : '#666'}
            trackColor={{ false: '#333', true: `${primary}50` }}
          />
        ) : onPress ? (
          <Feather name="chevron-right" size={20} color={mode === 'dark' ? '#555' : '#AAA'} />
        ) : (
          <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} font-black text-sm`}>{value}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
      {/* Premium Header */}
      <View className={`px-6 pt-12 pb-6 flex-row items-center justify-between border-b ${mode === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
         <View className="flex-row items-center">
            <TouchableOpacity
               onPress={() => navigation.goBack()}
               className={`w-10 h-10 rounded-full items-center justify-center ${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} mr-4`}>
               <Feather
                  name="chevron-left"
                  size={24}
                  color={mode === 'dark' ? 'white' : 'black'}
               />
            </TouchableOpacity>
            <Text
               className={`text-2xl font-black ${
                  mode === 'dark' ? 'text-white' : 'text-black'
               }`}>
               About
            </Text>
         </View>
         <MaterialCommunityIcons name="information-outline" size={24} color={primary} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 60, paddingTop: 24, paddingHorizontal: 20}}
      >
        {/* App Logo & Info Area */}
        <Animated.View entering={FadeInDown.delay(100).springify()} className="items-center mb-10">
           <View className="relative">
              <View style={{ backgroundColor: primary, opacity: 0.1 }} className="absolute -inset-4 rounded-[32px] blur-2xl" />
              <Image 
                source={{ uri: 'https://br31tech.live/logo.png' }}
                style={{ width: 100, height: 100, borderRadius: 24 }}
                resizeMode="contain"
              />
           </View>
           <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-black text-3xl mt-6 tracking-tighter`}>VEGA APP</Text>
           <View className="bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 mt-3">
              <Text className="text-primary font-black uppercase text-[10px] tracking-[3px]">Orbix Edition</Text>
           </View>
        </Animated.View>

        {/* Info Sections */}
        <OptionCard 
           icon="identifier" 
           label="Version" 
           value={`v${Application.nativeApplicationVersion}`} 
           delay={200}
        />
        
        <OptionCard 
           icon="auto-fix" 
           label="Auto Install Updates" 
           subLabel="Efficient background deployment"
           value={autoDownload}
           onToggle={() => {
              setAutoDownload(!autoDownload);
              settingsStorage.setAutoDownloadEnabled(!autoDownload);
           }}
           delay={300}
        />

        <OptionCard 
           icon="sync-alert" 
           label="Check on Startup" 
           subLabel="Stay ahead with real-time sync"
           value={autoCheckUpdate}
           onToggle={() => {
              setAutoCheckUpdate(!autoCheckUpdate);
              settingsStorage.setAutoCheckUpdateEnabled(!autoCheckUpdate);
           }}
           delay={400}
        />

        <OptionCard 
           icon="cloud-refresh" 
           label="Check for Updates" 
           subLabel="Verify latest version manually"
           onPress={handleUpdatePress}
           delay={500}
        />

        {/* Developer Branding Section */}
        <Animated.View entering={FadeInDown.delay(600).springify()} className="mt-10">
           <Text className="text-gray-500 font-black uppercase tracking-[4px] text-[10px] mb-6 text-center">Development Powerhouse</Text>
           
           <View className={`${mode === 'dark' ? 'bg-[#0A0A0A]' : 'bg-gray-100'} p-6 rounded-[32px] border ${mode === 'dark' ? 'border-white/5' : 'border-black/5'} overflow-hidden`}>
              <LinearGradient
                colors={['transparent', mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)']}
                className="absolute inset-0"
              />
              <View className="flex-row items-center mb-6">
                <Image 
                  source={{ uri: 'https://br31tech.live/logo.png' }}
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                />
                <View className="ml-4">
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-black text-lg tracking-tight`}>BR31 TECHNOLOGIES</Text>
                  <Text className="text-primary font-bold text-[10px] uppercase tracking-widest">Digital Excellence</Text>
                </View>
              </View>

              <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} text-xs leading-5 mb-8 font-medium`}>
                 Dedicated to refining the global streaming landscape through innovative pipelines and state-of-the-art UI architectures.
              </Text>

              <View className="flex-row space-x-3">
                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://www.br31tech.live')}
                  className="flex-1 bg-white/[0.03] border border-white/5 py-4 rounded-2xl items-center flex-row justify-center"
                >
                   <Feather name="globe" size={14} color={primary} />
                   <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} ml-2 font-bold text-xs uppercase tracking-widest`}>Portal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                   onPress={() => Linking.openURL('mailto:info@br31tech.live')}
                   className="flex-1 bg-white/[0.03] border border-white/5 py-4 rounded-2xl items-center flex-row justify-center"
                >
                   <Feather name="mail" size={14} color={primary} />
                   <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} ml-2 font-bold text-xs uppercase tracking-widest`}>Support</Text>
                </TouchableOpacity>
              </View>
           </View>

           <Text className="text-gray-600 text-[9px] font-black text-center mt-8 uppercase tracking-[2px] opacity-40">
              Orbix Pipeline • v{Application.nativeApplicationVersion} • Built with Passion
           </Text>
        </Animated.View>
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

