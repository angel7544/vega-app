import React, { useMemo, useState, useEffect, memo, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, useWindowDimensions, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'react-native-linear-gradient';
import { useNow } from '../lib/hooks/useNow';
import { Feather } from '@expo/vector-icons';

import usePlayerStore from '../lib/zustand/playerStore';

const PIXELS_PER_MINUTE = 4;
const ROW_HEIGHT = 90; // Increased for better readability
const LOGO_WIDTH = 100;
const TIMELINE_MINUTES = 24 * 60; 
const TOTAL_WIDTH = TIMELINE_MINUTES * PIXELS_PER_MINUTE;

const GuideRow = memo(({ item, isDark, primary, onPlay, scrollX, startOfDay }: any) => {
  // Granular subscription: Only re-render when THIS channel's EPG data changes
  const programs = usePlayerStore(state => state.epgData[item.url]);

  const animatedStickyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
    zIndex: 20,
  }));

  // Render only programs within 24h window
  const visiblePrograms = useMemo(() => {
    if (!Array.isArray(programs)) return [];
    const startOfDayVal = Number(startOfDay);
    const endOfDayVal = startOfDayVal + 24 * 60 * 60000;
    
    return programs.filter(p => {
      const stopTs = Number(p.stopTs);
      const startTs = Number(p.startTs);
      return stopTs > startOfDayVal && startTs < endOfDayVal;
    }).slice(0, 30); // Buffer of 30 items
  }, [programs, startOfDay]);

  return (
    <View style={{ flexDirection: 'row', height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)' }}>
      {/* Sticky Channel Side */}
      <Animated.View style={[{ 
        width: LOGO_WIDTH, 
        backgroundColor: isDark ? '#080808' : '#f8f8f8', 
        borderRightWidth: 1, 
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        zIndex: 20, 
        paddingHorizontal: 10
      }, animatedStickyStyle]}>
         <View style={{ 
           width: '100%', 
           height: '45%', 
           backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
           borderRadius: 14, 
           justifyContent: 'center', 
           alignItems: 'center',
           overflow: 'hidden',
           borderWidth: 1,
           borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
         }}>
           {!isDark && <View style={{ position: 'absolute', inset: 0, backgroundColor: 'black', opacity: 0.05 }} />}
           {item.logo ? (
              <Image source={{ uri: item.logo }} style={{ width: '75%', height: '75%', resizeMode: 'contain' }} />
           ) : (
              <Feather name="tv" size={16} color={primary} style={{ opacity: 0.5 }} />
           )}
         </View>
         <Text style={{ fontSize: 8, color: isDark ? '#444' : '#999', marginTop: 8, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' }} numberOfLines={1}>
            {item.name}
         </Text>
      </Animated.View>

      {/* Program Grid Scroll Area */}
      <View style={{ width: TOTAL_WIDTH, height: ROW_HEIGHT, backgroundColor: isDark ? '#000' : '#fcfcfc', position: 'relative' }}>
         {(!programs || programs.length === 0) ? (
            <View style={{ position: 'absolute', left: 20, top: 0, bottom: 0, justifyContent: 'center' }}>
               <Text style={{ fontSize: 10, color: isDark ? '#222' : '#ddd', fontWeight: 'bold' }}>Schedule Syncing...</Text>
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
               const pWidth = (Math.min(TIMELINE_MINUTES, stopOff) * PIXELS_PER_MINUTE) - pLeft;

               if (pWidth <= 1 || !isFinite(pWidth)) return null;

               const now = Date.now();
               const isLive = startTs <= now && stopTs >= now;
               const nextProg = isLive ? visiblePrograms[idx + 1] : null;

               return (
                  <TouchableOpacity 
                    key={`${prog.title}-${idx}`}
                    onPress={() => onPlay(item)}
                    activeOpacity={0.8}
                    style={{ 
                      position: 'absolute', 
                      left: pLeft + 3, 
                      width: pWidth - 6, 
                      height: ROW_HEIGHT - 16,
                      top: 8,
                      backgroundColor: isLive ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)') : (isDark ? '#0f0f0f' : '#f0f0f0'),
                      borderRadius: 14,
                      justifyContent: 'center',
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: isLive ? primary : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'),
                    }}
                  >
                     <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '900', color: isDark ? (isLive ? '#fff' : '#888') : (isLive ? '#000' : '#444'), letterSpacing: -0.2 }}>
                       {prog.title}
                     </Text>
                     
                     {isLive && (
                        <>
                          <View style={{ marginTop: 6, height: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', width: '100%', borderRadius: 4, overflow: 'hidden' }}>
                             <View style={{ 
                               width: `${Math.max(2, Math.min(100, (stopTs - startTs) > 0 ? ((now - startTs) / (stopTs - startTs)) * 100 : 0))}%`, 
                               height: '100%', 
                               backgroundColor: primary, 
                               borderRadius: 4 
                             }} />
                          </View>
                          {nextProg && (
                             <Text numberOfLines={1} style={{ fontSize: 7, fontWeight: '700', color: primary, marginTop: 4, textTransform: 'uppercase', opacity: 0.8 }}>
                               NEXT: {nextProg.title}
                             </Text>
                          )}
                        </>
                     )}
                  </TouchableOpacity>
               );
            })
         )}
      </View>
    </View>
  );
});

export const TVGuideGrid = ({ channels, isDark, primary, onPlay, onVisibleChannelsChanged }: any) => {
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
    zIndex: 30,
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
      isDark={isDark} 
      primary={primary} 
      onPlay={onPlay} 
      scrollX={scrollX}
      startOfDay={startOfDay}
    />
  ), [isDark, primary, onPlay, startOfDay]);

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
        scrollEventThrottle={32}
        contentOffset={{ x: Math.max(0, nowPosition - (windowWidth / 2) + LOGO_WIDTH), y: 0 }}
      >
         <View style={{ width: TOTAL_WIDTH + LOGO_WIDTH, flex: 1 }}>
            {/* Header Timeline */}
            <View style={{ height: 55, flexDirection: 'row', backgroundColor: isDark ? '#080808' : '#ffffff', borderBottomWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
               <Animated.View style={[{ width: LOGO_WIDTH, height: 55, backgroundColor: isDark ? '#080808' : '#fff', zIndex: 30, borderRightWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }, animatedHeaderStickyStyle]} />
               <View style={{ width: TOTAL_WIDTH, height: 55, position: 'relative' }}>
                  {timeBlocks.map((blk, i) => (
                    <View key={i} style={{ position: 'absolute', left: blk.left, width: 60 * PIXELS_PER_MINUTE, paddingLeft: 12, justifyContent: 'center', height: '100%', borderLeftWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                       <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#333' : '#bbb', letterSpacing: 1 }}>{blk.label}</Text>
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
         </View>
      </Animated.ScrollView>
    </View>
  );
};
