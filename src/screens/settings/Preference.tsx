import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
import React, {useState} from 'react';
import {settingsStorage} from '../../lib/storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../../lib/zustand/themeStore';
import {Dropdown} from 'react-native-element-dropdown';
import {themes, EPG_SOURCES} from '../../lib/constants';
import Constants from 'expo-constants';
import useToastStore from '../../lib/zustand/toastStore';
import usePlayerStore, { DEFAULT_EPG_REPO } from '../../lib/zustand/playerStore';
import {iptvParser} from '../../lib/iptvParser';


// Lazy-load Firebase to allow running without google-services.json
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAnalytics = (): any | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-firebase/analytics').default;
  } catch {
    return null;
  }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCrashlytics = (): any | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-firebase/crashlytics').default;
  } catch {
    return null;
  }
};

const Preferences = () => {
  const hasFirebase = Boolean(Constants?.expoConfig?.extra?.hasFirebase);
  const {primary, setPrimary, isCustom, setCustom, mode} = useThemeStore(
    state => state,
  );
  const {show} = useToastStore();
  const [showRecentlyWatched, setShowRecentlyWatched] = useState(
    settingsStorage.getBool('showRecentlyWatched') || false,
  );
  const [disableDrawer, setDisableDrawer] = useState(
    settingsStorage.getBool('disableDrawer') || false,
  );

  const [ExcludedQualities, setExcludedQualities] = useState(
    settingsStorage.getExcludedQualities(),
  );

  const [customColor, setCustomColor] = useState(
    settingsStorage.getCustomColor(),
  );

  const [showMediaControls, setShowMediaControls] = useState<boolean>(
    settingsStorage.showMediaControls(),
  );

  const [showHamburgerMenu, setShowHamburgerMenu] = useState<boolean>(
    settingsStorage.showHamburgerMenu(),
  );

  const [hideSeekButtons, setHideSeekButtons] = useState<boolean>(
    settingsStorage.hideSeekButtons(),
  );

  const [_enable2xGesture, _setEnable2xGesture] = useState<boolean>(
    settingsStorage.isEnable2xGestureEnabled(),
  );

  const [enableSwipeGesture, setEnableSwipeGesture] = useState<boolean>(
    settingsStorage.isSwipeGestureEnabled(),
  );

  const [showTabBarLables, setShowTabBarLables] = useState<boolean>(
    settingsStorage.showTabBarLabels(),
  );

  const [OpenExternalPlayer, setOpenExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false),
  );

  const [hapticFeedback, setHapticFeedback] = useState(
    settingsStorage.isHapticFeedbackEnabled(),
  );

  const [alwaysUseExternalDownload, setAlwaysUseExternalDownload] = useState(
    settingsStorage.getBool('alwaysExternalDownloader') || false,
  );

  const [showDownloadButtonOnCards, setShowDownloadButtonOnCards] = useState(
    settingsStorage.getBool('showDownloadButtonOnCards', false),
  );

  const [telemetryOptIn, setTelemetryOptIn] = useState<boolean>(
    settingsStorage.isTelemetryOptIn(),
  );
  
  const [tmdbApiKey, setTmdbApiKey] = useState(settingsStorage.getTmdbApiKey());
  const [tmdbReadToken, setTmdbReadToken] = useState(settingsStorage.getTmdbReadToken());
  const [iptvCountry, setIptvCountry] = useState(settingsStorage.getIptvCountry());
  const [iptvLanguage, setIptvLanguage] = useState(settingsStorage.getIptvLanguage());
  const [useExternalPlayerLive, setUseExternalPlayerLive] = useState(
    settingsStorage.useExternalPlayerLive(),
  );
  const [initialHomeScreen, setInitialHomeScreen] = useState(
    settingsStorage.getInitialHomeScreen(),
  );

  const { 
    disableEpg, 
    toggleDisableEpg, 
    autoPlayChannel, 
    toggleAutoPlayChannel,
    customEpgUrl,
    setCustomEpgUrl,
    epgRepoUrl,
    setEpgRepoUrl
  } = usePlayerStore();

  const [tempEpgUrl, setTempEpgUrl] = useState(customEpgUrl || '');
  const [tempRepoUrl, setTempRepoUrl] = useState(epgRepoUrl || '');

  // ... rest of the component

  const countries = [
    { label: 'India', value: 'in' },
    { label: 'USA', value: 'us' },
    { label: 'UK', value: 'uk' },
    { label: 'Canada', value: 'ca' },
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Italy', value: 'it' },
    { label: 'Spain', value: 'es' },
  ];

  const languages = [
    { label: 'All', value: 'all' },
    { label: 'English', value: 'eng' },
    { label: 'Hindi', value: 'hin' },
    { label: 'Tamil', value: 'tam' },
    { label: 'Telugu', value: 'tel' },
    { label: 'Malayalam', value: 'mal' },
    { label: 'Kannada', value: 'kan' },
    { label: 'Spanish', value: 'spa' },
    { label: 'French', value: 'fra' },
  ];

  return (
    <ScrollView
      className={`w-full h-full ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}
      contentContainerStyle={{
        paddingTop: StatusBar.currentHeight || 0,
      }}>
      <View className="p-5">
        <Text className={`text-2xl font-bold ${mode === 'dark' ? 'text-white' : 'text-black'} mb-6`}>Preferences</Text>

        {/* Theme Section */}
        <View className="mb-6">
          <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3`}>Appearance</Text>
          <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
            {/* Theme Selector */}
            <View className={`flex-row items-center px-4 justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Theme</Text>
              <View className="w-36">
                {isCustom ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      style={{
                        color: mode === 'dark' ? 'white' : 'black',
                        backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        fontSize: 14,
                      }}
                      placeholder="Hex Color"
                      placeholderTextColor="gray"
                      value={customColor}
                      onChangeText={setCustomColor}
                      onSubmitEditing={e => {
                        if (e.nativeEvent.text.length < 7) {
                          show(
                            'Invalid Color',
                            'error',
                          );
                          return;
                        }
                        settingsStorage.setCustomColor(e.nativeEvent.text);
                        setPrimary(e.nativeEvent.text);
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setCustom(false);
                        setPrimary('#FF6347');
                      }}>
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color="gray"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Dropdown
                    selectedTextStyle={{
                      color: mode === 'dark' ? 'white' : 'black',
                      fontSize: 14,
                      fontWeight: '500',
                    }}
                    containerStyle={{
                      backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                      borderRadius: 8,
                      borderWidth: 0,
                      marginTop: 4,
                    }}
                    itemTextStyle={{color: mode === 'dark' ? 'white' : 'black'}}
                    activeColor={mode === 'dark' ? '#3A3A3A' : '#D1D5DB'}
                    itemContainerStyle={{
                      backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                      borderWidth: 0,
                    }}
                    style={{
                      backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                      borderWidth: 0,
                    }}
                    iconStyle={{tintColor: mode === 'dark' ? 'white' : 'black'}}
                    placeholderStyle={{color: mode === 'dark' ? 'white' : 'gray'}}
                    labelField="name"
                    valueField="color"
                    data={themes}
                    value={primary}
                    onChange={value => {
                      if (value.name === 'Custom') {
                        setCustom(true);
                        setPrimary(customColor);
                        return;
                      }
                      setPrimary(value.color);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Haptic Feedback */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Haptic Feedback</Text>
              <Switch
                thumbColor={hapticFeedback ? primary : 'gray'}
                value={hapticFeedback}
                onValueChange={() => {
                  settingsStorage.setHapticFeedbackEnabled(!hapticFeedback);
                  setHapticFeedback(!hapticFeedback);
                }}
              />
            </View>

            {/* Analytics & Crashlytics Opt-In */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                Usage & Crash Reports
              </Text>
              <Switch
                thumbColor={telemetryOptIn ? primary : 'gray'}
                value={telemetryOptIn}
                onValueChange={async () => {
                  const next = !telemetryOptIn;
                  setTelemetryOptIn(next);
                  settingsStorage.setTelemetryOptIn(next);
                  if (hasFirebase) {
                    try {
                      const crashlytics = getCrashlytics();
                      crashlytics &&
                        (await crashlytics().setCrashlyticsCollectionEnabled(
                          next,
                        ));
                    } catch {}
                    try {
                      const analytics = getAnalytics();
                      analytics &&
                        (await analytics().setAnalyticsCollectionEnabled(next));
                      // Also update consent for completeness
                      analytics &&
                        (await analytics().setConsent({
                          analytics_storage: next,
                          ad_storage: next,
                          ad_user_data: next,
                          ad_personalization: next,
                        }));
                    } catch {}
                  }
                }}
              />
            </View>

            {/* Show Tab Bar Labels */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Show Tab Bar Labels</Text>
              <Switch
                thumbColor={showTabBarLables ? primary : 'gray'}
                value={showTabBarLables}
                onValueChange={() => {
                  settingsStorage.setShowTabBarLabels(!showTabBarLables);
                  setShowTabBarLables(!showTabBarLables);
                  show(
                    'Restart App to Apply Changes',
                    'info',
                  );
                }}
              />
            </View>

            {/* Show Hamburger Menu */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Show Hamburger Menu</Text>
              <Switch
                thumbColor={showHamburgerMenu ? primary : 'gray'}
                value={showHamburgerMenu}
                onValueChange={() => {
                  settingsStorage.setShowHamburgerMenu(!showHamburgerMenu);
                  setShowHamburgerMenu(!showHamburgerMenu);
                }}
              />
            </View>

            {/* Show Recently Watched */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                Show Recently Watched
              </Text>
              <Switch
                thumbColor={showRecentlyWatched ? primary : 'gray'}
                value={showRecentlyWatched}
                onValueChange={() => {
                  settingsStorage.setBool(
                    'showRecentlyWatched',
                    !showRecentlyWatched,
                  );
                  setShowRecentlyWatched(!showRecentlyWatched);
                }}
              />
            </View>

            {/* Disable Drawer */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Disable Drawer</Text>
              <Switch
                thumbColor={disableDrawer ? primary : 'gray'}
                value={disableDrawer}
                onValueChange={() => {
                  settingsStorage.setBool('disableDrawer', !disableDrawer);
                  setDisableDrawer(!disableDrawer);
                }}
              />
            </View>

            {/* Show Download Button on Cards */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                Show Download Button on Cards
              </Text>
              <Switch
                thumbColor={showDownloadButtonOnCards ? primary : 'gray'}
                value={showDownloadButtonOnCards}
                onValueChange={() => {
                  settingsStorage.setBool(
                    'showDownloadButtonOnCards',
                    !showDownloadButtonOnCards,
                  );
                  setShowDownloadButtonOnCards(!showDownloadButtonOnCards);
                }}
              />
            </View>

            {/* Initial Home Screen Selector */}
            <View className={`flex-row items-center px-4 justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Startup Screen</Text>
              <View className="w-36">
                <Dropdown
                  selectedTextStyle={{
                    color: mode === 'dark' ? 'white' : 'black',
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                  containerStyle={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderRadius: 8,
                    borderWidth: 0,
                  }}
                  itemTextStyle={{color: mode === 'dark' ? 'white' : 'black'}}
                  activeColor={mode === 'dark' ? '#3A3A3A' : '#D1D5DB'}
                  itemContainerStyle={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                  }}
                  style={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderWidth: 0,
                  }}
                  iconStyle={{tintColor: mode === 'dark' ? 'white' : 'black'}}
                  labelField="label"
                  valueField="value"
                  data={[
                    { label: 'Default Home', value: 'HomeStack' },
                    { label: 'Live TV', value: 'LiveTVStack' }
                  ]}
                  value={initialHomeScreen}
                  onChange={item => {
                    settingsStorage.setInitialHomeScreen(item.value);
                    setInitialHomeScreen(item.value);
                    show('Restart app for best experience', 'info');
                  }}
                />
              </View>
            </View>

            {/* Always Use External Downloader */}
            <View className="flex-row items-center justify-between p-4">
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base flex-1`}>
                Always Use External Downloader
              </Text>
              <Switch
                thumbColor={alwaysUseExternalDownload ? primary : 'gray'}
                value={alwaysUseExternalDownload}
                onValueChange={() => {
                  settingsStorage.setBool(
                    'alwaysExternalDownloader',
                    !alwaysUseExternalDownload,
                  );
                  setAlwaysUseExternalDownload(!alwaysUseExternalDownload);
                }}
              />
            </View>
          </View>
        </View>

        {/* TMDb Settings */}
        <View className="mb-6">
          <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3`}>TMDb API (Enhanced Metadata)</Text>
          <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl overflow-hidden p-4`}>
            <View className="mb-4">
              <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-xs mb-1 uppercase font-bold`}>API Key (v3)</Text>
              <TextInput
                  style={{
                    color: mode === 'dark' ? 'white' : 'black',
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 13,
                    borderWidth: 1,
                    borderColor: mode === 'dark' ? '#333' : '#ddd',
                  }}
                  placeholder="Enter TMDb API Key"
                  placeholderTextColor="gray"
                  value={tmdbApiKey}
                  onChangeText={setTmdbApiKey}
                  onBlur={() => {
                    settingsStorage.setTmdbApiKey(tmdbApiKey);
                    show('TMDb API Key Updated', 'success');
                  }}
              />
            </View>
            <View>
              <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-xs mb-1 uppercase font-bold`}>Read Access Token (v4)</Text>
              <TextInput
                  style={{
                    color: mode === 'dark' ? 'white' : 'black',
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 12,
                    height: 80,
                    textAlignVertical: 'top',
                    borderWidth: 1,
                    borderColor: mode === 'dark' ? '#333' : '#ddd',
                  }}
                  multiline
                  placeholder="Enter TMDb Read Access Token"
                  placeholderTextColor="gray"
                  value={tmdbReadToken}
                  onChangeText={setTmdbReadToken}
                  onBlur={() => {
                    settingsStorage.setTmdbReadToken(tmdbReadToken);
                    show('TMDb Token Updated', 'success');
                  }}
              />
            </View>
            <Text className={`${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'} text-[10px] mt-3 leading-4`}>
              TMDb API provides enhanced ratings, movie details, and high-quality posters. 
              Get your personal keys at common.themoviedb.org
            </Text>
          </View>
        </View>

        {/* Live TV Settings */}
        <View className="mb-6">
          <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3`}>Live TV</Text>
          <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
            {/* Country Selector */}
            <View className={`flex-row items-center px-4 justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Country</Text>
              <View className="w-36">
                <Dropdown
                  selectedTextStyle={{
                    color: mode === 'dark' ? 'white' : 'black',
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                  containerStyle={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderRadius: 8,
                    borderWidth: 0,
                  }}
                  itemTextStyle={{color: mode === 'dark' ? 'white' : 'black'}}
                  activeColor={mode === 'dark' ? '#3A3A3A' : '#D1D5DB'}
                  itemContainerStyle={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                  }}
                  style={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderWidth: 0,
                  }}
                  iconStyle={{tintColor: mode === 'dark' ? 'white' : 'black'}}
                  labelField="label"
                  valueField="value"
                  data={countries}
                  value={iptvCountry}
                  onChange={item => {
                    settingsStorage.setIptvCountry(item.value);
                    setIptvCountry(item.value);
                    show('Restart Live TV to apply', 'info');
                  }}
                />
              </View>
            </View>

            {/* Language Selector */}
            <View className={`flex-row items-center px-4 justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Language</Text>
              <View className="w-36">
                <Dropdown
                  selectedTextStyle={{
                    color: mode === 'dark' ? 'white' : 'black',
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                  containerStyle={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderRadius: 8,
                    borderWidth: 0,
                  }}
                  itemTextStyle={{color: mode === 'dark' ? 'white' : 'black'}}
                  activeColor={mode === 'dark' ? '#3A3A3A' : '#D1D5DB'}
                  itemContainerStyle={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                  }}
                  style={{
                    backgroundColor: mode === 'dark' ? '#262626' : '#E5E7EB',
                    borderWidth: 0,
                  }}
                  iconStyle={{tintColor: mode === 'dark' ? 'white' : 'black'}}
                  labelField="label"
                  valueField="value"
                  data={languages}
                  value={iptvLanguage}
                  onChange={item => {
                    settingsStorage.setIptvLanguage(item.value);
                    setIptvLanguage(item.value);
                    show('Restart Live TV to apply', 'info');
                  }}
                />
              </View>
            </View>

            {/* External Player Live toggle */}
            <View className="flex-row items-center justify-between p-4">
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base flex-1`}>
                Always Use External Player (Live)
              </Text>
              <Switch
                thumbColor={useExternalPlayerLive ? primary : 'gray'}
                value={useExternalPlayerLive}
                onValueChange={val => {
                  settingsStorage.setUseExternalPlayerLive(val);
                  setUseExternalPlayerLive(val);
                }}
              />
            </View>

            {/* Auto Play Channel Toggle */}
            <View className={`flex-row items-center px-4 justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <View className="flex-1 mr-4">
                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                  Auto Play Live TV
                </Text>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Start playback immediately upon tuning in
                </Text>
              </View>
              <Switch
                thumbColor={autoPlayChannel ? primary : 'gray'}
                value={autoPlayChannel || false}
                onValueChange={toggleAutoPlayChannel}
              />
            </View>

            {/* Global Disable EPG Toggle */}
            <View className="flex-row items-center justify-between p-4 bg-orange-500/5">
              <View className="flex-1 mr-4">
                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                  Disable EPG Schedule
                </Text>
                <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                  Reduces lag by disabling program data sync
                </Text>
              </View>
              <Switch
                thumbColor={disableEpg ? primary : 'gray'}
                value={disableEpg || false}
                onValueChange={toggleDisableEpg}
              />
            </View>
          </View>
        </View>

        {/* EPG Configuration Section */}
        <View className="mb-6">
          <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3 uppercase font-bold tracking-widest ml-1`}>EPG Configuration</Text>
          <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl overflow-hidden p-4`}>
            
            <View className="mb-4">
              <TouchableOpacity
                 onPress={() => {
                    iptvParser.clearCache();
                    show('EPG Cache Cleared & Synced', 'success');
                 }}
                 className="w-full bg-primary/20 border border-primary/40 py-3 rounded-xl items-center flex-row justify-center shadow-sm"
              >
                 <MaterialCommunityIcons name="sync" size={18} color={primary} />
                 <Text style={{ color: primary }} className="font-black text-xs uppercase tracking-widest ml-2">Force EPG Data Sync</Text>
              </TouchableOpacity>
              <Text className={`${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'} text-[10px] mt-2 leading-4 text-center px-4`}>
                 Clears memory and forces a fresh download of TV guide schedules. Use if channels say "No schedule".
              </Text>
            </View>

            <View className="h-[1px] bg-white/5 my-2 mb-4" />

            {/* Custom EPG URL Input */}
            <View className="mb-4">
              <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-[10px] mb-2 uppercase font-black tracking-widest ml-1`}>Custom EPG Source URL (XML)</Text>
              <View className="flex-row items-center bg-white/5 border border-white/10 rounded-xl pr-2 focus:border-white/30">
                 <TextInput 
                    className={`flex-1 ${mode === 'dark' ? 'text-white' : 'text-black'} px-4 py-3 min-h-[48px] text-sm`}
                    placeholder="https://example.com/epg.xml"
                    placeholderTextColor="gray"
                    value={tempEpgUrl}
                    onChangeText={setTempEpgUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                 />
                 <TouchableOpacity
                    onPress={() => {
                    if (!tempEpgUrl) {
                      setCustomEpgUrl(null);
                      show('EPG Reset to Default', 'success');
                      return;
                    }
                      setCustomEpgUrl(tempEpgUrl || null);
                      show('EPG Source Updated', 'success');
                    }}
                    style={{ backgroundColor: primary }}
                    className="px-4 py-2 rounded-lg"
                 >
                    <Text className="text-white font-bold text-xs uppercase">{tempEpgUrl === customEpgUrl && tempEpgUrl ? 'Active' : 'Save'}</Text>
                 </TouchableOpacity>
              </View>
            </View>

            {/* JSON EPG Data Repository Selector */}
            <View className="mb-4">
              <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-[10px] mb-2 uppercase font-black tracking-widest ml-1`}>JSON EPG Data Repository</Text>
              <View className="flex-row items-center bg-white/5 border border-white/10 rounded-xl pr-2 focus:border-white/30">
                 <TextInput 
                    className={`flex-1 ${mode === 'dark' ? 'text-white' : 'text-black'} px-4 py-3 min-h-[48px] text-sm`}
                    placeholder="https://raw.githubusercontent.com/..."
                    placeholderTextColor="gray"
                    value={tempRepoUrl}
                    onChangeText={setTempRepoUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                 />
                 <TouchableOpacity
                    onPress={() => {
                      if (!tempRepoUrl) {
                        setEpgRepoUrl(DEFAULT_EPG_REPO);
                        setTempRepoUrl(DEFAULT_EPG_REPO);
                        show('EPG Repo Reset to Default', 'success');
                        return;
                      }
                      setEpgRepoUrl(tempRepoUrl);
                      show('EPG Repository Saved', 'success');
                    }}
                    style={{ backgroundColor: primary }}
                    className="px-4 py-2 rounded-lg"
                 >
                    <Text className="text-white font-bold text-xs uppercase">{tempRepoUrl === epgRepoUrl ? 'Active' : 'Save'}</Text>
                 </TouchableOpacity>
              </View>
              {epgRepoUrl !== DEFAULT_EPG_REPO && (
                <TouchableOpacity 
                   className="mt-3 flex-row items-center"
                   onPress={() => { 
                      setEpgRepoUrl(DEFAULT_EPG_REPO); 
                      setTempRepoUrl(DEFAULT_EPG_REPO); 
                      show('EPG Repo Reset to Default', 'info'); 
                    }}
                >
                   <MaterialCommunityIcons name="refresh" size={14} color="#ef4444" />
                   <Text className="text-red-500 text-[10px] font-black uppercase tracking-widest ml-1">Reset to Default JSON Repo</Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="h-[1px] bg-white/5 my-4" />

            {/* Quick Select Preset Sources */}
            <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-[10px] mb-4 uppercase font-black tracking-widest ml-1`}>Quick Select Presets</Text>
            <View className="space-y-2">
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="flex-row"
              >
                {EPG_SOURCES.slice(0, 15).map((preset, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setTempEpgUrl(preset.link);
                      setCustomEpgUrl(preset.link);
                      show(`Selected ${preset.country} EPG`, 'success');
                    }}
                    style={{ 
                      borderColor: customEpgUrl === preset.link ? primary : 'transparent',
                      backgroundColor: customEpgUrl === preset.link ? `${primary}20` : (mode === 'dark' ? '#262626' : '#E5E7EB')
                    }}
                    className="mr-2 px-4 py-3 rounded-xl border items-center justify-center min-w-[100px]"
                  >
                    <Text className="text-2xl mb-1">{preset.flag}</Text>
                    <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-[10px] font-bold text-center`}>{preset.country}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <View className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                 <Text className="text-blue-400 text-[10px] font-bold leading-5">
                   Tip: Choose a preset above for high-speed EPG data suitable for your region. Custom URLs must be direct links to .xml files.
                 </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3`}>Player</Text>
          <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
            {/* External Player */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base flex-1`}>
                Always Use External Player
              </Text>
              <Switch
                thumbColor={OpenExternalPlayer ? primary : 'gray'}
                value={OpenExternalPlayer}
                onValueChange={val => {
                  settingsStorage.setBool('useExternalPlayer', val);
                  setOpenExternalPlayer(val);
                }}
              />
            </View>

            {/* Media Controls */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Media Controls</Text>
              <Switch
                thumbColor={showMediaControls ? primary : 'gray'}
                value={showMediaControls}
                onValueChange={() => {
                  settingsStorage.setShowMediaControls(!showMediaControls);
                  setShowMediaControls(!showMediaControls);
                }}
              />
            </View>

            {/* Hide Seek Buttons */}
            <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>Hide Seek Buttons</Text>
              <Switch
                thumbColor={hideSeekButtons ? primary : 'gray'}
                value={hideSeekButtons}
                onValueChange={() => {
                  settingsStorage.setHideSeekButtons(!hideSeekButtons);
                  setHideSeekButtons(!hideSeekButtons);
                }}
              />
            </View>

            {/* Swipe Gestures */}
            <View className="flex-row items-center justify-between p-4">
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                Enable Swipe Gestures
              </Text>
              <Switch
                thumbColor={enableSwipeGesture ? primary : 'gray'}
                value={enableSwipeGesture}
                onValueChange={() => {
                  settingsStorage.setSwipeGestureEnabled(!enableSwipeGesture);
                  setEnableSwipeGesture(!enableSwipeGesture);
                }}
              />
            </View>
          </View>
        </View>

        {/* Quality Settings */}
        <View className="mb-6">
          <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3`}>Quality</Text>
          <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl p-4`}>
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base mb-3`}>
              Excluded Qualities
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {['360p', '480p', '720p'].map((quality, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    if (settingsStorage.isHapticFeedbackEnabled()) {
                      RNReactNativeHapticFeedback.trigger('effectTick');
                    }
                    const newExcluded = ExcludedQualities.includes(quality)
                      ? ExcludedQualities.filter(q => q !== quality)
                      : [...ExcludedQualities, quality];
                    setExcludedQualities(newExcluded);
                    settingsStorage.setExcludedQualities(newExcluded);
                  }}
                  style={{
                    backgroundColor: ExcludedQualities.includes(quality)
                      ? primary
                      : (mode === 'dark' ? '#262626' : '#E5E7EB'),
                  }}
                  className="px-4 py-2 rounded-lg">
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-sm`}>{quality}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View className="h-16" />
      </View>
    </ScrollView>
  );
};

export default Preferences;
