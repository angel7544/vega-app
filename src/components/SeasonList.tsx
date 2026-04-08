import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  Clipboard,
  useWindowDimensions,
  Image,
  Linking,
} from 'react-native';
import {BlurView} from 'expo-blur';

import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import {Dropdown} from 'react-native-element-dropdown';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  withSpring,
} from 'react-native-reanimated';
import * as IntentLauncher from 'expo-intent-launcher';
import {EpisodeLink, Link, Stream} from '../lib/providers/types';
import {RootStackParamList} from '../types/navigation';
import DownloadBottomSheet from './DownloadBottomSheet';
import {cacheStorage, mainStorage, settingsStorage} from '../lib/storage';
import {ifExists} from '../lib/file/ifExists';
import {useEpisodes, useStreamData} from '../lib/hooks/useEpisodes';
import {downloadManager} from '../lib/downloader';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';
import SkeletonLoader from './Skeleton';
import useToastStore from '../lib/zustand/toastStore';
import {sanitizeName, extractMetadata} from '../lib/utils';
import {useTMDBSeasonDetails} from '../lib/hooks/useContentInfo';

interface SeasonListProps {
  LinkList: Link[];
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  meta?: any;
  screenshots?: string[];
  horizontal?: boolean;
  onNextUpFound?: (item: any) => void;
  type: string;
  metaTitle: string;
  tmdbData?: any;
  providerValue: string;
  refreshing?: boolean;
  activeSeasonProp?: any;
  onSeasonChangeProp?: (item: any) => void;
  routeParams: Readonly<{
    link: string;
    provider?: string;
    poster?: string;
  }>;
  onPlayOverride?: (data: {
    linkIndex: number;
    episodeList: EpisodeLink[];
    type: string;
    primaryTitle: string;
    secondaryTitle: string;
    poster: any;
    providerValue: string;
    infoUrl: string;
  }) => void;
}

interface PlayHandlerProps {
  linkIndex: number;
  type: string;
  primaryTitle: string;
  secondaryTitle?: string;
  seasonTitle: string;
  episodeData: EpisodeLink[] | Link['directLinks'];
}

export interface SeasonListHandle {
  playNextUp: () => void;
  setSearch: (text: string) => void;
  toggleSort: () => void;
  getSortOrder: () => 'asc' | 'desc';
}

const SeasonList = React.forwardRef<SeasonListHandle, SeasonListProps>(({
  LinkList,
  poster,
  meta,
  screenshots,
  horizontal = false,
  onNextUpFound,
  type,
  metaTitle,
  providerValue,
  refreshing: _refreshing,
  routeParams,
  activeSeasonProp,
  onSeasonChangeProp,
  onPlayOverride,
  tmdbData,
}, ref) => {
  const {width: windowWidth} = useWindowDimensions();
  const isTablet = windowWidth > 768;
  const thumbnailWidth = isTablet ? 120 : 80;
  const thumbnailHeight = isTablet ? 68 : 120;
  const {primary, mode} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {addItem} = useWatchHistoryStore(state => state);
  const {fetchStreams} = useStreamData();
  const {show} = useToastStore();

  // State
  const [activeSeason, setActiveSeason] = useState<Link>(() => {
    if (activeSeasonProp) return activeSeasonProp;
    if (!LinkList || LinkList.length === 0) return {} as Link;
    const cached = cacheStorage.getString(`ActiveSeason${metaTitle + providerValue}`);
    if (cached) {
      try {
        const parsedSeason = JSON.parse(cached);
        const seasonExists = LinkList.find(link => link.title === parsedSeason.title);
        if (seasonExists) return parsedSeason;
      } catch (error) {
        console.warn('Failed to parse cached season:', error);
      }
    }
    return LinkList[0];
  });

  useEffect(() => {
    if (activeSeasonProp) {
        setActiveSeason(activeSeasonProp);
    }
  }, [activeSeasonProp]);

  const {
    data: episodeList = [],
    isLoading: episodeLoading,
    error: episodeError,
    refetch: refetchEpisodes,
  } = useEpisodes(
    activeSeason?.episodesLink,
    providerValue,
    activeSeason?.episodesLink ? true : false,
  );

  const [vlcLoading, setVlcLoading] = useState<boolean>(false);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);
  const [showServerCard, setShowServerCard] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    mainStorage.getString('episodeSortOrder') === 'asc' ? 'asc' : 'desc',
  );
  const [externalPlayerStreams, setExternalPlayerStreams] = useState<any[]>([]);
  const [stickyMenuMetadata, setStickyMenuMetadata] = useState<{
    title: string;
    fileName: string;
    size?: string;
  } | null>(null);
  const [watchRefresh, setWatchRefresh] = useState(0);

  const [downloadModal, setDownloadModal] = useState(false);
  const [downloadData, setDownloadData] = useState<{
    title: string;
    link: string;
    type: string;
    fileName: string;
  } | null>(null);
  const [downloadServers, setDownloadServers] = useState<Stream[]>([]);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const showDownloadButtonOnCards = settingsStorage.getBool('showDownloadButtonOnCards', false);

  // Helper Callbacks
  const getWatchProgress = useCallback((link: string) => {
    const watchProgress = JSON.parse(cacheStorage.getString(link) || '{}');
    if (!watchProgress.position || !watchProgress.duration) return 0;
    return (watchProgress.position / watchProgress.duration) * 100;
  }, [watchRefresh]);

  const isCompleted = useCallback((link: string) => {
    return getWatchProgress(link) > 85;
  }, [getWatchProgress]);

  const toggleWatched = useCallback((link: string, watched: boolean) => {
    cacheStorage.setString(
      link,
      JSON.stringify({
        position: watched ? 10000 : 0,
        duration: 1,
      }),
    );
    setWatchRefresh(prev => prev + 1);
    show(watched ? 'Marked as watched' : 'Marked as unwatched', 'success');
  }, [show]);

  const handleSeasonChange = useCallback((item: Link) => {
    if (onSeasonChangeProp) {
        onSeasonChangeProp(item);
    } else {
        setActiveSeason(item);
        cacheStorage.setString(`ActiveSeason${metaTitle + providerValue}`, JSON.stringify(item));
    }
  }, [onSeasonChangeProp, metaTitle, providerValue]);

  const toggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    mainStorage.setString('episodeSortOrder', newOrder);
  }, [sortOrder]);

  // Premium VLC pulse & rotate animation
  const vlcScale = useSharedValue(1);
  const vlcOpacity = useSharedValue(0.6);
  
  useEffect(() => {
    if (vlcLoading || isLoadingStreams) {
      vlcScale.value = withRepeat(withTiming(1.2, {duration: 800}), -1, true);
      vlcOpacity.value = withRepeat(withTiming(1, {duration: 800}), -1, true);
    } else {
      cancelAnimation(vlcScale);
      cancelAnimation(vlcOpacity);
      vlcScale.value = 1;
      vlcOpacity.value = 0.6;
    }
  }, [vlcLoading, isLoadingStreams]);

  const vlcLoadingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: vlcScale.value}],
    opacity: vlcOpacity.value,
  }));

  // Card Animation logic
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);

  // Episode range offset logic (e.g. S01 E21-E40)
  const { episodeOffset, startRange } = useMemo(() => {
    if (!activeSeason?.title) return { episodeOffset: 0, startRange: 1 };
        // Look for patterns like (21-40), (E21-E40), [21-40], or "Part 2" using various dash types
    const rangeMatch = activeSeason.title.match(/(?:(?:Episode|EP|E|S)?\s*(\d+)\s*(?:-|–|—|_)\s*(?:Episode|EP|E|S)?\s*(\d+))/i) ||
                       activeSeason.title.match(/(?:\(\s*(\d+)\s*(?:-|–|—|_)\s*(\d+)\s*\))/i) ||
                       activeSeason.title.match(/(?:\[\s*(\d+)\s*(?:-|–|—|_)\s*(\d+)\s*\])/i);
    
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      return { 
        episodeOffset: start > 1 ? start - 1 : 0, 
        startRange: start 
      };
    }
    return { episodeOffset: 0, startRange: 1 };
  }, [activeSeason?.title]);

  useEffect(() => {
    if (showServerCard) {
      cardOpacity.value = withTiming(1, { duration: 400 });
      cardScale.value = withSpring(1, { damping: 15 });
    } else {
      cardOpacity.value = withTiming(0, { duration: 300 });
      cardScale.value = withTiming(0.9, { duration: 300 });
    }
  }, [showServerCard]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
    display: cardOpacity.value === 0 && !showServerCard ? 'none' : 'flex' as any,
  }));

  // Centralized robust episode number parsing
  const getAbsoluteEpisodeNumber = useCallback((episodeTitle: string, index?: number) => {
    // 1. Pre-clean title of file sizes to avoid confusion (e.g., "EP 01 1.5GB" -> "EP 01")
    const cleanTitle = episodeTitle.replace(/\d+(?:\.\d+)?\s*(?:GB|MB)/gi, '').trim();
    
    // 2. Matches patterns like Episode 01, EP-01, E_01, EP 01, Episode-01, EPISODE 01
    const epMatch = cleanTitle.match(/(?:Episode|EPISODE|EP|E)[\s-_]*(\d+)/i);
    let epNum = epMatch ? parseInt(epMatch[1]) : null;

    // 3. Robust fallback: If no keyword found, look for any standalone number in the title
    if (epNum === null) {
      const loneNumMatch = cleanTitle.match(/(?:\D|^)(\d+)(?:\D|$)/);
      if (loneNumMatch) epNum = parseInt(loneNumMatch[1]);
    }

    // 4. Final fallback to index if still null
    if (epNum === null && index !== undefined) {
      epNum = index + 1;
    }

    // Apply offset only if the number found (or fallback index) is relative to the current part
    // e.g., if title is "Episode 1" but startRange is 21, actual epNum is 21.
    // If title is "Episode 21", it's already absolute, so we don't apply offset.
    if (epNum !== null && epNum < startRange && episodeOffset > 0) {
      epNum += episodeOffset;
    }
    return epNum;
  }, [episodeOffset, startRange]);

  // Enhanced Episode Mapping
  const getEpisodeMetadata = useCallback((episodeTitle: string, seasonNum?: number) => {
    if (!meta?.videos || !Array.isArray(meta.videos)) return null;
    
    // Try matching by season and episode number if we can extract them from the title
    const epNum = getAbsoluteEpisodeNumber(episodeTitle);
    
    // If we have a season number from the active season title
    const currentSeasonMatch = (activeSeason?.title || "").match(/(?:Season|S)[\s-_]*(\d+)/i);
    const currentSeasonNum = currentSeasonMatch ? parseInt(currentSeasonMatch[1]) : (seasonNum || 1);

    if (epNum !== null) {
      const match = meta.videos.find((v: any) => v.season === currentSeasonNum && v.episode === epNum);
      if (match) return match;
    }

    // Fallback: match by title similarity
    return meta.videos.find((v: any) => 
      v.name?.toLowerCase().includes(episodeTitle.toLowerCase()) || 
      episodeTitle.toLowerCase().includes(v.name?.toLowerCase())
    );
  }, [meta?.videos, activeSeason?.title]);

  // Fetch TMDB Season Metadata
  const currentSeasonMatch = (activeSeason?.title || "").match(/(?:Season|S)[\s-_]*(\d+)/i);
  const currentSeasonNum = currentSeasonMatch ? parseInt(currentSeasonMatch[1]) : 1;
  
  const { data: tmdbSeason } = useTMDBSeasonDetails(
    tmdbData?.id || meta?.tmdbId, 
    currentSeasonNum
  );

  const getTMDBEpisodeOverview = useCallback((episodeTitle: string, index?: number) => {
    if (!tmdbSeason?.episodes) return null;
    const epNum = getAbsoluteEpisodeNumber(episodeTitle, index);

    if (epNum !== null) {
      const match = tmdbSeason.episodes.find((e: any) => Number(e.episode_number) == Number(epNum));
      return match?.overview;
    }
    return null;
  }, [tmdbSeason, getAbsoluteEpisodeNumber]);


  // Memoized lists (Smart Sorting: [Next Up, Unwatched, Watched])
  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) return [];

    let episodesWithMeta = episodeList
      .filter(ep => ep && ep.title && ep.link)
      .map((ep, idx) => ({
        ...ep,
        originalIndex: idx,
        isCompleted: isCompleted(ep.link),
      }));

    // Identify first incomplete as "Next Up"
    const nextToWatchLink = episodesWithMeta.find(ep => !ep.isCompleted)?.link;

    if (searchText.trim()) {
      episodesWithMeta = episodesWithMeta.filter(ep =>
        ep?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    const nextToWatch = nextToWatchLink ? episodesWithMeta.filter(ep => ep.link === nextToWatchLink) : [];
    const watched = episodesWithMeta.filter(ep => ep.isCompleted && ep.link !== nextToWatchLink);
    const unwatched = episodesWithMeta.filter(ep => !ep.isCompleted && ep.link !== nextToWatchLink);

    let activeList = [...nextToWatch, ...unwatched];
    if (sortOrder === 'desc') activeList.reverse();
    
    return [...activeList, ...watched];
  }, [episodeList, searchText, sortOrder, isCompleted, watchRefresh]);

  const filteredAndSortedDirectLinks = useMemo(() => {
    if (!activeSeason?.directLinks || !Array.isArray(activeSeason.directLinks)) return [];

    let linksWithMeta = activeSeason.directLinks
      .filter(l => l && l.title && l.link)
      .map((l, idx) => ({
        ...l,
        originalIndex: idx,
        isCompleted: isCompleted(l.link),
      }));

    const nextToWatchLink = linksWithMeta.find(l => !l.isCompleted)?.link;

    if (searchText.trim()) {
      linksWithMeta = linksWithMeta.filter(l =>
        l?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    const nextToWatch = nextToWatchLink ? linksWithMeta.filter(l => l.link === nextToWatchLink) : [];
    const watched = linksWithMeta.filter(l => l.isCompleted && l.link !== nextToWatchLink);
    const unwatched = linksWithMeta.filter(l => !l.isCompleted && l.link !== nextToWatchLink);

    let activeList = [...nextToWatch, ...unwatched];
    if (sortOrder === 'desc') activeList.reverse();

    return [...activeList, ...watched];
  }, [activeSeason?.directLinks, searchText, sortOrder, isCompleted, watchRefresh]);

  const combinedData = useMemo(() => {
    return [...filteredAndSortedEpisodes, ...filteredAndSortedDirectLinks];
  }, [filteredAndSortedEpisodes, filteredAndSortedDirectLinks]);

  const nextUpIndex = useMemo(() => {
    if (!combinedData.length) return 0;
    const idx = combinedData.findIndex(item => !isCompleted(item.link));
    return idx === -1 ? 0 : idx;
  }, [combinedData, isCompleted]);

  useEffect(() => {
    const list = filteredAndSortedEpisodes.length > 0 ? filteredAndSortedEpisodes : filteredAndSortedDirectLinks;
    if (onNextUpFound && list[nextUpIndex]) {
      const epMeta = getEpisodeMetadata(list[nextUpIndex].title);
      onNextUpFound({
        ...list[nextUpIndex],
        size: epMeta?.size,
        progress: getWatchProgress(list[nextUpIndex].link)
      });
    }
  }, [nextUpIndex, filteredAndSortedEpisodes, filteredAndSortedDirectLinks, onNextUpFound, getEpisodeMetadata]);

  // Imperative handle for remote playback and search
  React.useImperativeHandle(ref, () => ({
    playNextUp: () => {
      if (combinedData.length > 0) {
        const item = combinedData[nextUpIndex];
        playHandler({
          linkIndex: nextUpIndex,
          type,
          primaryTitle: metaTitle,
          secondaryTitle: item.title,
          seasonTitle: activeSeason?.title || '',
          episodeData: combinedData as any,
        });
      }
    },
    setSearch: (text: string) => {
      setSearchText(text);
    },
    toggleSort: () => {
        toggleSortOrder();
    },
    getSortOrder: () => sortOrder,
  }));

  // Handlers
  const onDownloadServer = useCallback((stream: Stream) => {
    if (!stickyMenuMetadata) return;
    
    show(`Opening external downloader: ${stickyMenuMetadata.title}`, 'success');
    
    // Always use external downloader for the server selection card items
    Linking.openURL(stream.link);
  }, [stickyMenuMetadata, show]);

  const handleShowServers = useCallback(async (link: string, streamType: string, metadata: {title: string; fileName: string; size?: string}) => {
    setShowServerCard(true);
    setIsLoadingStreams(true);
    setStickyMenuMetadata(metadata);
    try {
      const streams = await fetchStreams(link, streamType, providerValue);
      if (!streams || streams.length === 0) {
        show('No streams available from provider', 'error');
        setShowServerCard(false);
        return;
      }
      setExternalPlayerStreams([...streams]);
    } catch (error: any) {
      show(error?.message || 'Failed to load streams', 'error');
      setShowServerCard(false);
    } finally {
      setIsLoadingStreams(false);
    }
  }, [fetchStreams, providerValue, show]);

  const handleDownload = useCallback((link: string, title: string, streamType: string, fileName: string) => {
    // According to user request, Download button now also triggers the servers modal
    const epMeta = getEpisodeMetadata(title);
    handleShowServers(link, streamType, { title, fileName, size: epMeta?.size });
  }, [handleShowServers, getEpisodeMetadata]);

  const openExternalPlayer = useCallback(async (streamUrl: string) => {
    setShowServerCard(false);
    setVlcLoading(true);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: streamUrl, type: 'video/*' });
    } catch (error) {
      show('Failed to open external player', 'error');
    } finally {
      setVlcLoading(false);
    }
  }, [show]);

  const playHandler = useCallback(async ({ linkIndex, type, primaryTitle, secondaryTitle, seasonTitle, episodeData }: PlayHandlerProps) => {
    addItem({
      id: routeParams.link,
      link: routeParams.link,
      title: primaryTitle,
      image: poster?.poster,
      poster: poster?.poster,
      provider: providerValue,
      lastPlayed: Date.now(),
      episodeTitle: secondaryTitle,
      playbackRate: 1,
      currentTime: 0,
      duration: 1,
    });

    if (!episodeData || episodeData.length === 0) return;
    const item = episodeData[linkIndex];
    const file = (metaTitle + seasonTitle + item.title).replaceAll(/[^a-zA-Z0-9]/g, '_');
    const externalPlayer = settingsStorage.getBool('useExternalPlayer');
    const dwFile = await ifExists(file);

    if (externalPlayer) {
      if (dwFile) {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: dwFile, type: 'video/*' });
        return;
      }
      const epMeta = getEpisodeMetadata(item.title);
      handleShowServers(item.link, type, {
        title: metaTitle.length > 30 ? metaTitle.slice(0, 30) + '... ' + item.title : metaTitle + ' ' + item.title,
        fileName: file,
        size: epMeta?.size
      });
      return;
    }

    if (onPlayOverride) {
      onPlayOverride({
        linkIndex,
        episodeList: episodeData as EpisodeLink[],
        type,
        primaryTitle,
        secondaryTitle: seasonTitle,
        poster,
        providerValue,
        infoUrl: routeParams.link,
      });
      return;
    }

    navigation.navigate('Player', {
      linkIndex,
      episodeList: episodeData as EpisodeLink[],
      type,
      primaryTitle,
      secondaryTitle: seasonTitle,
      poster,
      providerValue,
      infoUrl: routeParams.link,
    });
  }, [addItem, routeParams.link, poster, providerValue, metaTitle, handleShowServers, navigation]);

  const renderHorizontalEpisodeItem = useCallback(({item, index}: {item: any, index: number}) => {
    const progress = getWatchProgress(item.link);
    const completed = progress > 85;
    const isNext = index === nextUpIndex && !completed;
    const metaEp = getEpisodeMetadata(item.title);
    const tmdbOverview = getTMDBEpisodeOverview(item.title, item.originalIndex);
    const epNum = getAbsoluteEpisodeNumber(item.title, item.originalIndex);
    const tmdbEp = tmdbSeason?.episodes?.find((e: any) => Number(e.episode_number) == Number(epNum));
    const thumbnail = item.image || metaEp?.thumbnail || (tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : null);
    
    const fileName = (metaTitle + (activeSeason?.title || '') + item.title).replaceAll(/[^a-zA-Z0-9]/g, '_');

    return (
      <View key={item.link + index} className={`${isTablet ? 'w-[200px] flex-col' : 'w-[300px] flex-row'} mr-6 rounded-[24px] overflow-hidden ${mode === 'dark' ? 'bg-white/12 border-white/20' : 'bg-white border-black/5 shadow-lg'} border shadow-2xl shadow-black/50`}>
        {/* Left: 16:9 Thumbnail Cluster - Flush */}
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => playHandler({ linkIndex: index, type, primaryTitle: metaTitle, secondaryTitle: item.title, seasonTitle: activeSeason?.title || '', episodeData: combinedData })}
            className={`${isTablet ? 'w-full aspect-[2/3]' : 'w-[130px] aspect-video'} relative bg-black`}
        >
            {thumbnail || poster?.poster ? (
                <Image source={{uri: thumbnail || poster?.poster}} className="w-full h-full" resizeMode="cover" />
            ) : (
                <View className="w-full h-full items-center justify-center opacity-40">
                    <MaterialCommunityIcons name={isTablet ? "movie-outline" : "play-circle"} size={isTablet ? 48 : 32} color="white" />
                </View>
            )}
            
            <View className="absolute inset-0 items-center justify-center bg-black/5">
                <Ionicons name="play" size={24} color="white" />
            </View>

            {progress > 0 && (
              <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                <View className="h-full bg-red-600" style={{ width: `${progress}%` }} />
              </View>
            )}
        </TouchableOpacity>

        {/* Content Cluster */}
        <View className={`flex-1 ${isTablet ? 'px-5 py-4' : 'px-3 py-2'} justify-between`}>
          <View>
            <View className="flex-row items-center justify-between">
              <Text className={`${mode === 'dark' ? 'text-white/80' : 'text-black/80'} ${isTablet ? 'text-[12px]' : 'text-[11px]'} font-black uppercase tracking-widest`}>
                Episode {String(getAbsoluteEpisodeNumber(item.title, item.originalIndex)).padStart(2, '0')}
              </Text>
// Rating removed
            </View>
            
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} ${isTablet ? 'text-lg' : 'text-[13px]'} font-black mt-1`} numberOfLines={1}>
              {tmdbEp?.name || sanitizeName(item.title)}
            </Text>

            <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} text-[8px] mt-1 font-medium leading-[14px]`} numberOfLines={3}>
              {tmdbOverview || metaEp?.synopsis || 'No description available for this episode.'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mt-1">
            <View className="flex-row items-center gap-x-4">
              <TouchableOpacity onPress={() => playHandler({ linkIndex: index, type, primaryTitle: metaTitle, secondaryTitle: item.title, seasonTitle: activeSeason?.title || '', episodeData: combinedData })}>
                <Text className="text-[#FF4D3D] text-[9px] font-black uppercase tracking-[1px]">Play</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => toggleWatched(item.link, !completed)}>
                <Ionicons 
                  name={completed ? "checkmark-circle" : "checkmark-circle-outline"} 
                  size={20} 
                  color={completed ? "#FF4D3D" : (mode === 'dark' ? "white" : "black")} 
                  style={{ opacity: completed ? 1 : 0.4 }}
                />
              </TouchableOpacity>

              {showDownloadButtonOnCards && (
                <TouchableOpacity onPress={() => handleDownload(item.link, metaTitle + ' ' + item.title, 'series', fileName)}>
                  <Text className="text-[#FF4D3D] text-[9px] font-black uppercase tracking-[1px]">Save</Text>
                </TouchableOpacity>
              )}
            </View>

            {metaEp?.size && (
              <Text className={`${mode === 'dark' ? 'text-white/30' : 'text-black/30'} text-[8px] font-bold uppercase`}>
                 {metaEp.size}
              </Text>
            )}
          </View>
        </View>

        {isNext && (
          <View className="absolute top-2 right-2 bg-red-600/10 px-1.5 py-0.5 rounded-full border border-red-600/20">
            <Text className="text-[6px] text-red-600 font-black uppercase">Next</Text>
          </View>
        )}
      </View>
    );
  }, [mode, primary, playHandler, type, metaTitle, activeSeason?.title, combinedData, getEpisodeMetadata, getWatchProgress, nextUpIndex, toggleWatched, handleDownload, tmdbSeason, getTMDBEpisodeOverview, showDownloadButtonOnCards, isTablet, getAbsoluteEpisodeNumber]);

  // Renderers
  const renderEpisodeItem = useCallback(({item, index}: {item: any, index: number}) => {
    const progress = getWatchProgress(item.link);
    const completed = progress > 85;
    const isNext = index === nextUpIndex && !completed;
    const metaEp = getEpisodeMetadata(item.title);
    const tmdbOverview = getTMDBEpisodeOverview(item.title, item.originalIndex);
    const epNum = getAbsoluteEpisodeNumber(item.title, item.originalIndex);
    const tmdbEp = tmdbSeason?.episodes?.find((e: any) => Number(e.episode_number) == Number(epNum));
    const thumbnail = item.image || metaEp?.thumbnail || (tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : null);
    
    const fileName = (metaTitle + (activeSeason?.title || '') + item.title).replaceAll(/[^a-zA-Z0-9]/g, '_');

    return (
      <View key={item.link + index} className={`${isTablet ? 'flex-1' : 'w-full'} mb-8 rounded-[36px] overflow-hidden ${mode === 'dark' ? 'bg-white/10 border-white/20' : 'bg-white border-black/5 shadow-xl'} border flex-col shadow-2xl p-5 shadow-black/40`}>
        {/* Header: Title and Next Badge */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-[18px] font-black flex-1 mr-4`} numberOfLines={1}>
            {tmdbEp?.name || sanitizeName(item.title)}
          </Text>
          {isNext && (
            <View className="bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">
              <Text className="text-[9px] text-red-600 font-black uppercase tracking-wider">Next</Text>
            </View>
          )}
        </View>

        {/* Content Body: Thumbnail and Text Row */}
        <View className="flex-row mb-6">
          <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => playHandler({ linkIndex: index, type, primaryTitle: metaTitle, secondaryTitle: item.title, seasonTitle: activeSeason?.title || '', episodeData: combinedData })}
              className="w-[120px] aspect-video relative bg-black rounded-[20px] overflow-hidden"
          >
              {thumbnail ? (
                  <Image source={{uri: thumbnail}} style={{width: '100%', height: '100%'}} resizeMode="cover" />
              ) : (
                  <View className="w-full h-full items-center justify-center opacity-40">
                      <MaterialCommunityIcons name="play-circle" size={32} color="white" />
                  </View>
              )}
              
              <View className="absolute inset-0 items-center justify-center bg-black/10">
                  <Ionicons name="play" size={20} color="white" />
              </View>

              {progress > 0 && (
                <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                  <View className="h-full bg-red-600" style={{ width: `${progress}%` }} />
                </View>
              )}
          </TouchableOpacity>

          <View className="flex-1 ml-4 justify-center">
            <Text className={`${mode === 'dark' ? 'text-white/70' : 'text-black/70'} text-[10px] font-medium leading-[18px]`} numberOfLines={4}>
              {tmdbOverview || metaEp?.synopsis || 'No description available for this episode.'}
            </Text>
          </View>
        </View>

        {/* Footer: Actions Cluster */}
        <View className="flex-row items-center justify-center gap-x-12 border-t border-black/5 pt-4">
          <TouchableOpacity onPress={() => playHandler({ linkIndex: index, type, primaryTitle: metaTitle, secondaryTitle: item.title, seasonTitle: activeSeason?.title || '', episodeData: combinedData })}>
            <Text className="text-[#FF4D3D] text-[11px] font-black uppercase tracking-[2px]">Play</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => toggleWatched(item.link, !completed)}>
            <Ionicons 
              name={completed ? "checkmark-circle" : "checkmark-circle-outline"} 
              size={24} 
              color={completed ? "#FF4D3D" : (mode === 'dark' ? "white" : "black")} 
              style={{ opacity: completed ? 1 : 0.4 }}
            />
          </TouchableOpacity>

          {showDownloadButtonOnCards && (
            <TouchableOpacity onPress={() => handleDownload(item.link, metaTitle + ' ' + item.title, 'series', fileName)}>
              <Text className="text-[#FF4D3D] text-[11px] font-black uppercase tracking-[2px]">Save</Text>
            </TouchableOpacity>
          )}

          {metaEp?.size && (
            <Text className={`${mode === 'dark' ? 'text-white/30' : 'text-black/30'} text-[9px] font-bold uppercase`}>
                {metaEp.size}
            </Text>
          )}
        </View>
      </View>
    );
  }, [mode, primary, playHandler, type, metaTitle, activeSeason?.title, combinedData, getEpisodeMetadata, getWatchProgress, nextUpIndex, toggleWatched, handleDownload, tmdbSeason, getTMDBEpisodeOverview, showDownloadButtonOnCards, isTablet, getAbsoluteEpisodeNumber]);

  const renderDirectLinkItem = useCallback(({item, index}: {item: any, index: number}) => {
    const progress = getWatchProgress(item.link);
    const completed = progress > 85;
    const isNext = index === nextUpIndex && !completed;
    const fileName = (metaTitle + item.title).replaceAll(/[^a-zA-Z0-9]/g, '_');

    return (
      <View key={item.link + index} className={`${isTablet ? 'flex-1' : 'w-full'} mb-6 rounded-[28px] overflow-hidden ${mode === 'dark' ? 'bg-white/10 border-white/20' : 'bg-white border-black/5 shadow-lg'} border flex-row shadow-2xl shadow-black/40`}>
        {/* Left: 16:9 Thumbnail Cluster - Flush */}
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => playHandler({ linkIndex: index, type: item?.type || type, primaryTitle: metaTitle, secondaryTitle: item.title, seasonTitle: activeSeason?.title || '', episodeData: combinedData })}
            className={`${isTablet ? 'w-[180px]' : 'w-[140px]'} aspect-video relative bg-black`}
        >
            {poster?.poster ? (
                <Image source={{uri: poster.poster}} style={{width: '100%', height: '100%'}} resizeMode="cover" />
            ) : (
                <View className="w-full h-full items-center justify-center opacity-40">
                    <MaterialCommunityIcons name="movie-play-outline" size={36} color="white" />
                </View>
            )}
            
            <View className="absolute inset-0 items-center justify-center bg-black/5">
                <Ionicons name="play" size={24} color="white" />
            </View>

            {progress > 0 && (
              <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                <View className="h-full bg-red-600" style={{ width: `${progress}%` }} />
              </View>
            )}
        </TouchableOpacity>

        {/* Right Content Cluster */}
        <View className="flex-1 px-4 py-3 justify-between">
          <View>
            <View className="flex-row items-center justify-between">
              {!sanitizeName(item.title).toLowerCase().includes('episode') && (
                <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} text-[11px] font-black uppercase tracking-tight mr-2`}>
                  Ep {String(getAbsoluteEpisodeNumber(item.title, item.originalIndex)).padStart(2, '0')}
                </Text>
              )}
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-[14px] font-black uppercase tracking-tight flex-1`} numberOfLines={1}>
                {sanitizeName(item.title)}
              </Text>
            </View>

            {/* Metadata Badges for direct links */}
            <View className="flex-row flex-wrap mt-2">
              {(() => {
                const epMeta = extractMetadata(item.title);
                return [...epMeta.quality, ...epMeta.technical].slice(0, 3).map((ext, i) => (
                  <View key={i} className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} px-1.5 py-0.5 rounded mr-1.5 mb-1.5`}>
                    <Text className={`${mode === 'dark' ? 'text-white/50' : 'text-black/50'} text-[8px] font-black uppercase`}>{ext}</Text>
                  </View>
                ));
              })()}
            </View>
          </View>

          <View className="flex-row items-center mt-2 gap-x-6">
            <TouchableOpacity onPress={() => playHandler({ linkIndex: index, type: item?.type || type, primaryTitle: metaTitle, secondaryTitle: item.title, seasonTitle: activeSeason?.title || '', episodeData: combinedData })}>
              <Text className="text-[#FF4D3D] text-[10px] font-black uppercase tracking-[1.5px]">Play</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => toggleWatched(item.link, !completed)}>
              <Ionicons 
                name={completed ? "checkmark-circle" : "checkmark-circle-outline"} 
                size={24} 
                color={completed ? "#FF4D3D" : (mode === 'dark' ? "white" : "black")} 
                style={{ opacity: completed ? 1 : 0.4 }}
              />
            </TouchableOpacity>

            {showDownloadButtonOnCards && (
              <TouchableOpacity onPress={() => handleDownload(item.link, metaTitle + ' ' + item.title, item?.type || type, fileName)}>
                <Text className="text-[#FF4D3D] text-[10px] font-black uppercase tracking-[1.5px]">Save</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isNext && (
          <View className="absolute top-3 right-3 bg-red-600/10 px-2 py-0.5 rounded-full border border-red-600/20">
            <Text className="text-[7px] text-red-600 font-black uppercase">Next</Text>
          </View>
        )}
      </View>
    );
  }, [mode, primary, playHandler, type, metaTitle, activeSeason?.title, combinedData, getWatchProgress, nextUpIndex, toggleWatched, handleDownload, poster?.poster, showDownloadButtonOnCards, isTablet, getAbsoluteEpisodeNumber]);

  const renderServerItem = useCallback((item: Stream, index: number) => {
    const serverName = sanitizeName(item.server || `Server ${index + 1}`, true);
    const formatType = sanitizeName(item.type || '', true);
    
    return (
      <View key={`server-${index}-${item.server}`} className={`${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'} p-4 rounded-2xl mb-3 flex-row justify-between items-center border border-white/5`}>
        <TouchableOpacity onPress={() => openExternalPlayer(item.link)} className="flex-1">
          <View>
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-base capitalize font-black tracking-tight`}>{serverName}</Text>
            {formatType && (
              <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-[10px] font-bold uppercase mt-0.5`}>{formatType}</Text>
            )}
          </View>
        </TouchableOpacity>
        <View className="flex-row gap-x-3 items-center">
          <TouchableOpacity 
            onPress={() => { Clipboard.setString(item.link); show('Link copied to clipboard', 'success'); }}
            className={`w-8 h-8 rounded-full items-center justify-center ${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}
          >
            <MaterialIcons name="content-copy" size={18} color={primary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => openExternalPlayer(item.link)}
            className={`w-8 h-8 rounded-full items-center justify-center ${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}
          >
            <MaterialIcons name="play-arrow" size={22} color={primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onDownloadServer(item)} className={`${mode === 'dark' ? 'bg-primary/20' : 'bg-primary/10'} w-8 h-8 rounded-full items-center justify-center`}>
            <MaterialIcons name="file-download" size={20} color={primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [primary, mode, openExternalPlayer, show, onDownloadServer, sanitizeName]);

  // Loading Skeleton
  if (episodeLoading) {
    return (
      <View>
        {LinkList.length > 1 && (
          <Dropdown
            selectedTextStyle={{ color: primary, overflow: 'hidden', height: 20, fontWeight: 'bold' }}
            labelField={'title'}
            valueField={LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'}
            onChange={handleSeasonChange}
            value={activeSeason}
            data={LinkList}
            style={{ 
              overflow: 'hidden', 
              borderWidth: 1, 
              borderColor: mode === 'dark' ? '#2f302f' : '#e5e7eb', 
              paddingHorizontal: 12, 
              borderRadius: 8, 
              backgroundColor: mode === 'dark' ? 'black' : 'white',
              height: 44
            }}
            containerStyle={{ 
              backgroundColor: mode === 'dark' ? '#121212' : 'white', 
              borderRadius: 8, 
              borderWidth: 1, 
              borderColor: mode === 'dark' ? '#2f302f' : '#e5e7eb',
              overflow: 'hidden',
            }}
            activeColor={mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
            renderItem={item => {
              const itemMetadata = extractMetadata(item?.title || '');
              return (
                <View className={`px-3 py-2 flex-row justify-between items-center border-b border-white/5 ${activeSeason === item ? (mode === 'dark' ? 'bg-secondary' : 'bg-gray-100') : ''}`}>
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} flex-1`} numberOfLines={1}>
                    {sanitizeName(item?.title || 'Unknown')}
                  </Text>
                   <View className="flex-row items-center ml-2">
                    {[...itemMetadata.quality, ...itemMetadata.technical].slice(0, 4).map((ext, idx) => {
                      let textColor = 'text-primary';
                      if (ext === 'DOLBY VISION') textColor = 'text-yellow-500';
                      if (ext === 'HDR') textColor = 'text-orange-500';
                      return (
                        <View key={idx} className="bg-primary/20 px-1.5 py-0.5 rounded ml-1 border border-primary/30">
                            <Text className={`${textColor} text-[8px] font-black uppercase`}>{ext}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        )}
        <View className={`w-full p-4 ${horizontal ? 'flex-row' : 'flex-col'}`} style={{ gap: horizontal ? 24 : 10 }}>
          {[...Array(horizontal ? 4 : 6)].map((_, i) => (
            <View key={i} className="rounded-[38px] overflow-hidden">
              <SkeletonLoader 
                show={true} 
                height={horizontal ? 180 : 100} 
                width={horizontal ? 320 : '100%'} 
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Error State
  if (episodeError) {
    return (
      <View className="p-4 items-center">
        <Text className="text-red-500 text-center mb-4">{episodeError.message || 'Failed to load episodes'}</Text>
        <TouchableOpacity className="bg-primary px-6 py-2 rounded-lg" onPress={() => refetchEpisodes()}>
          <Text className="text-white font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View>
        <View>
          {/* Header Controls are now managed by Info.tsx */}

          {/* List Content */}
          <View>
            {horizontal ? (
              <FlatList
                horizontal
                data={combinedData}
                keyExtractor={(item, index) => `ep-h-${item.link}-${index}`}
                renderItem={props => {
                  const isEpisode = filteredAndSortedEpisodes.some(
                    e => e.link === props.item.link,
                  );
                  return isEpisode
                    ? renderHorizontalEpisodeItem(props)
                    : renderDirectLinkItem(props);
                }}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 30,
                  paddingBottom: 40,
                }}
                snapToAlignment="start"
                snapToInterval={(isTablet ? 450 : 340) + 24}
                decelerationRate="fast"
                initialScrollIndex={nextUpIndex}
                getItemLayout={(_data, index) => ({
                  length: (isTablet ? 450 : 340) + 24,
                  offset: ((isTablet ? 450 : 340) + 24) * index,
                  index,
                })}
              />
            ) : (
              <>
                {filteredAndSortedEpisodes.length > 0 && (
                  <FlatList
                    key={isTablet ? 'ep-columns-2' : 'ep-columns-1'}
                    numColumns={isTablet ? 2 : 1}
                    data={filteredAndSortedEpisodes}
                    keyExtractor={(item, index) => `ep-${item.link}-${index}`}
                    renderItem={renderEpisodeItem}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    columnWrapperStyle={isTablet ? { gap: 16, paddingHorizontal: 16 } : undefined}
                  />
                )}
                {filteredAndSortedDirectLinks.length > 0 && (
                  <FlatList
                    key={isTablet ? 'dl-columns-2' : 'dl-columns-1'}
                    numColumns={isTablet ? 2 : 1}
                    data={filteredAndSortedDirectLinks}
                    keyExtractor={(item, index) => `dl-${item.link}-${index}`}
                    renderItem={renderDirectLinkItem}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={isTablet ? { gap: 16, paddingHorizontal: 16 } : undefined}
                  />
                )}
              </>
            )}
            {filteredAndSortedEpisodes.length === 0 &&
              filteredAndSortedDirectLinks.length === 0 && (
                <View className="py-20 items-center">
                  <Ionicons
                    name="film-outline"
                    size={60}
                    color={mode === 'dark' ? '#ffffff20' : '#00000020'}
                  />
                  <Text
                    className={`${
                      mode === 'dark' ? 'text-white/40' : 'text-black/40'
                    } text-lg mt-4 font-medium`}>
                    No content available
                  </Text>
                </View>
              )}
          </View>
        </View>
      </View>

      {/* Premium Server Selection Card UI */}
      <Modal
        visible={showServerCard}
        animationType="fade"
        transparent
        onRequestClose={() => setShowServerCard(false)}
      >
        <Animated.View 
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setShowServerCard(false)} 
          />
          
          <Animated.View 
            style={[
              cardAnimatedStyle,
              { width: isTablet ? 500 : '100%', maxWidth: 600 }
            ]}
            className={`rounded-[40px] overflow-hidden border border-white/5 shadow-2xl ${mode === 'dark' ? 'bg-secondary' : 'bg-white'}`}
          >
            <BlurView intensity={20} tint={mode === 'dark' ? 'dark' : 'light'} className="p-8">
              <View className="flex-row justify-between items-start mb-6">
                <View className="flex-1 mr-4">
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-2xl font-black uppercase tracking-tight`}>
                    {isLoadingStreams ? 'Searching Links' : 'Download Links'}
                  </Text>
                  {stickyMenuMetadata && (
                    <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-[10px] font-black uppercase tracking-widest mt-1`} numberOfLines={1}>
                      {sanitizeName(stickyMenuMetadata.title)} {stickyMenuMetadata.size ? `• ${stickyMenuMetadata.size}` : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => setShowServerCard(false)}
                  className={`w-10 h-10 rounded-full items-center justify-center ${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}
                >
                  <Ionicons name="close" size={20} color={mode === 'dark' ? 'white' : 'black'} />
                </TouchableOpacity>
              </View>

              <View className="min-h-[200px] justify-center">
                {isLoadingStreams ? (
                  <View className="items-center py-10">
                    <Animated.View style={vlcLoadingAnimatedStyle}>
                      <MaterialCommunityIcons name="vlc" size={100} color={primary} />
                    </Animated.View>
                    <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} text-[10px] font-black uppercase tracking-[2px] mt-8`}>
                      Locating Servers...
                    </Text>
                  </View>
                ) : (
                  <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 10 }}
                    style={{ maxHeight: 400 }}
                  >
                    {externalPlayerStreams.length > 0 ? (
                      externalPlayerStreams.map((s, i) => renderServerItem(s, i))
                    ) : (
                      <View className="items-center py-10">
                        <Ionicons name="alert-circle-outline" size={40} color={mode === 'dark' ? 'white' : 'black'} style={{ opacity: 0.3 }} />
                        <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-xs mt-4`}>No servers found</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            </BlurView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Preparing Stream Overlay - Redesigned to match the new style */}
      {vlcLoading && (
        <View className="absolute inset-0 bg-black/90 items-center justify-center z-[200]">
          <Animated.View style={vlcLoadingAnimatedStyle}>
            <MaterialCommunityIcons name="vlc" size={120} color={primary} />
          </Animated.View>
          <View className="mt-12 items-center">
            <Text className="text-white text-xl font-black uppercase tracking-[2px]">
              Preparing Stream
            </Text>
            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[3px] mt-2">
              Initializing external player
            </Text>
          </View>
        </View>
      )}

      {/* Download Sheet */}
      <DownloadBottomSheet
        data={downloadServers}
        loading={downloadLoading}
        showModal={downloadModal}
        setModal={setDownloadModal}
        title={downloadData?.title || 'Download Options'}
        error={downloadError}
        onPressVideo={(server: Stream) => {
          if (!downloadData) {
            return;
          }
          if (settingsStorage.getBool('alwaysExternalDownloader')) {
            Linking.openURL(server.link);
            return;
          }
          downloadManager({
            title: downloadData.title,
            url: server.link,
            fileName: downloadData.fileName,
            fileType: server.type,
            setDownloadActive: _v => {},
            headers: server.headers,
            setAlreadyDownloaded: () => {},
            setDownloadId: () => {},
            deleteDownload: () => {},
            provider: providerValue,
          });
        }}
        onPressSubs={(item: any) => {
          if (!downloadData) {
            return;
          }
          downloadManager({
            title: item.title,
            url: item.link,
            fileName: item.title.replaceAll(/[^a-zA-Z0-9]/g, '_'),
            fileType: item.type,
            setDownloadActive: _v => {},
            setAlreadyDownloaded: () => {},
            setDownloadId: () => {},
            deleteDownload: () => {},
            provider: providerValue,
          });
        }}
      />
    </View>
  );
});

export default SeasonList;
