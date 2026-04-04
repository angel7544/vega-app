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
  const {history, clearHistory} = useWatchHistoryStore(state => state);
  const [progressData, setProgressData] = useState<Record<string, number>>({});

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
          // First try to get the dedicated watch history progress
          // Use the infoUrl or link as the key, matching Player.tsx
          const historyKey = item.link;
          const historyProgressKey = `watch_history_progress_${historyKey}`;
          const storedProgress = mainStorage.getString(historyProgressKey);
          // Log what we're looking for and what we found
          console.log(
            `Looking for progress: ${historyProgressKey}`,
            storedProgress ? 'FOUND' : 'NOT FOUND',
          );

          if (storedProgress) {
            const parsed = JSON.parse(storedProgress);
            console.log(`Progress data for ${item.title}:`, {
              percentage: parsed.percentage?.toFixed(1) + '%',
              currentTime: parsed.currentTime?.toFixed(1),
              duration: parsed.duration?.toFixed(1),
              updatedAt: new Date(parsed.updatedAt).toLocaleTimeString(),
            });
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
          // Try episode-specific key if this item has an episodeTitle
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

          // Fall back to standard video position cache
          const cachedProgress = mainStorage.getString(item.link);
          if (cachedProgress) {
            const parsed = JSON.parse(cachedProgress);
            if (parsed.position && parsed.duration) {
              const percentage = (parsed.position / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
              return;
            }
          }

          // Use the progress from history item itself as last resort
          if (item.currentTime && item.duration) {
            const percentage = (item.currentTime / item.duration) * 100;
            progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
            return;
          }
        } catch (e) {
          console.error('Error processing progress for item:', item.title, e);
        }
      });
      console.log('Final progress data loaded:', progressMap);
      setProgressData(progressMap);
    };

    loadProgressData();
  }, [uniqueHistory]);

  const handlePlayDirectly = (item: any) => {
    console.log('🎬 Direct Play Triggered for:', item.title);
    
    // If we have cached player params, go straight to Player
    if (item.cachedInfoData && item.cachedInfoData.episodeList) {
      try {
        console.log('✅ Found cached player data, navigating to Player');
        // Use the full cached data but override with current history item details
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

        // Navigate to the root Player screen
        // Using 'Player' directly works if the navigation object allows it
        (navigation as any).navigate('Player', playerParams);
        return;
      } catch (e) {
        console.error('❌ Failed to navigate directly to Player:', e);
      }
    } else {
      console.log('⚠️ No cached player data found for this item');
    }

    // Fallback to Info screen if direct play is not possible
    handleNavigateToInfo(item);
  };

  const handleNavigateToInfo = (item: any) => {
    try {
      // Parse the link if it's a JSON string
      let linkData = item.link;
      if (typeof item.link === 'string' && item.link.startsWith('{')) {
        try {
          linkData = JSON.parse(item.link);
        } catch (e) {
          console.error('Failed to parse link:', e);
        }
      }

      // Simple direct navigation to Info screen
      navigation.navigate('Info' as any, {
        link: linkData,
        provider: item.provider || 'multiStream',
        poster: item.image || '',
      });
    } catch (error) {
      console.error('Navigation error:', error);
    }
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
    // Look for S01 E05, Season 1 Episode 5, or just Episode 5
    const match = title.match(/(?:S|Season\s*)(\d+)?.*(?:E|Episode\s*|EP\s*)(\d+)/i);
    if (match) {
      const s = match[1] ? `S${match[1].padStart(2, '0')}` : '';
      const e = match[2] ? `EP ${match[2].padStart(2, '0')}` : `EP ${match[0].match(/\d+/)?.[0].padStart(2, '0') || ''}`;
      return s ? `${s} ${e}` : e;
    }
    
    // Fallback search for any standalone number if 'Episode' etc isn't found but desired
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

      {/* Header Space for Status Bar */}
      <View
        style={{
          paddingTop: Platform.OS === 'android' ? 40 : 60,
        }}
      />

      <View className="flex-1 px-4">
        {/* Title and Action */}
        <View className="flex-row justify-between items-end mb-8">
          <View className="flex-row items-baseline">
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-4xl font-bold`}>
              History
            </Text>
            {uniqueHistory.length > 0 && (
              <Text className={`text-lg ml-3 ${mode === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {uniqueHistory.length} items
              </Text>
            )}
          </View>
          
          {uniqueHistory.length > 0 && (
            <TouchableOpacity
              onPress={() => clearHistory()}
              className={`${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'} px-4 py-2 rounded-full border ${mode === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <Text className={`${mode === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-xs font-bold uppercase tracking-widest`}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <FlashList
          data={uniqueHistory}
          estimatedItemSize={120}
          numColumns={1}
          contentContainerStyle={{ paddingBottom: 100 }}
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

            return (
              <TouchableOpacity
                onPress={() => handleNavigateToInfo(item)}
                activeOpacity={0.9}
                className={`flex-row p-3 mb-4 rounded-3xl ${
                  mode === 'dark' ? 'bg-[#121212]' : 'bg-gray-50'
                } border ${mode === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                
                {/* Thumbnail */}
                <View 
                  className="rounded-2xl overflow-hidden shadow-lg relative"
                  style={{ width: 90, height: 135, backgroundColor: mode === 'dark' ? '#1a1a1a' : '#f0f0f0' }}>
                  <Image
                    source={{uri: item.poster || item.image || ''}}
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                  
                  {/* Completion Badge */}
                  {isCompleted && (
                    <View className="absolute top-2 right-2 bg-primary p-1 rounded-full shadow-md">
                      <MaterialCommunityIcons name="check" size={10} color="white" />
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

                  {/* Progress Section */}
                  <View className="mt-auto">
                    <View className="flex-row justify-between items-center">
                       <View className="flex-row items-center">
                         <Feather name="play-circle" size={12} color={isCompleted ? primary : (mode === 'dark' ? '#666' : '#999')} />
                         <Text className={`text-[10px] font-black ml-1.5 uppercase tracking-tighter ${isCompleted ? 'text-primary' : (mode === 'dark' ? 'text-gray-500' : 'text-gray-400')}`}>
                            {isCompleted ? 'Finished' : `${Math.round(progress)}% • ${remainingTime || 'Watched'}`}
                         </Text>
                       </View>

                       {!isCompleted && (
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
                    
                    {/* Progress Bar Container */}
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
