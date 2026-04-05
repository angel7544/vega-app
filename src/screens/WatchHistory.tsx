import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {FlashList} from '@shopify/flash-list';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WatchHistoryStackParamList} from '../App';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import useThemeStore from '../lib/zustand/themeStore';
import {mainStorage} from '../lib/storage';

type Props = NativeStackScreenProps<WatchHistoryStackParamList, 'WatchHistory'>;
const WatchHistory = ({navigation}: Props) => {
  const {primary, mode} = useThemeStore(state => state);
  const {history, clearHistory, removeItems} = useWatchHistoryStore(state => state);
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());

  // Filter out duplicates by link, keeping only the most recent entry
  const uniqueHistory = React.useMemo(() => {
    const seen = new Set();
    return history.filter(item => {
      if (seen.has(item.link)) {
        return false;
      }
      seen.add(item.link);
      return true;
    });
  }, [history]);

  // Load all progress data when component mounts
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
              progressMap[item.link] = Math.min(
                Math.max(parsed.percentage, 0),
                100,
              );
              return;
            } else if (parsed.currentTime && parsed.duration) {
              const percentage = (parsed.currentTime / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
              return;
            }
          }
          if (item.episodeTitle) {
            const episodeKey = `watch_history_progress_${historyKey}_${item.episodeTitle.replace(
              /\s+/g,
              '_',
            )}`;
            const episodeData = mainStorage.getString(episodeKey);
            if (episodeData) {
              const parsed = JSON.parse(episodeData);
              if (parsed.percentage) {
                progressMap[item.link] = Math.min(
                  Math.max(parsed.percentage, 0),
                  100,
                );
                return;
              }
            }
          }

          const cachedProgress = mainStorage.getString(item.link);
          if (cachedProgress) {
            const parsed = JSON.parse(cachedProgress);
            if (parsed.position && parsed.duration) {
              const percentage = (parsed.position / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
              return;
            }
          }

          if (item.currentTime && item.duration) {
            const percentage = (item.currentTime / item.duration) * 100;
            progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
            return;
          }
        } catch (e) {
          console.error('Error processing progress for item:', item.title, e);
        }
      });
      setProgressData(progressMap);
    };

    loadProgressData();
  }, [uniqueHistory]);

  const handleNavigateToInfo = (item: any) => {
    try {
      let linkData = item.link;
      if (typeof item.link === 'string' && item.link.startsWith('{')) {
        try {
          linkData = JSON.parse(item.link);
        } catch (e) {
          console.error('Failed to parse link:', e);
        }
      }

      navigation.navigate('Info' as any, {
        link: linkData,
        provider: item.provider || 'multiStream',
        poster: item.image || '',
      });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handlePlayDirectly = (item: any) => {
    if (item.cachedInfoData && item.cachedInfoData.episodeList) {
      try {
        const playerParams = {
          ...item.cachedInfoData,
          linkIndex: item.cachedInfoData.linkIndex ?? 0,
          primaryTitle: item.title,
          secondaryTitle: item.episodeTitle,
          providerValue: item.provider,
          infoUrl: item.link,
          poster: {
             poster: item.poster || item.image,
             background: item.poster || item.image
          }
        };

        (navigation as any).navigate('Player', playerParams);
        return;
      } catch (e) {
        console.error('❌ Failed to navigate directly to Player:', e);
      }
    }

    handleNavigateToInfo(item);
  };

  const toggleSelection = (link: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(link)) {
        newSet.delete(link);
      } else {
        newSet.add(link);
      }
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
    if (selectedLinks.size === uniqueHistory.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(uniqueHistory.map(item => item.link)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLinks.size === 0) return;
    removeItems(Array.from(selectedLinks));
    setIsSelectionMode(false);
    setSelectedLinks(new Set());
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedLinks(new Set());
  };

  const formatTimeRemaining = (current?: number, total?: number) => {
    if (!current || !total || total <= 0) return null;
    const remainingSeconds = total - current;
    if (remainingSeconds <= 0) return 'Finished';
    
    const minutes = Math.floor(remainingSeconds / 60);
    if (minutes < 1) return 'Less than a min left';
    if (minutes < 60) return `${minutes} min remaining`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m remaining`;
  };

  const extractEpisodeInfo = (title?: string) => {
    if (!title) return null;
    const match = title.match(/(?:S|Season\s*)(\d+)?.*(?:E|Episode\s*|EP\s*)(\d+)/i);
    if (match) {
      const s = match[1] ? `S${match[1].padStart(2, '0')}` : '';
      const e = match[2] ? `EP ${match[2].padStart(2, '0')}` : `EP ${match[0].match(/\d+/)?.[0].padStart(2, '0') || ''}`;
      return s ? `${s} ${e}` : e;
    }
    const standaloneMatch = title.match(/(?:^|\s)(\d+)(?:\s|$)/);
    if (standaloneMatch) {
      return `EP ${standaloneMatch[1].padStart(2, '0')}`;
    }
    return null;
  };

  return (
    <View className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
      />

      <View
        style={{
          paddingTop: Platform.OS === 'android' ? 40 : 60,
        }}
      />

      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-baseline flex-1">
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => isSelectionMode ? cancelSelection() : null}
              disabled={!isSelectionMode}
              className="flex-row items-center">
              {isSelectionMode && (
                <View className="mr-3">
                  <Ionicons name="close" size={28} color={mode === 'dark' ? 'white' : 'black'} />
                </View>
              )}
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-4xl font-bold`}>
                {isSelectionMode ? 'Select' : 'History'}
              </Text>
            </TouchableOpacity>
            {!isSelectionMode && uniqueHistory.length > 0 && (
              <Text className={`text-lg ml-3 ${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {uniqueHistory.length} items
              </Text>
            )}
            {isSelectionMode && (
              <Text className="text-lg ml-3 text-primary">
                {selectedLinks.size} selected
              </Text>
            )}
          </View>
          
          <View className="flex-row items-center">
            {isSelectionMode ? (
              <>
                <TouchableOpacity
                  onPress={handleSelectAll}
                  className={`${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'} p-2 rounded-full border ${mode === 'dark' ? 'border-white/10' : 'border-gray-200'} mr-2`}>
                  <MaterialCommunityIcons 
                    name={selectedLinks.size === uniqueHistory.length ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline"} 
                    size={20} 
                    color={primary} 
                  />
                </TouchableOpacity>
                {selectedLinks.size > 0 && (
                  <TouchableOpacity
                    onPress={handleDeleteSelected}
                    className="bg-red-500/10 p-2 rounded-full border border-red-500/20">
                    <Feather name="trash-2" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </>
            ) : uniqueHistory.length > 0 && (
              <TouchableOpacity
                onPress={() => clearHistory()}
                className={`${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'} px-4 py-2 rounded-full border ${mode === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <Text className={`${mode === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-xs font-bold uppercase tracking-widest`}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlashList
          data={uniqueHistory}
          estimatedItemSize={120}
          numColumns={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyExtractor={(item, index) => item.link ? item.link.toString() : index.toString()}
          extraData={{ selectedLinks, isSelectionMode, progressData, mode, primary }}
          ListEmptyComponent={() => (
            <View className="flex-1 justify-center items-center mt-20">
              <View className={`${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'} rounded-full p-8 mb-6`}>
                <MaterialCommunityIcons name="history" size={60} color={primary} />
              </View>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-bold text-lg text-center`}>
                History is empty
              </Text>
              <Text className={`${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm text-center mt-2 px-10`}>
                Movies and shows you watch will appear here with your progress
              </Text>
            </View>
          )}
          renderItem={({item}) => {
            const progress = progressData[item.link] || 0;
            const isCompleted = progress >= 95; 
            const remainingTime = formatTimeRemaining(item.currentTime, item.duration);
            const epCode = extractEpisodeInfo(item.episodeTitle);
            const isSelected = selectedLinks.has(item.link);

            return (
              <TouchableOpacity
                onLongPress={() => handleLongPress(item)}
                delayLongPress={300}
                onPress={() => isSelectionMode ? toggleSelection(item.link) : handleNavigateToInfo(item)}
                activeOpacity={0.9}
                className={`flex-row p-3 mb-4 rounded-3xl ${
                  isSelected 
                    ? (mode === 'dark' ? 'bg-primary/20' : 'bg-primary/10')
                    : (mode === 'dark' ? 'bg-[#121212]' : 'bg-gray-50')
                } border ${
                  isSelected
                    ? 'border-primary'
                    : (mode === 'dark' ? 'border-white/5' : 'border-gray-200')
                }`}>
                
                {/* Thumbnail */}
                <View 
                  className="rounded-2xl overflow-hidden shadow-lg relative"
                  style={{ width: 90, height: 135, backgroundColor: mode === 'dark' ? '#1a1a1a' : '#f0f0f0' }}>
                  <Image
                    source={{uri: item.poster || item.image || ''}}
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                  
                  {isCompleted && (
                    <View className="absolute top-2 right-2 bg-primary p-1 rounded-full shadow-md">
                      <MaterialCommunityIcons name="check" size={10} color="white" />
                    </View>
                  )}

                  {isSelectionMode && (
                    <View className={`absolute inset-0 items-center justify-center ${isSelected ? 'bg-primary/40' : 'bg-black/20'}`}>
                      <Ionicons 
                        name={isSelected ? "checkbox" : "square-outline"} 
                        size={32} 
                        color={isSelected ? "white" : "rgba(255,255,255,0.7)"} 
                      />
                    </View>
                  )}
                </View>

                {/* Details */}
                <View className="flex-1 ml-4 justify-between py-1">
                  <View>
                    <Text className={`text-[10px] ${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'} font-black uppercase tracking-widest`}>
                      {item.provider || 'Provider'}
                    </Text>
                    <Text
                      className={`text-lg font-bold ${mode === 'dark' ? 'text-white' : 'text-black'} mt-1`}
                      numberOfLines={1}>
                      {item.title}
                    </Text>
                    {(epCode || item.episodeTitle) && (
                      <View className="flex-row items-center mt-0.5">
                        {epCode && (
                          <View className="bg-primary/20 px-1.5 py-0.5 rounded mr-2">
                            <Text className="text-primary text-[10px] font-black">{epCode}</Text>
                          </View>
                        )}
                        <Text 
                          className={`flex-1 text-sm ${mode === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                          numberOfLines={1}>
                          {item.episodeTitle}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="mt-auto">
                    <View className="flex-row justify-between items-center">
                       <View className="flex-row items-center">
                         <Feather name="play-circle" size={12} color={isCompleted ? primary : (mode === 'dark' ? '#666' : '#999')} />
                         <Text className={`text-[10px] font-black ml-1.5 uppercase tracking-tighter ${isCompleted ? 'text-primary' : (mode === 'dark' ? 'text-gray-500' : 'text-gray-400')}`}>
                            {isCompleted ? 'Finished' : `${Math.round(progress)}% • ${remainingTime || 'Watched'}`}
                         </Text>
                       </View>

                       {!isCompleted && !isSelectionMode && (
                          <TouchableOpacity
                            onPress={() => handlePlayDirectly(item)}
                            style={{ backgroundColor: primary }}
                            className="flex-row items-center px-4 py-1.5 rounded-full shadow-lg shadow-primary/30">
                            <Ionicons name="play" size={12} color="white" />
                            <Text className="text-white text-[10px] font-black uppercase ml-1.5">
                              Continue
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                    
                    <View className={`h-1.5 w-full rounded-full overflow-hidden ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}>
                      <View 
                        style={{ 
                          width: `${progress}%`, 
                          height: '100%', 
                          backgroundColor: primary,
                          borderRadius: 10
                        }} 
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

export default WatchHistory;
