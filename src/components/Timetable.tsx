import React, { useMemo } from 'react';
import { View, Text, FlatList, Image, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import useThemeStore from '../lib/zustand/themeStore';
import { Program } from '../types/navigation';

interface TimetableProps {
  programs?: Program[];
  now: number;
  onSetLivePosition?: (y: number) => void;
}

/** Format minutes into "1h 20m" or "45m" */
function formatDuration(startTs: number, stopTs: number): string {
  const diffMin = Math.round((stopTs - startTs) / 60000);
  if (diffMin <= 0) return '';
  if (diffMin >= 60) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${diffMin}m`;
}

/** How far through a program are we? Returns 0–1 */
function getProgress(startTs: number, stopTs: number, now: number): number {
  if (!startTs || !stopTs || stopTs <= startTs) return 0;
  const total = stopTs - startTs;
  const elapsed = now - startTs;
  return Math.min(Math.max(elapsed / total, 0), 1);
}

const Timetable: React.FC<TimetableProps> = ({ programs = [], now, onSetLivePosition }) => {
  const { mode, primary } = useThemeStore();
  const isDark = mode === 'dark';
  const hasReportedLivePos = React.useRef(false);

  const filteredPrograms = useMemo(() => {
    // Show current playing and future programs
    return programs.filter(p => !p.stopTs || p.stopTs > now);
  }, [programs, now]);

  const renderItem = (item: Program, index: number) => {
    const startTs = item.startTs ?? 0;
    const stopTs = item.stopTs ?? 0;

    const isLive =
      startTs > 0 && stopTs > 0 && now >= startTs && now < stopTs;
    const isUpcoming = startTs > 0 && now < startTs;
    const isPast = stopTs > 0 && now >= stopTs;

    const duration =
      startTs > 0 && stopTs > 0 ? formatDuration(startTs, stopTs) : '';
    const progress =
      isLive ? getProgress(startTs, stopTs, now) : 0;

    return (
      <View
        key={index}
        onLayout={isLive && !hasReportedLivePos.current ? (e) => {
          hasReportedLivePos.current = true;
          if (onSetLivePosition) onSetLivePosition(e.nativeEvent.layout.y);
        } : undefined}
        style={[
          styles.item,
          isLive && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          isPast && { opacity: 0.45 },
        ]}
      >
        {/* Left: Time column */}
        <View style={styles.timeColumn}>
          <Text
            style={[
              styles.timeText,
              { color: isLive ? primary as string : isDark ? '#aaa' : '#555' },
            ]}
          >
            {item.start}
          </Text>
          {item.stop ? (
            <Text style={styles.stopText}>{item.stop}</Text>
          ) : null}
          {isLive && (
            <View style={[styles.liveBadge, { backgroundColor: primary as string }]}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isUpcoming && (
            <Text style={[styles.upcomingText, { color: primary as string }]}>UP NEXT</Text>
          )}
        </View>

        {/* Middle: Program info */}
        <View style={styles.infoColumn}>
          <Text
            style={[
              styles.titleText,
              {
                color: isLive
                  ? isDark ? '#fff' : '#111'
                  : isDark ? '#ccc' : '#444',
                fontWeight: isLive ? '700' : '500',
              },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          <View style={styles.metaRow}>
            {item.category ? (
              <Text style={styles.categoryText}>{item.category}</Text>
            ) : null}
            {duration ? (
              <Text style={styles.durationText}>{duration}</Text>
            ) : null}
          </View>

          {item.desc ? (
            <Text style={styles.descText} numberOfLines={2}>
              {item.desc}
            </Text>
          ) : null}

          {/* Progress bar for live program */}
          {isLive && progress > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: primary as string },
                ]}
              />
            </View>
          )}
        </View>

        {/* Right: Icon or status indicator */}
        <View style={styles.iconColumn}>
          {item.icon ? (
            <Image
              source={{ uri: item.icon }}
              style={styles.programIcon}
              resizeMode="cover"
            />
          ) : (
            <MaterialIcons
              name={
                isLive ? 'play-circle-filled' : isUpcoming ? 'schedule' : 'check-circle'
              }
              size={22}
              color={
                isLive
                  ? (primary as string)
                  : isUpcoming
                  ? isDark ? '#666' : '#aaa'
                  : isDark ? '#333' : '#ccc'
              }
            />
          )}
        </View>
      </View>
    );
  };

  if (filteredPrograms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="tv-off" size={40} color="#555" />
        <Text style={styles.emptyText}>No schedule available for today</Text>
        <Text style={styles.emptySubText}>
          Check back later or try a different source
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0d0d0d' : '#f4f4f4' },
      ]}
    >
      {filteredPrograms.map((item, index) => renderItem(item, index))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  timeColumn: {
    width: 52,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  stopText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  liveBadge: {
    marginTop: 5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  upcomingText: {
    fontSize: 7,
    fontWeight: '700',
    marginTop: 5,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  infoColumn: {
    flex: 1,
    paddingRight: 8,
  },
  titleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  categoryText: {
    fontSize: 10,
    color: '#888',
    textTransform: 'capitalize',
    backgroundColor: 'rgba(128,128,128,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 10,
    color: '#777',
  },
  descText: {
    fontSize: 11,
    color: '#777',
    marginTop: 4,
    lineHeight: 15,
  },
  progressTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  iconColumn: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
  },
  programIcon: {
    width: 28,
    height: 20,
    borderRadius: 4,
  },
  separator: {
    height: 1,
    marginHorizontal: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubText: {
    color: '#555',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default Timetable;
