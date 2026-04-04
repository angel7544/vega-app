import {
  View,
  Text,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
} from 'react-native';
import React, {useState} from 'react';
import {providersStorage} from '../../lib/storage';
import {providersList} from '../../lib/constants';
import useThemeStore from '../../lib/zustand/themeStore';
import {SvgUri} from 'react-native-svg';

const DisableProviders = () => {
  const {primary, mode} = useThemeStore(state => state);
  const [disabledProviders, setDisabledProviders] = useState<string[]>(
    providersStorage.getDisabledProviders(),
  );

  const toggleProvider = (providerId: string) => {
    const newDisabled = providersStorage.toggleProvider(providerId);
    setDisabledProviders(newDisabled);
  };

  const enableAll = () => {
    providersStorage.enableAllProviders();
    setDisabledProviders([]);
  };

  return (
    <ScrollView
      className={`w-full h-full ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}
      contentContainerStyle={{
        paddingTop: StatusBar.currentHeight || 0,
      }}>
      <View className="p-5">
        <View className="flex-row items-center justify-between mb-6">
          <Text className={`text-2xl font-bold ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
            Disable Providers
          </Text>
          <TouchableOpacity
            onPress={enableAll}
            className={`${mode === 'dark' ? 'bg-[#262626]' : 'bg-gray-200'} px-4 py-2 rounded-lg`}>
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-xs`}>Enable All</Text>
          </TouchableOpacity>
        </View>

        <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm mb-3`}>
          Disabled providers won't appear in search results
        </Text>

        <View className={`${mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
          {providersList.map((provider, index) => (
            <View
              key={provider.value}
              className={`flex-row items-center justify-between p-4 ${
                index !== providersList.length - 1
                  ? `border-b ${mode === 'dark' ? 'border-[#262626]' : 'border-gray-200'}`
                  : ''
              }`}>
              <View className="flex-row items-center">
                <View className={`${mode === 'dark' ? 'bg-[#262626]' : 'bg-gray-200'} p-2 rounded-lg mr-3`}>
                  <SvgUri width={24} height={24} uri={provider.flag} />
                </View>
                <View>
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base`}>{provider.name}</Text>
                  <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-xs`}>
                    {provider.type || 'Content Provider'}
                  </Text>
                </View>
              </View>
              <Switch
                thumbColor={
                  !disabledProviders.includes(provider.value) ? primary : 'gray'
                }
                value={!disabledProviders.includes(provider.value)}
                onValueChange={() => toggleProvider(provider.value)}
              />
            </View>
          ))}
        </View>

        <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-xs text-center mt-4`}>
          Changes will apply to new searches
        </Text>
      </View>
    </ScrollView>
  );
};

export default DisableProviders;
