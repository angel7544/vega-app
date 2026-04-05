import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

const FeaturedEvents = () => {
  const { mode, primary } = useThemeStore();
  const navigation = useNavigation();
  const isDark = mode === 'dark';

  // Hardcoded featured events for demonstration (e.g., IPL)
  const events = [
    {
      id: 'ipl_1',
      title: 'IPL 2024: MI vs CSK',
      subtitle: 'Live Action',
      image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500&h=300&fit=crop',
      url: 'https://iptv-org.github.io/iptv/countries/in.m3u', // Placeholder URL
      type: 'Live TV',
    },
    {
      id: 'news_1',
      title: 'Global Summit 2024',
      subtitle: 'World News Live',
      image: 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e01a?w=500&h=300&fit=crop',
      url: 'https://iptv-org.github.io/iptv/countries/us.m3u',
      type: 'Live TV',
    }
  ];

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        // Find a matching channel or just go to Live TV
        navigation.navigate('LiveTVStack');
      }}
      className="mr-4 w-72 h-40 rounded-3xl overflow-hidden shadow-lg border border-gray-800/30"
    >
      <Image source={{ uri: item.image }} className="w-full h-full" resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        className="absolute inset-0 justify-end p-4"
      >
        <View className="bg-red-600 self-start px-2 py-0.5 rounded mb-1">
          <Text className="text-white text-[10px] font-bold uppercase">Live Event</Text>
        </View>
        <Text className="text-white font-bold text-lg">{item.title}</Text>
        <Text className="text-gray-300 text-xs">{item.subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View className="mb-8 mt-4">
      <View className="flex-row items-center justify-between px-4 mb-4">
        <Text className={`${isDark ? 'text-white' : 'text-black'} text-2xl font-bold`}>
          Featured Events
        </Text>
        <TouchableOpacity>
          <Text style={{ color: primary }} className="text-xs font-bold">Schedule</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={events}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

export default FeaturedEvents;
