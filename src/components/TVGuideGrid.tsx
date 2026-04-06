import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'react-native-linear-gradient';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const PIXELS_PER_MINUTE = 4;
const ROW_HEIGHT = 70;
const LOGO_WIDTH = 80;
const TIMELINE_MINUTES = 24 * 60; // 24 hours
const TOTAL_WIDTH = TIMELINE_MINUTES * PIXELS_PER_MINUTE;

export const TVGuideGrid = ({ channels, epgData, isDark, primary, onPlay }: any) => {
  const scrollX = useSharedValue(0);
  const [now, setNow] = useState(Date.now());
  const [currentTimeMs, setCurrentTimeMs] = useState(0); // Offset into the day

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  useEffect(() => {
    const timer = setInterval(() => {
      const ms = Date.now();
      setNow(ms);
      setCurrentTimeMs(ms - startOfDay);
    }, 60000);
    setCurrentTimeMs(Date.now() - startOfDay);
    return () => clearInterval(timer);
  }, [startOfDay]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const animatedStickyStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: scrollX.value }],
      zIndex: 10,
    };
  });

  // Calculate now line position
  const nowPosition = (currentTimeMs / 60000) * PIXELS_PER_MINUTE;

  // Generate hourly blocks (e.g., 00:00, 01:00)
  const timeBlocks = useMemo(() => {
    const blocks = [];
    for (let i = 0; i < 24; i++) {
       const label = `${i.toString().padStart(2, '0')}:00`;
       blocks.push({ label, left: i * 60 * PIXELS_PER_MINUTE });
    }
    return blocks;
  }, []);

  const renderChannelRow = ({ item }: any) => {
    const programs = epgData?.[item.url] || [];
    
    return (
      <View style={{ flexDirection: 'row', height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
        
        {/* Sticky Logo Column */}
        <Animated.View style={[{ width: LOGO_WIDTH, backgroundColor: isDark ? '#141414' : '#fff', borderRightWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', zIndex: 10, paddingHorizontal: 4 }, animatedStickyStyle]}>
           {item.logo ? (
              <Image source={{ uri: item.logo }} style={{ width: '80%', height: '40%', resizeMode: 'contain' }} />
           ) : (
              <Text style={{ color: primary, fontSize: 10, fontWeight: 'bold' }} numberOfLines={1}>{item.name}</Text>
           )}
           <Text style={{ fontSize: 7, color: isDark ? '#666' : '#999', marginTop: 6, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
              {item.category || 'LIVE'}
           </Text>
        </Animated.View>

        {/* Timetable Rows */}
        <View style={{ width: TOTAL_WIDTH, height: ROW_HEIGHT, backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5', position: 'relative' }}>
           {programs.map((prog: any, idx: number) => {
              const startOff = (prog.startTs - startOfDay) / 60000;
              const stopOff = (prog.stopTs - startOfDay) / 60000;
              
              if (stopOff <= 0 || startOff >= TIMELINE_MINUTES) return null; // Outside today
              
              const pLeft = Math.max(0, startOff) * PIXELS_PER_MINUTE;
              const pRight = Math.min(TIMELINE_MINUTES, stopOff) * PIXELS_PER_MINUTE;
              const pWidth = pRight - pLeft;

              if (pWidth <= 0) return null;

              const isLive = startOff * 60000 + startOfDay <= now && stopOff * 60000 + startOfDay >= now;

              return (
                 <TouchableOpacity 
                   key={idx}
                   onPress={() => onPlay(item)}
                   activeOpacity={0.8}
                   style={{ 
                     position: 'absolute', 
                     left: pLeft + 1, 
                     width: pWidth - 2, 
                     height: ROW_HEIGHT - 6,
                     top: 3,
                     backgroundColor: isLive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : (isDark ? '#1a1a1a' : '#e5e5e5'),
                     borderRadius: 6,
                     justifyContent: 'center',
                     paddingHorizontal: 8,
                     borderWidth: isLive ? 1 : 0,
                     borderColor: isLive ? primary : 'transparent'
                   }}
                 >
                    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: isLive ? 'bold' : '600', color: isDark ? '#fff' : '#000' }}>
                      {prog.title}
                    </Text>
                    {isLive && (
                      <View style={{ marginTop: 4, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', width: '100%', borderRadius: 2 }}>
                         <View style={{ width: `${Math.max(0, Math.min(100, ((now - prog.startTs) / (prog.stopTs - prog.startTs)) * 100))}%`, height: '100%', backgroundColor: primary, borderRadius: 2 }} />
                      </View>
                    )}
                 </TouchableOpacity>
              );
           })}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0f0f0f' : '#ffffff' }}>
      <Animated.ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: Math.max(0, nowPosition - (WINDOW_WIDTH / 2) + LOGO_WIDTH), y: 0 }}
      >
         <View style={{ width: TOTAL_WIDTH + LOGO_WIDTH }}>
            {/* Header Timeline */}
            <View style={{ height: 40, flexDirection: 'row', backgroundColor: isDark ? '#000' : '#fff', borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
               {/* Sticky corner over timeline */}
               <Animated.View style={[{ width: LOGO_WIDTH, height: 40, backgroundColor: isDark ? '#000' : '#fff', zIndex: 11 }, animatedStickyStyle]} />
               <View style={{ width: TOTAL_WIDTH, height: 40, position: 'relative' }}>
                  {timeBlocks.map((blk, i) => (
                    <View key={i} style={{ position: 'absolute', left: blk.left, width: 60 * PIXELS_PER_MINUTE, paddingLeft: 8, justifyContent: 'center', height: '100%', borderLeftWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                       <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#888' : '#888' }}>{blk.label}</Text>
                    </View>
                  ))}
               </View>
            </View>

            {/* Grid Container */}
            <View style={{ flex: 1 }}>
               <FlatList
                 data={channels}
                 renderItem={renderChannelRow}
                 getItemLayout={(data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
                 showsVerticalScrollIndicator={false}
                 contentContainerStyle={{ paddingBottom: 100 }}
                 keyExtractor={(item) => item.url}
                 windowSize={5}
                 maxToRenderPerBatch={10}
               />
               
               {/* Global NOW Line Indicator */}
               {nowPosition > 0 && nowPosition < TOTAL_WIDTH && (
                  <View style={{ position: 'absolute', left: nowPosition + LOGO_WIDTH, top: -40, bottom: 0, width: 2, backgroundColor: 'red', zIndex: 5 }}>
                    <View style={{ position: 'absolute', top: 5, left: -14, backgroundColor: 'red', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                       <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>NOW</Text>
                    </View>
                  </View>
               )}
            </View>
         </View>
      </Animated.ScrollView>
    </View>
  );
};
