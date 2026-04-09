import React, {memo} from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {BlurView} from 'expo-blur';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';
import {Catalog} from '../lib/providers/types';

interface CategorySidebarProps {
  categories: Catalog[];
  onCategoryPress: (filter: string) => void;
  activeFilter?: string;
  width: number;
}

const CategorySidebar = ({categories, onCategoryPress, activeFilter, width}: CategorySidebarProps) => {
  const {mode, primary} = useThemeStore();

  return (
    <View style={{width}} className="h-full px-10 pt-10">
      <View className="mb-6 flex-row items-center space-x-2">
        <View className="w-1.5 h-6 rounded-full" style={{backgroundColor: primary}} />
        <Text className={`text-xl font-bold tracking-tight ${mode === 'dark' ? 'text-white' : 'text-black'}`}>Explore</Text>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 30}}>
        <View className="space-y-2">
          {categories.map((cat, index) => {
            const isActive = activeFilter === cat.filter;
            
            return (
              <TouchableOpacity
                key={`${cat.filter}-${index}`}
                onPress={() => onCategoryPress(cat.filter)}
                activeOpacity={0.7}
                className="overflow-hidden rounded-xl border border-white/10"
              >
                <BlurView 
                  intensity={isActive ? 40 : 15} 
                  tint={mode === 'dark' ? 'dark' : 'light'}
                  style={[
                    styles.itemContainer,
                    isActive && {borderColor: primary, borderLeftWidth: 4}
                  ]}
                >
                   <View className="flex-row items-center justify-between">
                    <Text 
                      className={`flex-1 text-sm font-semibold tracking-wide ${isActive ? (mode === 'dark' ? 'text-white' : 'text-black') : (mode === 'dark' ? 'text-white/70' : 'text-black/70')}`}
                      numberOfLines={1}
                    >
                      {cat.title}
                    </Text>
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={18} 
                      color={isActive ? primary : (mode === 'dark' ? 'white' : 'black')} 
                      style={{opacity: isActive ? 1 : 0.4}}
                    />
                  </View>
                </BlurView>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  }
});

export default memo(CategorySidebar);
