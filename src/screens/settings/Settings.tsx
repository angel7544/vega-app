import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  TouchableNativeFeedback,
  ScrollView,
  Dimensions,
} from 'react-native';
import React, {useCallback, useMemo} from 'react';
import {
  settingsStorage,
  cacheStorageService,
  ProviderExtension,
} from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import {socialLinks} from '../../lib/constants';
import {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {SettingsStackParamList, TabStackParamList} from '../../App';
import {
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import Animated, {FadeInDown, FadeInUp, Layout} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import {useShowNavBarOnScroll} from '../../lib/hooks/useShowNavBarOnScroll';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

const Settings = ({navigation}: Props) => {
  const tabNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {primary, mode, setMode} = useThemeStore(state => state);
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const {handleScroll} = useShowNavBarOnScroll();
  const {clearHistory} = useWatchHistoryStore(state => state);

  // Home section toggles state
  const [showFavChannels, setShowFavChannels] = React.useState(settingsStorage.getBool('showFavChannelsHome', true));
  const [showSportsChannels, setShowSportsChannels] = React.useState(settingsStorage.getBool('showSportsChannelsHome', true));

  const handleProviderSelect = useCallback(
    (item: ProviderExtension) => {
      setProvider(item);
      // Add haptic feedback
      if (settingsStorage.isHapticFeedbackEnabled()) {
        ReactNativeHapticFeedback.trigger('virtualKey', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      // Navigate to home screen
      tabNavigation.navigate('HomeStack');
    },
    [setProvider, tabNavigation],
  );

  const renderProviderItem = useCallback(
    (item: ProviderExtension, isSelected: boolean) => (
      <TouchableOpacity
        key={item.value}
        onPress={() => handleProviderSelect(item)}
        className={`mr-3 rounded-lg ${
          isSelected ? 'bg-[#333333]' : 'bg-[#262626]'
        }`}
        style={{
          width: Dimensions.get('window').width * 0.3, // Shows 2.5 items
          height: 65, // Increased height
          borderWidth: 1.5,
          borderColor: isSelected ? primary : '#333333',
        }}>
        <View className="flex-col items-center justify-center h-full p-2">
          <RenderProviderFlagIcon type={item.type} />
          <Text
            numberOfLines={1}
            className="text-white text-xs font-medium text-center mt-2">
            {item.display_name}
          </Text>
          {isSelected && (
            <Text style={{position: 'absolute', top: 6, right: 6}}>
              <MaterialIcons name="check-circle" size={16} color={primary} />
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [handleProviderSelect, primary],
  );

  const providersList = useMemo(
    () =>
      installedProviders.map(item =>
        renderProviderItem(item, provider.value === item.value),
      ),
    [installedProviders, provider.value, renderProviderItem],
  );

  const clearCacheHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    cacheStorageService.clearAll();
  }, []);

  const clearHistoryHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    clearHistory();
  }, [clearHistory]);

  const AnimatedSection = ({
    delay,
    children,
  }: {
    delay: number;
    children: React.ReactNode;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      layout={Layout.springify()}>
      {children}
    </Animated.View>
  );

  return (
    <Animated.ScrollView
      className={`w-full h-full ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      entering={FadeInUp.springify()}
      layout={Layout.springify()}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingTop: 15,
        paddingBottom: 24,
        flexGrow: 1,
      }}>
      <View className="p-5">
        <Animated.View entering={FadeInUp.springify()}>
          <Text
            className={`text-2xl font-bold mb-6 ${
              mode === 'dark' ? 'text-white' : 'text-black'
            }`}>
            Settings
          </Text>
        </Animated.View>

        {/* Content provider section */}
        <AnimatedSection delay={100}>
          <View className="mb-6 flex-col gap-3">
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mb-1`}>
              App Theme
            </Text>
            <View
              className={`${
                mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
              } rounded-xl p-1 flex-row gap-1`}>
              <TouchableOpacity
                onPress={() => setMode('dark')}
                className={`flex-1 py-3 items-center justify-center rounded-lg flex-row gap-2 ${
                  mode === 'dark' ? 'bg-[#333333]' : 'bg-transparent'
                }`}>
                <Feather
                  name="moon"
                  size={18}
                  color={mode === 'dark' ? primary : '#666'}
                />
                <Text
                  className={`font-semibold ${
                    mode === 'dark' ? 'text-white' : 'text-gray-500'
                  }`}>
                  Dark
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('light')}
                className={`flex-1 py-3 items-center justify-center rounded-lg flex-row gap-2 ${
                  mode === 'light' ? 'bg-white shadow-sm' : 'bg-transparent'
                }`}>
                <Feather
                  name="sun"
                  size={18}
                  color={mode === 'light' ? primary : '#666'}
                />
                <Text
                  className={`font-semibold ${
                    mode === 'light' ? 'text-black' : 'text-gray-500'
                  }`}>
                  Light
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View className="mb-6 flex-col gap-3">
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mb-1`}>
              Content Provider
            </Text>
            <View
              className={`${
                mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
              } rounded-xl py-4`}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 10,
                }}>
                {providersList}
                {installedProviders.length === 0 && (
                  <Text
                    className={`${
                      mode === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    } text-sm`}>
                    No providers installed
                  </Text>
                )}
              </ScrollView>
            </View>
            <View
              className={`${
                mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
              } rounded-xl overflow-hidden mb-3`}>
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Extensions')}
                background={TouchableNativeFeedback.Ripple(
                  mode === 'dark' ? '#333333' : '#e5e7eb',
                  false,
                )}>
                <View className="flex-row items-center justify-between p-4 mr-5">
                  <View className="flex-row items-center">
                    <Feather
                      name="layers"
                      size={20}
                      color={primary}
                    />
                    <Text
                      className={`${
                        mode === 'dark' ? 'text-white' : 'text-black'
                      } ml-3 text-base flex-1`}
                      numberOfLines={1}>
                      Provider Manager
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>

        {/* Main options section */}
        <AnimatedSection delay={200}>
          <View className="mb-6">
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mb-3`}>
              Options
            </Text>
            <View
              className={`${
                mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
              } rounded-xl overflow-hidden`}>
              {/* Downloads */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Downloads')}
                background={TouchableNativeFeedback.Ripple(
                  mode === 'dark' ? '#333333' : '#e5e7eb',
                  false,
                )}>
                <View
                  className={`flex-row items-center justify-between p-4 border-b ${
                    mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'
                  }`}>
                  <View className="flex-row items-center">
                    <Feather
                      name="download"
                      size={20}
                      color={primary}
                    />
                    <Text
                      className={`${
                        mode === 'dark' ? 'text-white' : 'text-black'
                      } ml-3 text-base`}>
                      Downloads
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Subtitle Style */}
              <TouchableNativeFeedback
                onPress={async () => {
                  navigation.navigate('SubTitlesPreferences');
                }}
                background={TouchableNativeFeedback.Ripple(
                  mode === 'dark' ? '#333333' : '#e5e7eb',
                  false,
                )}>
                <View
                  className={`flex-row items-center justify-between p-4 border-b ${
                    mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'
                  }`}>
                  <View className="flex-row items-center">
                    <Feather
                      name="type"
                      size={20}
                      color={primary}
                    />
                    <Text
                      className={`${
                        mode === 'dark' ? 'text-white' : 'text-black'
                      } ml-3 text-base`}>
                      Subtitle Style
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Watch History */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('WatchHistoryStack')}
                background={TouchableNativeFeedback.Ripple(
                  mode === 'dark' ? '#333333' : '#e5e7eb',
                  false,
                )}>
                <View
                  className={`flex-row items-center justify-between p-4 border-b ${
                    mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'
                  }`}>
                  <View className="flex-row items-center">
                    <Feather
                      name="clock"
                      size={20}
                      color={primary}
                    />
                    <Text
                      className={`${
                        mode === 'dark' ? 'text-white' : 'text-black'
                      } ml-3 text-base`}
                      numberOfLines={1}>
                      Watch History
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Preferences */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('Preferences')}
                background={TouchableNativeFeedback.Ripple(
                  mode === 'dark' ? '#333333' : '#e5e7eb',
                  false,
                )}>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <Feather
                      name="sliders"
                      size={20}
                      color={primary}
                    />
                    <Text
                      className={`${
                        mode === 'dark' ? 'text-white' : 'text-black'
                      } ml-3 text-base`}>
                      Preferences
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>

              {/* Live TV Home Sections */}
              <View className={`px-4 py-8 border-t ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`}>
                <Text className={`text-[10px] font-black uppercase tracking-[4px] mb-6 ${mode === 'dark' ? 'text-white/20' : 'text-black/20'}`}>
                  Live TV Home Sections
                </Text>
                
                <View className="flex-row items-center justify-between mb-8">
                   <View className="flex-1 mr-4">
                      <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base font-bold`}>Show Favorites on Home</Text>
                      <Text className="text-gray-500 text-[10px] mt-1 font-bold">Quick access to your curated signals</Text>
                   </View>
                  <TouchableOpacity 
                    onPress={() => {
                      const newValue = !showFavChannels;
                      setShowFavChannels(newValue);
                      settingsStorage.setBool('showFavChannelsHome', newValue);
                    }}
                    className={`w-12 h-6 rounded-full p-1 ${showFavChannels ? 'bg-primary' : 'bg-gray-600'}`}
                  >
                    <View className={`w-4 h-4 rounded-full bg-white ${showFavChannels ? 'ml-6' : 'ml-0'}`} />
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center justify-between">
                   <View className="flex-1 mr-4">
                      <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base font-bold`}>Show Sports on Home</Text>
                      <Text className="text-gray-500 text-[10px] mt-1 font-bold">Never miss a live match</Text>
                   </View>
                  <TouchableOpacity 
                    onPress={() => {
                      const newValue = !showSportsChannels;
                      setShowSportsChannels(newValue);
                      settingsStorage.setBool('showSportsChannelsHome', newValue);
                    }}
                    className={`w-12 h-6 rounded-full p-1 ${showSportsChannels ? 'bg-primary' : 'bg-gray-600'}`}
                  >
                    <View className={`w-4 h-4 rounded-full bg-white ${showSportsChannels ? 'ml-6' : 'ml-0'}`} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* Data Management section */}
        <AnimatedSection delay={300}>
          <View className="mb-6">
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mb-3`}>
              Data Management
            </Text>
            <View
              className={`${
                mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
              } rounded-xl overflow-hidden`}>
              {/* Clear Cache */}
              <View
                className={`flex-row items-center justify-between p-4 border-b ${
                  mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'
                }`}>
                <Text
                  className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>
                  Clear Cache
                </Text>
                <TouchableOpacity
                  className={`${
                    mode === 'dark' ? 'bg-[#262626]' : 'bg-gray-200'
                  } px-4 py-2 rounded-lg`}
                  onPress={clearCacheHandler}>
                  <Feather
                    name="trash-2"
                    size={18}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>

              {/* Clear Watch History */}
              <View className="flex-row items-center justify-between p-4">
                <Text
                  className={`${
                    mode === 'dark' ? 'text-white' : 'text-black'
                  } text-base flex-1`}
                  numberOfLines={1}>
                  Clear Watch History
                </Text>
                <TouchableOpacity
                  className={`${
                    mode === 'dark' ? 'bg-[#262626]' : 'bg-gray-200'
                  } px-4 py-2 rounded-lg`}
                  onPress={clearHistoryHandler}>
                  <Feather
                    name="trash-2"
                    size={18}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* About & GitHub section */}
        <AnimatedSection delay={400}>
          <View className="mb-6">
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mb-3`}>
              About
            </Text>
            <View
              className={`${
                mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
              } rounded-xl overflow-hidden`}>
              {/* About */}
              <TouchableNativeFeedback
                onPress={() => navigation.navigate('About')}
                background={TouchableNativeFeedback.Ripple(
                  mode === 'dark' ? '#333333' : '#e5e7eb',
                  false,
                )}>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <Feather name="info" size={22} color={primary} />
                    <Text
                      className={`${
                        mode === 'dark' ? 'text-white' : 'text-black'
                      } ml-3 text-base`}>
                      About
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="gray" />
                </View>
              </TouchableNativeFeedback>
            </View>
          </View>
        </AnimatedSection>

      </View>
    </Animated.ScrollView>
  );
};

export default Settings;
