import React, { useEffect } from 'react';
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
import { RootStackParamList } from '../types/navigation';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  FadeInRight
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const ITEM_WIDTH = isTablet ? 220 : 180;

interface LiveTVHomeSliderProps {
  title: string;
  channels: any[];
  isLoading?: boolean;
}

const LivePulse = () => {
   const opacity = useSharedValue(1);
   
   useEffect(() => {
      opacity.value = withRepeat(
         withSequence(
            withTiming(0.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 })
         ),
         -1,
         true
      );
   }, []);

   const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: opacity.value }]
   }));

   return (
      <Animated.View 
         style={animatedStyle}
         className="w-2 h-2 rounded-full bg-red-500 mr-2 shadow-sm shadow-red-500"
      />
   );
};

const LiveTVHomeSlider: React.FC<LiveTVHomeSliderProps> = ({ title, channels, isLoading }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, primary } = useThemeStore();
  const isDark = mode === 'dark';

  if (!isLoading && channels.length === 0) return null;

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ChannelInfo', { channel: item })}
        className="mr-5 items-center"
        style={{ width: ITEM_WIDTH }}
      >
        <View 
          className={`aspect-video rounded-[32px] overflow-hidden shadow-2xl relative border ${isDark ? 'bg-[#0F0F0F] border-white/10' : 'bg-gray-100 border-black/5'}`}
          style={{ width: ITEM_WIDTH }}
        >
          {item.logo ? (
            <View className="flex-1 p-6 items-center justify-center">
               <Image source={{ uri: item.logo }} className="w-full h-full" resizeMode="contain" />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Feather name="tv" size={40} color={primary} />
            </View>
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            className="absolute inset-0 justify-end p-4"
          >
            <View className="flex-row items-center bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 self-start">
               <LivePulse />
               <Text className="text-white font-black text-[8px] uppercase tracking-[2px]">Live Now</Text>
            </View>
          </LinearGradient>
        </View>
        <Text 
          className={`mt-3 font-black text-[10px] text-center w-full uppercase tracking-[1px] px-2 ${isDark ? 'text-white' : 'text-black'}`}
          numberOfLines={2}
          style={{ height: 30, textAlignVertical: 'center' }}
        >
          {item.name}
        </Text>
        <Text className={`text-[8px] font-bold uppercase tracking-widest opacity-40 mt-1 ${isDark ? 'text-white' : 'text-black'}`}>
           {item.category || 'Streaming'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const loadingData = Array(5).fill({});

  return (
    <View className="mt-6 mb-8">
      <View className="flex-row items-center justify-between px-6 mb-6">
        <View>
          <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-black'} tracking-tight`}>{title}</Text>
           <View 
             className="h-1.5 rounded-full mt-1.5" 
             style={{ width: 40, backgroundColor: primary }} 
           />
        </View>
        <TouchableOpacity 
          className="bg-primary/10 px-4 py-2 rounded-full border border-primary/20"
          onPress={() => (navigation as any).navigate('LiveTV')}>
           <Text className="text-primary text-[10px] font-black uppercase tracking-widest">Full Access</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={isLoading ? loadingData : channels}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        contentContainerStyle={{ paddingHorizontal: 24 }}
        snapToInterval={ITEM_WIDTH + 20}
        decelerationRate="fast"
      />
    </View>
  );
};

export default LiveTVHomeSlider;
