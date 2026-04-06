import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {FlashList} from '@shopify/flash-list';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WatchHistoryStackParamList} from '../types/navigation';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import useThemeStore from '../lib/zustand/themeStore';
import {mainStorage, settingsStorage} from '../lib/storage';
import {BlurView} from 'expo-blur';
import Animated, {FadeInDown} from 'react-native-reanimated';
import WatchHistoryCard from '../components/WatchHistoryCard';

type Props = NativeStackScreenProps<WatchHistoryStackParamList, 'WatchHistory'>;

const WatchHistory = ({navigation}: Props) => {
  const {primary, mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';
  const {history, clearHistory, removeItems} = useWatchHistoryStore(state => state);
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const {width: windowWidth} = useWindowDimensions();

  // Layout Preference (1 = Grid, 0 = List)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(
    settingsStorage.getListViewType() === 1 ? 'grid' : 'list'
  );

  const toggleLayout = () => {
    const next = layoutMode === 'grid' ? 'list' : 'grid';
    setLayoutMode(next);
    settingsStorage.setListViewType(next === 'grid' ? 1 : 0);
  };

  // Filter out duplicates by link, keeping only the most recent entry
  const uniqueHistory = React.useMemo(() => {
    const seen = new Set();
    return history.filter(item => {
      if (!item.link || seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });
  }, [history]);

  // Grid calculations
  const isTablet = windowWidth > 768;
  const numColumns = layoutMode === 'grid' ? (isTablet ? 5 : 3) : 1;

  // Load progress data
  useEffect(() => {
    const loadProgressData = () => {
      const progressMap: Record<string, number> = {};
      uniqueHistory.forEach(item => {
        try {
          const historyKey = item.link;
          const historyProgressKey = `watch_history_progress_${historyKey}`;
          const storedProgress = mainStorage.getString(historyProgressKey);

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
          console.error('Error processing progress:', item.title, e);
        }
      });
      setProgressData(progressMap);
    };
    loadProgressData();
  }, [uniqueHistory]);

  const handleNavigateToInfo = (item: any) => {
    navigation.navigate('Info' as any, {
      link: item.link,
      provider: item.provider || 'multiStream',
      poster: item.image || item.poster || '',
    });
  };

  const toggleSelection = (link: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(link)) newSet.delete(link);
      else newSet.add(link);
      return newSet;
    });
  };

  const handleLongPress = (item: any) => {
    if (!isSelectionMode) {
       setIsSelectionMode(true);
       setSelectedLinks(new Set([item.link]));
    } else {
       toggleSelection(item.link);
    }
  };

  const handleSelectAll = () => {
    if (selectedLinks.size === uniqueHistory.length) setSelectedLinks(new Set());
    else setSelectedLinks(new Set(uniqueHistory.map(item => item.link)));
  };

  const handleDeleteSelected = () => {
    if (selectedLinks.size === 0) return;
    removeItems(Array.from(selectedLinks));
    setIsSelectionMode(false);
    setSelectedLinks(new Set());
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <StatusBar translucent backgroundColor="transparent" style={isDark ? 'light' : 'dark'}/>

      {/* Premium Sticky Header */}
      <View 
        className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 flex-row items-center justify-between"
        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }}
      >
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View className="flex-row items-baseline">
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => isSelectionMode ? setIsSelectionMode(false) : null}
            disabled={!isSelectionMode}
            className="flex-row items-center"
          >
            {isSelectionMode && <Ionicons name="close" size={24} color={isDark ? 'white' : 'black'} style={{ marginRight: 12 }} />}
            <Text className={`text-2xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
               {isSelectionMode ? 'Select' : 'History'}
            </Text>
          </TouchableOpacity>
          <View className="w-1.5 h-1.5 rounded-full ml-2" style={{ backgroundColor: primary }} />
        </View>

        <View className="flex-row space-x-2">
           {!isSelectionMode ? (
             <>
               <TouchableOpacity
                 onPress={toggleLayout}
                 className={`w-10 h-10 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-black/5'}`}
               >
                 <Feather name={layoutMode === 'grid' ? "list" : "grid"} size={20} color={isDark ? 'white' : 'black'} />
               </TouchableOpacity>
               {uniqueHistory.length > 0 && (
                 <TouchableOpacity
                   onPress={() => clearHistory()}
                   className={`px-4 h-10 items-center justify-center rounded-full border ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}
                 >
                   <Text className={`${isDark ? 'text-white/60' : 'text-black/60'} text-[10px] font-black uppercase tracking-widest`}>Clear</Text>
                 </TouchableOpacity>
               )}
             </>
           ) : (
             <>
               <TouchableOpacity
                 onPress={handleSelectAll}
                 className={`w-10 h-10 items-center justify-center rounded-full ${isDark ? 'bg-white/10' : 'bg-black/5'}`}
               >
                 <MaterialCommunityIcons name={selectedLinks.size === uniqueHistory.length ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline"} size={20} color={primary} />
               </TouchableOpacity>
               {selectedLinks.size > 0 && (
                 <TouchableOpacity
                   onPress={handleDeleteSelected}
                   className="w-10 h-10 items-center justify-center rounded-full bg-red-500/20 border border-red-500/20"
                 >
                   <Feather name="trash-2" size={20} color="#ef4444" />
                 </TouchableOpacity>
               )}
             </>
           )}
        </View>
      </View>

      <FlashList
        key={layoutMode}
        data={uniqueHistory}
        numColumns={numColumns}
        estimatedItemSize={layoutMode === 'grid' ? 180 : 130}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 130, paddingBottom: 150 }}
        keyExtractor={(item, index) => item.link ? item.link.toString() : index.toString()}
        extraData={{ selectedLinks, isSelectionMode, progressData, layoutMode }}
        renderItem={({item, index}) => (
          <WatchHistoryCard
            item={item}
            index={index}
            layout={layoutMode}
            progress={progressData[item.link] || 0}
            isSelectionMode={isSelectionMode}
            isSelected={selectedLinks.has(item.link)}
            onPress={() => isSelectionMode ? toggleSelection(item.link) : handleNavigateToInfo(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        ListHeaderComponent={
          <View className="px-6 mb-8 mt-4">
             <View className="flex-row items-baseline">
                <Text className={`text-2xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
                   Your Chronicles
                </Text>
                <Text className={`ml-3 text-[10px] font-black uppercase tracking-[2px] opacity-40 ${isDark ? 'text-white' : 'text-black'}`}>
                   {uniqueHistory.length} items
                </Text>
             </View>
          </View>
        }
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-20 px-8">
            <View className={`w-28 h-28 rounded-[40px] items-center justify-center mb-8 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5 shadow-lg'}`}>
              <MaterialCommunityIcons name="history" size={60} color={primary} />
            </View>
            <Text className={`${isDark ? 'text-white' : 'text-black'} font-black text-2xl text-center italic tracking-tighter`}>
               The Archives are Empty
            </Text>
            <Text className={`text-[10px] font-black text-center mt-3 uppercase tracking-[3px] opacity-40 px-10 leading-4 ${isDark ? 'text-white' : 'text-black'}`}>
               Your journey has yet to be recorded. Commencing your voyage will populate this space with your trails.
            </Text>
          </View>
        )}
        style={layoutMode === 'grid' ? { paddingHorizontal: 6 } : { paddingHorizontal: 12 }}
      />
    </View>
  );
};

export default WatchHistory;
