import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';

const Timetable = ({ programs = [] }) => {
  const { mode, primary } = useThemeStore();
  const isDark = mode === 'dark';

  const renderItem = ({ item, index }) => {
    // Basic check if it's currently live (simplistic, just first item for now or logic-based)
    const isLive = index === 0;

    return (
      <View className={`flex-row p-4 border-b border-gray-800 ${isLive ? 'bg-red-900/10' : ''}`}>
        <View className="w-16 items-center">
          <Text className={`font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{item.start}</Text>
          {isLive && (
            <View 
              className="mt-1 px-1 rounded" 
              style={{ backgroundColor: primary }}
            >
              <Text className="text-[8px] text-white font-bold uppercase">Live</Text>
            </View>
          )}
        </View>
        <View className="flex-1 ml-4">
          <Text 
            className={`text-base font-bold ${isLive ? 'text-red-500' : (isDark ? 'text-white' : 'text-black')}`}
          >
            {item.title}
          </Text>
          <Text className="text-gray-500 text-xs mt-1" numberOfLines={2}>
            {item.desc}
          </Text>
        </View>
        <Feather name={isLive ? 'play-circle' : 'calendar'} size={20} color={isLive ? primary : 'gray'} />
      </View>
    );
  };

  return (
    <View className={`rounded-2xl overflow-hidden ${isDark ? 'bg-[#121212]' : 'bg-gray-100'}`}>
      {programs.length > 0 ? (
        <FlatList
          data={programs}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
        />
      ) : (
        <View className="p-10 items-center">
          <Text className="text-gray-500">No timetable available for today</Text>
        </View>
      )}
    </View>
  );
};

export default Timetable;
