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

  const renderChip = (label, isQuality = false, value = null, icon = null) => {
    const filterValue = isQuality ? value : label;
    const isActive = isQuality ? (qualityFilter === filterValue) : (selectedCategory === label);
    const isFavorited = !isQuality && !icon && favoriteGenres.includes(label);

    return (
      <TouchableOpacity
        key={label}
        activeOpacity={0.7}
        onPress={() => isQuality ? onQualitySelect(filterValue) : onSelect(label)}
        onLongPress={() => !isQuality && !icon && handleLongPress(label)}
        className={`px-6 py-3 rounded-2xl mr-3 border flex-row items-center ${
          isActive 
            ? 'border-transparent shadow-2xl' 
            : (isDark ? 'border-white/5 bg-white/5' : 'border-black/5 bg-black/5')
        }`}
        style={isActive ? { backgroundColor: primary, shadowColor: primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 } : {}}
      >
        {icon && (
          <Feather name={icon} size={14} color={isActive ? 'white' : (isDark ? 'white' : 'black')} style={{ marginRight: 8, opacity: isActive ? 1 : 0.5 }} />
        )}
        {isFavorited && !isActive && (
          <MaterialIcons name="favorite" size={10} color={primary} style={{ marginRight: 6 }} />
        )}
        <Text 
          className={`text-[11px] font-black uppercase tracking-[2px] ${
            isActive ? 'text-white' : (isDark ? 'text-white/60' : 'text-black/60')
          }`}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="py-4">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}
      >
        {/* Quick Filters */}
        <View className="flex-row items-center border-r border-white/10 pr-3 mr-3 gap-1">
           {renderChip('Favorites', false, 'Favorites', 'heart')}
           {renderChip('Trending', false, 'Trending', 'zap')}
           {renderChip('Recent', false, 'Recent', 'clock')}
        </View>

        {/* Quality Filters */}
        <View className="flex-row items-center border-r border-white/10 pr-3 mr-3 gap-1">
          {[ 
            {label: '4K', value: '4K'}, 
            {label: 'FHD', value: 'FHD'}, 
            {label: 'HD', value: 'HD'} 
          ].map(q => renderChip(q.label, true, q.value))}
        </View>


        {/* Categories */}
        <View className="flex-row items-center">
           {sortedCategories.map(c => renderChip(c))}
        </View>
      </ScrollView>
    </View>
  );
};

export default CategoryGrid;
