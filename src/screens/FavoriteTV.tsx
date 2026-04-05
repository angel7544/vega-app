import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import usePlayerStore from '../lib/zustand/playerStore';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from 'expo-blur';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const COLUMN_COUNT = isTablet ? 3 : 1;

const FavoriteTV = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const { favorites, toggleFavorite } = usePlayerStore();
  const isDark = mode === 'dark';

  const handleChannelPress = (channel: any, _index: number) => {
    navigation.navigate('LivePlayer', { 
      channel
    });
  };

  const renderChannelItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => handleChannelPress(item, index)}
      className={`mx-4 mb-5 rounded-3xl overflow-hidden shadow-xl border ${
        isDark ? 'bg-[#121212] border-white/5' : 'bg-white border-black/5'
      }`}
      style={{ width: isTablet ? (width / 3.4) : (width - 32) }}
    >
      <View className="aspect-video bg-black items-center justify-center relative">
        {item.logo ? (
          <Image source={{ uri: item.logo }} className="w-[70%] h-[70%]" resizeMode="contain" />
        ) : (
          <Feather name="tv" size={40} color={primary} />
        )}
        
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
          className="absolute inset-0 justify-end p-4"
        >
          <View className="flex-row items-center bg-red-600 px-2.5 py-1 rounded-lg self-start">
            <View className="w-1.5 h-1.5 rounded-full bg-white mr-1.5" />
            <Text className="text-white font-black text-[8px] uppercase tracking-widest">Live</Text>
          </View>
        </LinearGradient>
      </View>
      
      <View className="p-4 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className={`font-black text-lg ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            {item.category || 'Favorite'}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}
          className="p-2.5 bg-primary/10 rounded-full"
          style={{ backgroundColor: `${primary}15` }}
        >
          <Feather name="heart" size={18} color={primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View className="pt-14 pb-4 px-6 flex-row items-center justify-between">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="p-3 bg-white/5 rounded-full border border-white/5 overflow-hidden"
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : 'black'} />
        </TouchableOpacity>
        <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-black'}`}>My Favorites</Text>
        <View className="w-12" />
      </View>

      <FlatList
        data={favorites}
        renderItem={renderChannelItem}
        keyExtractor={(item) => item.url}
        numColumns={COLUMN_COUNT}
        key={COLUMN_COUNT}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center mt-24 px-12">
            <View className="p-10 bg-primary/10 rounded-full mb-8">
              <Feather name="heart" size={60} color={primary} />
            </View>
            <Text className={`text-2xl font-black text-center ${isDark ? 'text-white' : 'text-black'}`}>
              No Favorites Yet
            </Text>
            <Text className="text-gray-500 text-center mt-3 font-bold leading-5">
              Mark channels as favorite while watching to see them here for quick access.
            </Text>
          </View>
        )}
      />
    </View>
  );
};

export default FavoriteTV;
