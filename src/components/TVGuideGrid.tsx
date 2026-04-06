import React, { useMemo, useState, useEffect, memo, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, useWindowDimensions, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'react-native-linear-gradient';
import { useNow } from '../lib/hooks/useNow';
import { Feather } from '@expo/vector-icons';

const PIXELS_PER_MINUTE = 4;
const ROW_HEIGHT = 80;
const LOGO_WIDTH = 100;
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
    const startOfDayVal = Number(startOfDay);
    const endOfDayVal = startOfDayVal + 24 * 60 * 60000;
    
    return programs.filter(p => {
      const stopTs = Number(p.stopTs);
      const startTs = Number(p.startTs);
      return stopTs > startOfDayVal && startTs < endOfDayVal;
    }).slice(0, 40); 
  }, [programs, startOfDay]);

  return (
    <View style={{ flexDirection: 'row', height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
      <Animated.View style={[{ 
        width: LOGO_WIDTH, 
        backgroundColor: isDark ? '#0f0f0f' : '#f8f8f8', 
        borderRightWidth: 1, 
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        zIndex: 10, 
        paddingHorizontal: 8 
      }, animatedStickyStyle]}>
         <View style={{ 
           width: '100%', 
           height: '50%', 
           backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
           borderRadius: 12, 
           justifyContent: 'center', 
           alignItems: 'center',
           overflow: 'hidden'
         }}>
           {!isDark && <View style={{ position: 'absolute', inset: 0, backgroundColor: 'black', opacity: 0.05 }} />}
           {item.logo ? (
              <Image source={{ uri: item.logo }} style={{ width: '70%', height: '70%', resizeMode: 'contain' }} />
           ) : (
              <Feather name="tv" size={16} color={primary} style={{ opacity: 0.5 }} />
           )}
         </View>
         <Text style={{ fontSize: 8, color: isDark ? '#555' : '#888', marginTop: 6, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }} numberOfLines={1}>
            {item.name}
         </Text>
      </Animated.View>

      <View style={{ width: TOTAL_WIDTH, height: ROW_HEIGHT, backgroundColor: isDark ? '#0a0a0a' : '#f0f0f0', position: 'relative' }}>
         {(!programs || programs.length === 0) ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingLeft: 20 }}>
               <Text style={{ fontSize: 10, color: isDark ? '#333' : '#bbb', fontWeight: 'bold' }}>Schedule Syncing...</Text>
            </View>
         ) : (
            visiblePrograms.map((prog: any, idx: number) => {
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
                      left: pLeft + 2, 
                      width: pWidth - 4, 
                      height: ROW_HEIGHT - 12,
                      top: 6,
                      backgroundColor: isLive ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)') : (isDark ? '#161616' : '#e8e8e8'),
                      borderRadius: 12,
                      justifyContent: 'center',
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: isLive ? primary : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                      shadowColor: isLive ? primary : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isLive ? 0.3 : 0.05,
                      shadowRadius: 4,
                      elevation: isLive ? 4 : 1
                    }}
                  >
                     <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#fff' : '#000', letterSpacing: -0.2 }}>
                       {prog.title}
                     </Text>
                     {isLive && (
                        <View style={{ marginTop: 6, height: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', width: '100%', borderRadius: 4, overflow: 'hidden' }}>
                           <View style={{ 
                             width: `${Math.max(2, Math.min(100, (stopTs - startTs) > 0 ? ((now - startTs) / (stopTs - startTs)) * 100 : 0))}%`, 
                             height: '100%', 
                             backgroundColor: primary, 
                             borderRadius: 4 
                           }} />
                        </View>
                     )}
                  </TouchableOpacity>
               );
            })
         )}
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

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (onVisibleChannelsChanged && viewableItems && viewableItems.length > 0) {
      const visibleItems = viewableItems.map((v) => v.item);
      onVisibleChannelsChanged(visibleItems);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    minimumViewTime: 100,
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <Animated.ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: Math.max(0, nowPosition - (windowWidth / 2) + LOGO_WIDTH), y: 0 }}
      >
         <View style={{ width: TOTAL_WIDTH + LOGO_WIDTH, flex: 1 }}>
            {/* Header Timeline */}
            <View style={{ height: 50, flexDirection: 'row', backgroundColor: isDark ? '#080808' : '#ffffff', borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
               <Animated.View style={[{ width: LOGO_WIDTH, height: 50, backgroundColor: isDark ? '#080808' : '#fff', zIndex: 11, borderRightWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, animatedHeaderStickyStyle]} />
               <View style={{ width: TOTAL_WIDTH, height: 50, position: 'relative' }}>
                  {timeBlocks.map((blk, i) => (
                    <View key={i} style={{ position: 'absolute', left: blk.left, width: 60 * PIXELS_PER_MINUTE, paddingLeft: 12, justifyContent: 'center', height: '100%', borderLeftWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                       <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#444' : '#888', letterSpacing: 1 }}>{blk.label}</Text>
                    </View>
                  ))}
               </View>
            </View>

            {/* Grid Container - Virtualized Vertical List */}
            <FlashList
              data={channels}
              renderItem={renderItem}
              keyExtractor={(item: any, index: number) => `${item.url}-${index}`}
              estimatedItemSize={ROW_HEIGHT}
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={{ paddingBottom: 150 }}
            />
            
            {/* Global NOW Line Indicator */}
            {nowPosition > 0 && nowPosition < TOTAL_WIDTH && (
               <Animated.View style={[{ 
                 position: 'absolute', 
                 left: nowPosition + LOGO_WIDTH, 
                 top: 0, 
                 bottom: 0, 
                 width: 3, 
                 backgroundColor: 'red', 
                 zIndex: 15,
                 shadowColor: 'red',
                 shadowOffset: { width: 0, height: 0 },
                 shadowOpacity: 0.5,
                 shadowRadius: 10,
               }, animatedHeaderStickyStyle]}>
                 <View style={{ position: 'absolute', top: 55, left: -22, backgroundColor: 'red', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>NOW</Text>
                 </View>
               </Animated.View>
            )}
         </View>
      </Animated.ScrollView>
    </View>
  );
};
