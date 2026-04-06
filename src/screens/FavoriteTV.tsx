import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import usePlayerStore from '../lib/zustand/playerStore';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from 'expo-blur';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const COLUMN_COUNT = isTablet ? 3 : 2;

const FavoriteTV = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const { favorites, toggleFavorite } = usePlayerStore();
  const isDark = mode === 'dark';

  const handleChannelPress = (channel: any) => {
    navigation.navigate('ChannelInfo', { 
      channel,
      channels: favorites,
      initialIndex: favorites.findIndex((c: any) => c.url === channel.url)
    });
  };

  const renderChannelItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).duration(600).springify()}
      className="p-2"
      style={{ width: width / COLUMN_COUNT }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleChannelPress(item)}
        className={`rounded-[24px] overflow-hidden border ${
          isDark ? 'bg-[#111] border-white/5' : 'bg-white border-black/5'
        } shadow-2xl`}
      >
        <View className={`aspect-video items-center justify-center relative overflow-hidden ${isDark ? 'bg-black/40' : 'bg-gray-100'}`}>
           {!isDark && (
             <View className="absolute inset-0 bg-black/5" />
           )}
           
           {item.logo ? (
             <Image source={{ uri: item.logo }} className="w-[70%] h-[70%] z-10" resizeMode="contain" />
           ) : (
             <Feather name="tv" size={32} color={primary} style={{ opacity: 0.3 }} />
           )}
           
           <LinearGradient
             colors={['rgba(255,255,255,0.05)', 'transparent', 'rgba(0,0,0,0.3)']}
             className="absolute inset-0 z-10"
           />
           
           <View className="absolute bottom-2 left-2 z-20 flex-row items-center bg-black/40 px-2 py-0.5 rounded-lg">
             <View className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
             <Text className="text-white font-black text-[8px] uppercase tracking-widest">Live</Text>
           </View>
        </View>
        
        <View className="p-4 flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Text className={`font-black text-[12px] leading-tight ${isDark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-gray-500 text-[8px] font-bold uppercase tracking-widest mt-1">
              {item.category || 'Favorite'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}
            className={`w-8 h-8 items-center justify-center rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
          >
            <Ionicons name="heart" size={14} color={primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View className="pt-14 pb-4 px-6 flex-row items-center justify-between">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className={`p-3 ${isDark ? 'bg-white/5' : 'bg-black/5'} rounded-full border ${isDark ? 'border-white/5' : 'border-black/5'} overflow-hidden`}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : 'black'} />
        </TouchableOpacity>
        <Text className={`text-3xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>MY LIBRARY</Text>
        <View className="w-12" />
      </View>

      <FlashList
        data={favorites}
        renderItem={renderChannelItem}
        keyExtractor={(item) => item.url}
        numColumns={COLUMN_COUNT}
        estimatedItemSize={200}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 150 }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center mt-24 px-12">
            <View className={`p-10 ${isDark ? 'bg-white/5' : 'bg-black/5'} rounded-full mb-8`}>
              <Feather name="heart" size={60} color={isDark ? 'white' : 'black'} style={{ opacity: 0.2 }} />
            </View>
            <Text className={`text-2xl font-black text-center ${isDark ? 'text-white' : 'text-black'}`}>
              Empty Signals
            </Text>
            <Text className="text-gray-500 text-center mt-3 font-bold text-[10px] uppercase tracking-[2px] leading-5">
              Sync your favorite channels to build your custom stream bank.
            </Text>
          </View>
        )}
      />
    </View>
  );
};

export default FavoriteTV;
