import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {mainStorage as MMKV} from '../lib/storage/StorageService';
import {useNavigation} from '@react-navigation/native';
import useThemeStore from '../lib/zustand/themeStore';
import useContentStore, {Content} from '../lib/zustand/contentStore';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TabStackParamList} from '../types/navigation';
import AntDesign from '@expo/vector-icons/AntDesign';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInRight, Layout, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const ContinueWatching = () => {
  const themeState = useThemeStore();
  const primary = themeState?.primary || '#E50914';
  const mode = themeState?.mode || 'dark';
  const navigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const {history, removeItem} = useWatchHistoryStore(state => state);
  const {installedProviders, setProvider} = useContentStore((state: Content) => state);
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  
  // Responsive sizing using windowWidth and orientation
  const isLarge = windowWidth > 1024;
  const isTablet = windowWidth > 768;
  
  const itemWidth = React.useMemo(() => {
    if (isLandscape) return isLarge ? 200 : isTablet ? 160 : 120;
    return isLarge ? 220 : isTablet ? 180 : 130;
  }, [isLandscape, isLarge, isTablet]);

  const itemHeight = React.useMemo(() => {
    if (isLandscape) return isLarge ? 110 : isTablet ? 90 : 70;
    return isLarge ? 130 : isTablet ? 110 : 80;
  }, [isLandscape, isLarge, isTablet]);
  
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  // Filter out duplicates and get the most recent items
  const recentItems = React.useMemo(() => {
    const seen = new Set();
    const items = history
      .filter(item => {
        if (seen.has(item.link)) {
          return false;
        }
        seen.add(item.link);
        return true;
      })
      .slice(0, 10); // Limit to 10 items

    return items;
  }, [history]);

  // Load progress data
  useEffect(() => {
    const loadProgressData = () => {
      const progressMap: Record<string, number> = {};

      recentItems.forEach(item => {
        try {
          const historyKey = item.link;
          const historyProgressKey = `watch_history_progress_${historyKey}`;
          const storedProgress = MMKV.getString(historyProgressKey);

          if (storedProgress) {
            const parsed = JSON.parse(storedProgress);
            if (parsed.percentage) {
              progressMap[item.link] = Math.min(Math.max(parsed.percentage, 0), 100);
            } else if (parsed.currentTime && parsed.duration) {
              const percentage = (parsed.currentTime / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
            }
          } else if (item.currentTime && item.duration) {
            const percentage = (item.currentTime / item.duration) * 100;
            progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
          }
        } catch (e) {
          console.error('Error processing progress for item:', item.title, e);
        }
      });

      setProgressData(progressMap);
    };

    loadProgressData();
  }, [recentItems]);

  const handleNavigateToInfo = (item: any) => {
    try {
      if (item.isLiveTV) {
        (navigation as any).navigate('ChannelInfo', {
          channel: {
            name: item.title,
            url: item.link,
            logo: item.image,
            category: 'Recent',
            tvgId: item.tvgId,
          }
        } as any);
        return;
      }

      if (item.provider) {
        const matchingProvider = installedProviders.find((p: any) => p.value === item.provider);
        if (matchingProvider) {
          setProvider(matchingProvider);
        }
      }

      let linkData = item.link;
      if (typeof item.link === 'string' && item.link.startsWith('{')) {
        try {
          linkData = JSON.parse(item.link);
        } catch (e) {
          console.error('Failed to parse link:', e);
        }
      }
      
      navigation.navigate('HomeStack', {
        screen: 'Info',
        params: {
          link: linkData,
          provider: item.provider,
          poster: item.poster,
        },
      } as any);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const toggleItemSelection = (link: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(link)) {
        newSelected.delete(link);
      } else {
        newSelected.add(link);
      }
      if (newSelected.size === 0) {
        setSelectionMode(false);
      }
      return newSelected;
    });
  };

  const handleLongPress = (link: string) => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (!selectionMode) {
      setSelectionMode(true);
    }
    toggleItemSelection(link);
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = (item: any) => {
    if (selectionMode) {
      toggleItemSelection(item.link);
    } else {
      handleNavigateToInfo(item);
    }
  };

  const deleteSelectedItems = () => {
    recentItems.forEach(item => {
      if (selectedItems.has(item.link)) {
        removeItem(item);
      }
    });
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  if (recentItems.length === 0) {
    return null;
  }

  return (
    <View className="mt-4 mb-10">
      <View className="flex flex-row justify-between items-center px-4 mb-4">
        <View className="flex-row items-center">
            <View style={{ backgroundColor: primary }} className="w-1.5 h-6 rounded-full mr-3" />
            <Text
               className={`text-xl font-black uppercase tracking-widest ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
               Jump Back In
            </Text>
        </View>

        {selectionMode && selectedItems.size > 0 && (
          <TouchableOpacity
            onPress={deleteSelectedItems}
            className="bg-red-500/10 px-3 py-1.5 rounded-full flex-row items-center border border-red-500/20">
            <Text className="text-red-500 text-xs font-black mr-2 italic">
               Clear ({selectedItems.size})
            </Text>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={primary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={recentItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.link}
        contentContainerStyle={{paddingHorizontal: 16}}
        renderItem={({item, index}) => {
          const progress = progressData[item.link] || 0;
          const isSelected = selectedItems.has(item.link);

          return (
            <Animated.View 
               entering={FadeInRight.delay(index * 100).springify()}
               layout={Layout.springify()}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                className="mr-4"
                style={[{width: itemWidth}, animatedStyle]}
                onLongPress={() => handleLongPress(item.link)}
                onPress={() => handlePress(item)}>
                
                <View className={`relative overflow-hidden rounded-[24px] border ${mode === 'dark' ? 'border-white/10 bg-[#0A0A0A]' : 'border-black/5 bg-gray-50'}`} 
                  style={{ 
                    width: itemWidth, 
                    height: itemHeight,
                    shadowColor: primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                  }}>
                  
                  <Image
                    source={{uri: item?.poster}}
                    className="w-full h-full opacity-60"
                    style={{resizeMode: 'cover'}}
                  />

                  {/* Creative Glass Overlay */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    className="absolute inset-0 justify-end p-3"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                       <Text
                          className="text-white font-black text-[10px] uppercase tracking-tighter flex-1"
                          numberOfLines={1}
                       >
                          {item.title}
                       </Text>
                       <MaterialCommunityIcons name="play-circle" size={18} color="white" style={{ opacity: 0.8 }} />
                    </View>
                    
                    {/* Glowing Progress Architecture */}
                    <View className="h-1 bg-white/10 w-full rounded-full overflow-hidden border border-white/5">
                      <View
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          backgroundColor: primary,
                        }}
                      />
                    </View>
                    
                    {/* Bottom Aura Glow */}
                    <View 
                       className="absolute bottom-0 left-0 right-0 h-[2px]" 
                       style={{ 
                          backgroundColor: primary, 
                          opacity: 0.3,
                          shadowColor: primary,
                          shadowRadius: 10,
                          shadowOpacity: 1,
                          elevation: 10
                       }} 
                    />
                  </LinearGradient>

                  {/* Selection Glow */}
                  {isSelected && (
                    <View className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                       <View className="bg-white rounded-full p-2">
                          <AntDesign name="check" size={20} color={primary} />
                       </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />
    </View>
  );
};

export default ContinueWatching;
