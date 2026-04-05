import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import usePlayerStore from '../lib/zustand/playerStore';
import { Feather } from '@expo/vector-icons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { settingsStorage } from '../lib/storage';

const CategoryGrid = ({ categories, onSelect, selectedCategory, qualityFilter, onQualitySelect }) => {
  const { mode, primary } = useThemeStore();
  const { favoriteGenres, toggleFavoriteGenre } = usePlayerStore();
  const isDark = mode === 'dark';

  // Memoize sorted categories for performance
  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    const favorites = categories.filter(c => favoriteGenres.includes(c));
    const regulars = categories.filter(c => !favoriteGenres.includes(c));
    return [...favorites, ...regulars];
  }, [categories, favoriteGenres]);

  const handleLongPress = (category) => {
    if (category === 'All') return;
    
    if (settingsStorage.getBool('hapticFeedback') !== false) {
      ReactNativeHapticFeedback.trigger('impactHeavy', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    toggleFavoriteGenre(category);
  };

  const renderChip = (label, isQuality = false, value = null) => {
    const filterValue = isQuality ? value : label;
    const isActive = isQuality ? (qualityFilter === filterValue) : (selectedCategory === label && !qualityFilter);
    const isFavorited = favoriteGenres.includes(label);

    return (
      <TouchableOpacity
        key={label}
        activeOpacity={0.7}
        onPress={() => isQuality ? onQualitySelect(filterValue) : onSelect(label)}
        onLongPress={() => !isQuality && handleLongPress(label)}
        className={`px-5 py-2.5 rounded-2xl mr-2.5 border flex-row items-center ${
          isActive 
            ? 'border-transparent shadow-lg shadow-primary/40' 
            : (isDark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-black/5')
        }`}
        style={isActive ? { backgroundColor: primary } : {}}
      >
        {isFavorited && !isActive && (
          <Feather name="heart" size={10} color={primary} style={{ marginRight: 6 }} />
        )}
        <Text 
          className={`text-xs font-black tracking-wide ${
            isActive ? 'text-white' : (isDark ? 'text-white/70' : 'text-black/70')
          }`}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className={`py-2 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}
      >
        {/* Quality Filters */}
        <View className="flex-row items-center border-r border-white/10 pr-3 mr-3 gap-2">
          {[ 
            {label: '1080p', value: '1080p'}, 
            {label: '720p', value: '720p'}, 
            {label: '576p', value: '576p'} 
          ].map(q => renderChip(q.label, true, q.value))}
        </View>


        {/* Categories */}
        {sortedCategories.map(c => renderChip(c))}
      </ScrollView>
    </View>
  );
};

export default CategoryGrid;
