import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const ITEM_WIDTH = isTablet ? 200 : 160;

interface LiveTVHomeSliderProps {
  title: string;
  channels: any[];
  isLoading?: boolean;
}

const LiveTVHomeSlider: React.FC<LiveTVHomeSliderProps> = ({ title, channels, isLoading }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const isDark = mode === 'dark';

  if (!isLoading && channels.length === 0) return null;

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('ChannelInfo', { channel: item })}
      className="mr-4 items-center"
      style={{ width: ITEM_WIDTH }}
    >
      <View 
        className="aspect-video bg-black rounded-3xl overflow-hidden shadow-xl relative border border-white/5"
        style={{ width: ITEM_WIDTH }}
      >
        {item.logo ? (
          <Image source={{ uri: item.logo }} className="w-full h-full" resizeMode="contain" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Feather name="tv" size={32} color={primary} />
          </View>
        )}
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          className="absolute inset-0 justify-end p-3"
        >
          <View className="flex-row items-center bg-red-600 px-2 py-0.5 rounded-md self-start">
             <View className="w-1 h-1 rounded-full bg-white mr-1.5" />
             <Text className="text-white font-black text-[7px] uppercase tracking-widest">Live</Text>
          </View>
        </LinearGradient>
      </View>
      <Text 
        className={`mt-2 font-black text-[10px] text-center w-full uppercase tracking-widest px-1 ${isDark ? 'text-white/60' : 'text-black/60'}`}
        numberOfLines={1}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const loadingData = Array(5).fill({});

  return (
    <View className="mt-8 mb-4">
      <View className="flex-row items-center justify-between px-5 mb-5">
        <View>
          <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-black'}`}>{title}</Text>
           <View 
             className="h-1 rounded-full mt-1" 
             style={{ width: 30, backgroundColor: primary }} 
           />
        </View>
        <TouchableOpacity onPress={() => (navigation as any).navigate('LiveTV')}>
           <Text className="text-primary text-[10px] font-black uppercase tracking-widest">Signal Sync</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={isLoading ? loadingData : channels}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        snapToInterval={ITEM_WIDTH + 16}
        decelerationRate="fast"
      />
    </View>
  );
};

export default LiveTVHomeSlider;
