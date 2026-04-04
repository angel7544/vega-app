import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SettingsStackParamList} from '../../App';
import {
  MaterialCommunityIcons,
  Feather,
  FontAwesome6,
  MaterialIcons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useContentStore from '../../lib/zustand/contentStore';
import useToastStore from '../../lib/zustand/toastStore';
import {
  extensionStorage,
  ProviderExtension,
  ProviderSource,
} from '../../lib/storage/extensionStorage';
import {extensionManager} from '../../lib/services/ExtensionManager';
import {
  updateProvidersService,
  UpdateInfo,
} from '../../lib/services/UpdateProviders';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {settingsStorage} from '../../lib/storage';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';
import ProviderSourceManager from './components/ProviderSourceManager';
import ConfirmationModal from '../../components/ConfirmationModal';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Extensions'>;

type TabType = 'installed' | 'available';

const Extensions = ({navigation}: Props) => {
  const {primary, mode} = useThemeStore(state => state);
  const {show} = useToastStore();
  const [confirmUninstallVisible, setConfirmUninstallVisible] = useState(false);
  const [providerToUninstall, setProviderToUninstall] = useState<any>(null);

  const confirmUninstall = async () => {
    if (!providerToUninstall) return;
    setConfirmUninstallVisible(false);

    try {
      extensionStorage.uninstallProvider(
        providerToUninstall.value,
        providerToUninstall.source?.author,
      );
      loadProviders();
      setInstalledProviders(extensionStorage.getInstalledProviders() || []);

      // If this was the active provider, clear it
      if (
        activeExtensionProvider?.value === providerToUninstall?.value &&
        activeExtensionProvider?.source?.author ===
          providerToUninstall?.source?.author
      ) {
        setActiveExtensionProvider(
          extensionStorage.getInstalledProviders()[0] || {
            value: '',
            display_name: '',
            source: {author: '', url: ''},
            type: '',
            version: '',
          },
        );
      }
      show('Provider uninstalled successfully', 'success');
    } catch (e) {
      show('Failed to uninstall provider', 'error');
    } finally {
      setProviderToUninstall(null);
    }
  };
  const {
    activeExtensionProvider,
    setActiveExtensionProvider,
    installedProviders,
    availableProviders,
    setInstalledProviders,
    setAvailableProviders,
  } = useContentStore(state => ({
    activeExtensionProvider: state.provider,
    setActiveExtensionProvider: state.setProvider,
    installedProviders: state.installedProviders,
    availableProviders: state.availableProviders,
    setInstalledProviders: state.setInstalledProviders,
    setAvailableProviders: state.setAvailableProviders,
  }));

  const [activeTab, setActiveTab] = useState<TabType>(
    installedProviders?.length > 0 ? 'installed' : 'available',
  );
  const [installingProvider, setInstallingProvider] = useState<string | null>(
    null,
  );
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);
  const [updateInfos, setUpdateInfos] = useState<UpdateInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSourceAuthor, setActiveSourceAuthor] = useState<string>(
    extensionStorage.getProviderSource()?.author || '',
  );

  // Load providers on component mount
  useEffect(() => {
    const initializeExtensions = async () => {
      try {
        await extensionManager.initialize();
        const source = extensionStorage.getProviderSource();
        const author = source?.author || '';
        setActiveSourceAuthor(author);
        loadProviders(author);
        await checkForUpdates();

        // Try to fetch latest providers if we don't have any
        if (
          author &&
          (!availableProviders || availableProviders.length === 0)
        ) {
          await refreshProviders(author);
        }
      } catch (error) {
        console.error('Extension initialization error:', error);
        // Still try to load from cache if initialization fails
        loadProviders();
      }
    };

    initializeExtensions();
  }, []);

  const loadProviders = (author?: string) => {
    const selectedAuthor =
      author || extensionStorage.getProviderSource()?.author || '';
    const installed = extensionStorage.getInstalledProviders() || [];
    const available = selectedAuthor
      ? extensionStorage.getAvailableProviders(selectedAuthor)
      : [];
    
    setInstalledProviders(installed);
    setAvailableProviders(available.filter(item => item && !item.disabled));
    setActiveSourceAuthor(selectedAuthor);
  };

  const checkForUpdates = async () => {
    const source = extensionStorage.getProviderSource();
    if (!source) {
      setUpdateInfos([]);
      return;
    }

    try {
      const updates = await updateProvidersService.checkForUpdatesManual();
      setUpdateInfos(updates);
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const handleUpdateProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const providerKey = `${provider.source?.author || ''}:${provider.value}`;
    setUpdatingProvider(providerKey);
    try {
      const success = await updateProvidersService.updateProvider(provider);
      if (success) {
        // Reload all data after update
        loadProviders();
        await checkForUpdates();

        Alert.alert(
          'Success',
          `${provider.display_name} has been updated successfully!`,
        );

        // Update the active provider if it was the one being updated
        if (
          activeExtensionProvider?.value === provider.value &&
          activeExtensionProvider?.source?.author === provider.source?.author
        ) {
          setActiveExtensionProvider(provider);
        }
      } else {
        Alert.alert('Error', 'Failed to update provider. Please try again.');
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update provider. Please try again.');
    } finally {
      setUpdatingProvider(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveTab(tab);
  };

  const handleInstallProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const providerKey = `${provider.source?.author || ''}:${provider.value}`;
    setInstallingProvider(providerKey);
    try {
      console.log(`Starting installation for: ${provider.display_name}`);
      await extensionManager.installProvider(provider);
      
      // Update store and local data
      loadProviders(activeSourceAuthor);

      show(`${provider.display_name} installed successfully!`, 'success');
      
      // Set as active if none selected
      if (!activeExtensionProvider) {
        setActiveExtensionProvider(provider);
      }
    } catch (error: any) {
      console.error('Installation error:', error);
      show(`Failed to install ${provider.display_name}`, 'error');
    } finally {
      setInstallingProvider(null);
    }
  };
  const handleUninstallProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }
    setProviderToUninstall(provider);
    setConfirmUninstallVisible(true);
  };
  const handleSetActiveProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveExtensionProvider(provider);
  };

  const refreshProviders = async (sourceAuthor: string) => {
    setRefreshing(true);
    try {
      if (!sourceAuthor) {
        setAvailableProviders([]);
        return;
      }

      const source = extensionStorage
        .getProviderSources()
        .find(item => item.author === sourceAuthor);

      if (!source) {
        setAvailableProviders([]);
        return;
      }

      const providers = await extensionManager.fetchManifest(source, true);

      setAvailableProviders(providers);

      loadProviders(sourceAuthor);
      await checkForUpdates();
    } catch (error) {
      console.error('Refresh error:', error);
      Alert.alert(
        'Error',
        'Failed to refresh providers list. Please check your internet connection.',
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await refreshProviders(activeSourceAuthor);
  };
  const renderProviderCard = ({item}: {item: ProviderExtension}) => {
    if (!item || !item.value) return null;
    const itemKey = `${item.source?.author || ''}:${item.value}`;
    const isActive =
      activeExtensionProvider?.value === item.value &&
      activeExtensionProvider?.source?.author === item.source?.author;
    const isInstalled = extensionStorage.isProviderInstalled(
      item.value,
      item.source?.author,
    );
    const isInstalling = installingProvider === itemKey;
    const isUpdating = updatingProvider === itemKey;
    const updateInfo = updateInfos.find(
      info =>
        info.provider.value === item.value &&
        info.provider.source?.author === item.source?.author,
    );
    const hasUpdate = updateInfo?.hasUpdate || false;

    return (
      <View
        className={`${mode === 'dark' ? 'bg-[#121212] border-white/5' : 'bg-gray-50 border-gray-200'} rounded-2xl p-4 mb-4 mx-4 shadow-sm border`}>
        <View className="flex-row items-center gap-4 justify-between">
          {/* Left: Icon */}
          <View className="relative">
            {item.icon ? (
              <Image
                source={{uri: item.icon}}
                className="w-12 h-12 rounded-xl border-2 border-primary/20 bg-quaternary"
                style={{resizeMode: 'cover'}}
              />
            ) : (
              <View className={`${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'} w-12 h-12 items-center justify-center rounded-xl border`}>
                <RenderProviderFlagIcon type={item.type} />
              </View>
            )}
            {isActive && (
              <View className="absolute -top-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-black items-center justify-center">
                <MaterialIcons name="check" size={10} color="white" />
              </View>
            )}
          </View>

          {/* Middle: Info */}
          <View className="flex-1 mx-1">
            <View className="flex-row items-center flex-wrap">
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base font-black tracking-tight flex-1`} numberOfLines={1}>
                {item.display_name || 'Unknown Provider'}
              </Text>
            </View>
            <View className="flex-row items-center space-x-2 mt-0.5">
               <Text className={`${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'} text-[10px] font-black uppercase tracking-widest`}>
                 {item.type || 'Generic'} • v{item.version || '1.0'}
               </Text>
               {hasUpdate && (
                 <View className="bg-primary/20 px-1.5 py-0.5 rounded">
                   <Text className="text-primary text-[8px] font-black uppercase">Update</Text>
                 </View>
               )}
            </View>
          </View>

          {/* Right: Actions */}
          <View className="flex-row items-center space-x-2">
            {activeTab === 'installed' ? (
              <>
                {!isActive && (
                  <TouchableOpacity
                    onPress={() => handleSetActiveProvider(item)}
                    className={`w-9 h-9 rounded-xl items-center justify-center ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <MaterialIcons name="radio-button-unchecked" size={18} color={mode === 'dark' ? '#666' : '#999'} />
                  </TouchableOpacity>
                )}
                {hasUpdate && (
                  <TouchableOpacity
                    onPress={() => handleUpdateProvider(updateInfo!.provider)}
                    disabled={isUpdating}
                    className="w-9 h-9 rounded-xl items-center justify-center"
                    style={{ backgroundColor: primary }}>
                    {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Feather name="refresh-cw" size={16} color="white" />}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleUninstallProvider(item)}
                  className="w-9 h-9 rounded-xl items-center justify-center bg-red-600/10">
                  <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => handleInstallProvider(item)}
                disabled={isInstalled || isInstalling}
                className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: isInstalled ? (mode === 'dark' ? '#333' : '#eee') : primary }}>
                {isInstalling ? <ActivityIndicator size="small" color="white" /> : <Feather name={isInstalled ? "check" : "download"} size={16} color={isInstalled ? (mode === 'dark' ? '#666' : '#999') : "white"} />}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };
  const currentData =
    activeTab === 'installed'
      ? (installedProviders || []).filter(item => item && item.value)
      : (availableProviders || []).filter(item => item && item.value);

  return (
    <View className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-white'} pt-10 pb-16`}>
      <StatusBar 
        backgroundColor={mode === 'dark' ? 'black' : 'white'} 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
      />
      {/* Header */}
      <View className={`flex-row items-center justify-between p-4 border-b ${mode === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <FontAwesome6 name="arrow-left" size={24} color={mode === 'dark' ? 'white' : 'black'} />
        </TouchableOpacity>
        <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-xl font-semibold`}>Providers</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Feather name="refresh-cw" size={24} color={primary} />
        </TouchableOpacity>
      </View>
      {/* Tabs */}
      <View className={`${mode === 'dark' ? 'bg-quaternary' : 'bg-gray-100'} mx-4 mt-4 rounded-xl flex-row`}>
        <TouchableOpacity
          onPress={() => handleTabChange('installed')}
          className="flex-1 py-3 rounded-xl"
          style={{
            backgroundColor:
              activeTab === 'installed' ? primary : 'transparent',
          }}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'installed' ? 'text-white' : (mode === 'dark' ? 'text-gray-400' : 'text-gray-600')
            }`}>
            Installed ({(installedProviders || []).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('available')}
          className="flex-1 py-3 rounded-xl"
          style={{
            backgroundColor:
              activeTab === 'available' ? primary : 'transparent',
          }}>
          <Text
            className={`text-center font-medium ${
              activeTab === 'available' ? 'text-white' : (mode === 'dark' ? 'text-gray-400' : 'text-gray-600')
            }`}>
            Available ({(availableProviders || []).length})
          </Text>
        </TouchableOpacity>
      </View>

      <ProviderSourceManager
        visible={activeTab === 'available'}
        primary={primary}
        onSourceChanged={async (source: ProviderSource | undefined) => {
          const author = source?.author || '';
          setActiveSourceAuthor(author);
          loadProviders(author);
          await refreshProviders(author);
        }}
      />

      {/* Provider list */}
      <FlatList
        data={currentData}
        keyExtractor={(item, index) =>
          `${item?.source?.author || 'none'}:${item?.value || `provider-${index}`}`
        }
        renderItem={renderProviderCard}
        className="flex-1 mt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primary]}
            tintColor={primary}
            progressBackgroundColor="black"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <MaterialCommunityIcons
              name="package-variant"
              size={64}
              color={mode === 'dark' ? '#404040' : '#A3A3A3'}
            />
            <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-lg mt-4`}>
              {activeTab === 'installed'
                ? 'No providers installed'
                : 'No providers available'}
            </Text>
            <Text className={`${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'} text-sm mt-2 text-center px-8`}>
              {activeTab === 'installed'
                ? 'Install providers from the Available tab to get started'
                : 'Pull to refresh to check for available providers'}
            </Text>
          </View>
        }
      />

      <ConfirmationModal
        visible={confirmUninstallVisible}
        title="Uninstall Provider"
        message={`Are you sure you want to uninstall ${providerToUninstall?.display_name || 'this provider'}?`}
        confirmLabel="Uninstall"
        isDestructive={true}
        primary={primary}
        onCancel={() => {
          setConfirmUninstallVisible(false);
          setProviderToUninstall(null);
        }}
        onConfirm={confirmUninstall}
      />
    </View>
  );
};

export default Extensions;
