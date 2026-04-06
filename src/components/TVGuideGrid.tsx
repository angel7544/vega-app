import React, { useMemo, useState, useEffect, memo, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, FlatList, useWindowDimensions, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'react-native-linear-gradient';
import { useNow } from '../lib/hooks/useNow';

const PIXELS_PER_MINUTE = 4;
const ROW_HEIGHT = 70;
const LOGO_WIDTH = 80;
const TIMELINE_MINUTES = 24 * 60; // 24 hours
const TOTAL_WIDTH = TIMELINE_MINUTES * PIXELS_PER_MINUTE;

const GuideRow = memo(({ item, programs, isDark, primary, onPlay, scrollX, startOfDay }: any) => {
  const animatedStickyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
    zIndex: 10,
  }));

  // Render only programs within visible range + buffer
  const visiblePrograms = useMemo(() => {
    if (!Array.isArray(programs)) return [];
    // Filter programs to only those relevant to the current 24h view to save memory
    const startOfDayVal = Number(startOfDay);
    const endOfDayVal = startOfDayVal + 24 * 60 * 60000;
    
    return programs.filter(p => {
      const stopTs = Number(p.stopTs);
      const startTs = Number(p.startTs);
      return stopTs > startOfDayVal && startTs < endOfDayVal;
    }).slice(0, 50); 
  }, [programs, startOfDay]);

  return (
    <View style={{ flexDirection: 'row', height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
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

      <View style={{ width: TOTAL_WIDTH, height: ROW_HEIGHT, backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5', position: 'relative' }}>
         {visiblePrograms.map((prog: any, idx: number) => {
            const startTs = Number(prog.startTs) || 0;
            const stopTs = Number(prog.stopTs) || 0;
            const startOfDayVal = Number(startOfDay) || 0;

            const startOff = (startTs - startOfDayVal) / 60000;
            const stopOff = (stopTs - startOfDayVal) / 60000;
            
            if (stopOff <= 0 || startOff >= TIMELINE_MINUTES) return null;
            
            const pLeft = Math.max(0, startOff) * PIXELS_PER_MINUTE;
            const pRight = Math.min(TIMELINE_MINUTES, stopOff) * PIXELS_PER_MINUTE;
            const pWidth = pRight - pLeft;

            if (pWidth <= 0 || !isFinite(pWidth)) return null;

            const now = Date.now();
            const isLive = startTs <= now && stopTs >= now;

            return (
               <TouchableOpacity 
                 key={`${prog.title}-${idx}`}
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
                       <View style={{ 
                         width: `${Math.max(0, Math.min(100, (stopTs - startTs) > 0 ? ((now - startTs) / (stopTs - startTs)) * 100 : 0))}%`, 
                         height: '100%', 
                         backgroundColor: primary, 
                         borderRadius: 2 
                       }} />
                    </View>
                  )}
               </TouchableOpacity>
            );
         })}
      </View>
    </View>
  );
});

export const TVGuideGrid = ({ channels, epgData, isDark, primary, onPlay, onVisibleChannelsChanged }: any) => {
  const { width: windowWidth } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const now = useNow();

  const startOfDay = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const currentTimeMs = now - startOfDay;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const animatedHeaderStickyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
    zIndex: 11,
  }));

  const nowPosition = isFinite(currentTimeMs) ? (currentTimeMs / 60000) * PIXELS_PER_MINUTE : 0;

  const timeBlocks = useMemo(() => {
    const blocks = [];
    for (let i = 0; i < 24; i++) {
       const label = `${i.toString().padStart(2, '0')}:00`;
       blocks.push({ label, left: i * 60 * PIXELS_PER_MINUTE });
    }
    return blocks;
  }, []);

  const renderItem = useCallback(({ item }: any) => (
    <GuideRow 
      item={item} 
      programs={epgData?.[item.url]} 
      isDark={isDark} 
      primary={primary} 
      onPlay={onPlay} 
      scrollX={scrollX}
      startOfDay={startOfDay}
    />
  ), [epgData, isDark, primary, onPlay, startOfDay]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (onVisibleChannelsChanged && viewableItems.length > 0) {
      const visibleIndices = viewableItems.map((v: any) => v.item);
      onVisibleChannelsChanged(visibleIndices);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 1,
    minimumViewTime: 200,
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0f0f0f' : '#ffffff' }}>
      <Animated.ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: Math.max(0, nowPosition - (windowWidth / 2) + LOGO_WIDTH), y: 0 }}
      >
         <View style={{ width: TOTAL_WIDTH + LOGO_WIDTH, flex: 1 }}>
            {/* Header Timeline */}
            <View style={{ height: 40, flexDirection: 'row', backgroundColor: isDark ? '#000' : '#fff', borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
               <Animated.View style={[{ width: LOGO_WIDTH, height: 40, backgroundColor: isDark ? '#000' : '#fff', zIndex: 11 }, animatedHeaderStickyStyle]} />
               <View style={{ width: TOTAL_WIDTH, height: 40, position: 'relative' }}>
                  {timeBlocks.map((blk, i) => (
                    <View key={i} style={{ position: 'absolute', left: blk.left, width: 60 * PIXELS_PER_MINUTE, paddingLeft: 8, justifyContent: 'center', height: '100%', borderLeftWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                       <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#888' : '#888' }}>{blk.label}</Text>
                    </View>
                  ))}
               </View>
            </View>

            {/* Grid Container - Virtualized Vertical List */}
            <FlatList
              data={channels}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.url}-${index}`}
              showsVerticalScrollIndicator={false}
              windowSize={5}
              maxToRenderPerBatch={5}
              initialNumToRender={10}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              removeClippedSubviews={Platform.OS === 'android'}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
            
            {/* Global NOW Line Indicator */}
            {nowPosition > 0 && nowPosition < TOTAL_WIDTH && (
               <Animated.View style={[{ 
                 position: 'absolute', 
                 left: nowPosition + LOGO_WIDTH, 
                 top: 0, 
                 bottom: 0, 
                 width: 2, 
                 backgroundColor: 'red', 
                 zIndex: 5 
               }, animatedHeaderStickyStyle]}>
                 <View style={{ position: 'absolute', top: 45, left: -14, backgroundColor: 'red', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>NOW</Text>
                 </View>
               </Animated.View>
            )}
         </View>
      </Animated.ScrollView>
    </View>
  );
};
