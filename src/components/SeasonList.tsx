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
} from 'react-native';

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
} from 'react-native-reanimated';
import * as IntentLauncher from 'expo-intent-launcher';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {EpisodeLink, Link} from '../lib/providers/types';
import {RootStackParamList} from '../App';
import Downloader from './Downloader';
import DownloadBottomSheet from './DownloadBottomSheet';
import {cacheStorage, mainStorage, settingsStorage} from '../lib/storage';
import {ifExists} from '../lib/file/ifExists';
import {useEpisodes, useStreamData} from '../lib/hooks/useEpisodes';
import {downloadManager} from '../lib/downloader';
import {Stream} from '../lib/providers/types';
import {Linking} from 'react-native';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';
import SkeletonLoader from './Skeleton';
import useToastStore from '../lib/zustand/toastStore';

interface SeasonListProps {
  LinkList: Link[];
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  type: string;
  metaTitle: string;
  providerValue: string;
  refreshing?: boolean;
  routeParams: Readonly<{
    link: string;
    provider?: string;
    poster?: string;
  }>;
}

interface PlayHandlerProps {
  linkIndex: number;
  type: string;
  primaryTitle: string;
  secondaryTitle?: string;
  seasonTitle: string;
  episodeData: EpisodeLink[] | Link['directLinks'];
}

interface StickyMenuState {
  active: boolean;
  link?: string;
  type?: string;
}

const SeasonList: React.FC<SeasonListProps> = ({
  LinkList,
  poster,
  type,
  metaTitle,
  providerValue,
  refreshing: _refreshing,
  routeParams,
}) => {
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

  // Early return if no LinkList provided
  if (!LinkList || LinkList.length === 0) {
    return (
      <View className="p-4">
        <Text className="text-white text-center">No Streams Available</Text>
      </View>
    );
  }

  // Memoized initial active season
  const [activeSeason, setActiveSeason] = useState<Link>(() => {
    if (!LinkList || LinkList.length === 0) {
      return {} as Link;
    }

    const cached = cacheStorage.getString(
      `ActiveSeason${metaTitle + providerValue}`,
    );

    if (cached) {
      try {
        const parsedSeason = JSON.parse(cached);
        // Verify the cached season still exists in LinkList
        const seasonExists = LinkList.find(
          link => link.title === parsedSeason.title,
        );
        if (seasonExists) {
          return parsedSeason;
        }
      } catch (error) {
        console.warn('Failed to parse cached season:', error);
      }
    }

    return LinkList[0];
  });

  // React Query for episodes
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

  // UI state
  const [vlcLoading, setVlcLoading] = useState<boolean>(false);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);

  // Search and sorting state - memoized initial values
  const [searchText, setSearchText] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    mainStorage.getString('episodeSortOrder') === 'desc' ? 'desc' : 'asc',
  );

  // External player state
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [externalPlayerStreams, setExternalPlayerStreams] = useState<any[]>([]);
  const [stickyMenuMetadata, setStickyMenuMetadata] = useState<{
    title: string;
    fileName: string;
  } | null>(null);

  // Shared Download Modal state
  const [downloadActive, setDownloadActive] = useState<boolean>(false);
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

  const openDownloadModal = useCallback(
    async (data: {
      title: string;
      link: string;
      type: string;
      fileName: string;
    }) => {
      setDownloadData(data);
      setDownloadLoading(true);
      setDownloadError(null);
      setDownloadServers([]);
      setDownloadModal(true);

      try {
        const streams = await fetchStreams(data.link, data.type, providerValue);
        const filtered = streams.filter(
          (s: Stream) =>
            s.type === 'mp4' ||
            s.type === 'mkv' ||
            s.type === 'm3u8' ||
            s.type === 'hls',
        );
        setDownloadServers(filtered);
      } catch (error: any) {
        setDownloadError(error.message || 'Failed to fetch servers');
      } finally {
        setDownloadLoading(false);
      }
    },
    [fetchStreams, providerValue],
  );

  // VLC loading animation - using shared value so it reacts to vlcLoading state
  const vlcRotation = useSharedValue(0);

  useEffect(() => {
    if (vlcLoading) {
      vlcRotation.value = 0;
      vlcRotation.value = withRepeat(
        withTiming(360, {duration: 800}),
        -1,
        false,
      );
    } else {
      cancelAnimation(vlcRotation);
      vlcRotation.value = 0;
    }
  }, [vlcLoading]);

  const vlcLoadingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${vlcRotation.value}deg`}],
  }));

  // Memoized filtering and sorting logic for episodes
  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) {
      return [];
    }

    let episodes = episodeList.filter(
      episode => episode && episode.title && episode.link,
    );

    // Apply search filter
    if (searchText.trim()) {
      episodes = episodes.filter(episode =>
        episode?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      episodes = [...episodes].reverse();
    }

    return episodes;
  }, [episodeList, searchText, sortOrder]);

  // Memoized direct links processing
  const filteredAndSortedDirectLinks = useMemo(() => {
    if (
      !activeSeason?.directLinks ||
      !Array.isArray(activeSeason.directLinks)
    ) {
      return [];
    }

    let links = activeSeason.directLinks.filter(
      link => link && link.title && link.link,
    );

    // Apply search filter
    if (searchText.trim()) {
      links = links.filter(link =>
        link?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      links = [...links].reverse();
    }

    return links;
  }, [activeSeason?.directLinks, searchText, sortOrder]);

  // Memoized title alignment
  const titleAlignment = useMemo(() => {
    const hasLongTitles =
      filteredAndSortedEpisodes.some(ep => ep?.title && ep.title.length > 27) ||
      filteredAndSortedDirectLinks.some(
        link => link?.title && link.title.length > 27,
      );

    return hasLongTitles ? 'justify-start' : 'justify-center';
  }, [filteredAndSortedEpisodes, filteredAndSortedDirectLinks]);

  // Memoized completion checker
  const isCompleted = useCallback((link: string) => {
    const watchProgress = JSON.parse(cacheStorage.getString(link) || '{}');
    const percentage =
      (watchProgress?.position / watchProgress?.duration) * 100;
    return percentage > 85;
  }, []);

  // Memoized toggle sort order
  const toggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    mainStorage.setString('episodeSortOrder', newOrder);
  }, [sortOrder]);

  // Memoized season change handler
  const handleSeasonChange = useCallback(
    (item: Link) => {
      setActiveSeason(item);
      cacheStorage.setString(
        `ActiveSeason${metaTitle + providerValue}`,
        JSON.stringify(item),
      );
    },
    [metaTitle, providerValue],
  );

  // Memoized external player handler
  const handleExternalPlayer = useCallback(
    async (
      link: string,
      type: string,
      metadata?: {title: string; fileName: string},
    ) => {
      setVlcLoading(true);
      setIsLoadingStreams(true);
      if (metadata) {
        setStickyMenuMetadata(metadata);
      }

      try {
        const streams = await fetchStreams(link, type, providerValue);

        if (!streams || streams.length === 0) {
          show(
            'No streams available from provider',
            'error',
          );
          return;
        }

        setExternalPlayerStreams([...streams]);
        setIsLoadingStreams(false);
        setVlcLoading(false);
        setShowServerModal(true);

        show(
          `Found ${streams.length} servers`,
          'success',
        );
      } catch (error: any) {
        console.error('Error fetching streams:', error);
        const errorMessage = error?.message || 'Failed to load streams';
        show(errorMessage, 'error');
      } finally {
        setVlcLoading(false);
        setIsLoadingStreams(false);
      }
    },
    [fetchStreams, providerValue],
  );

  // Memoized external player opener
  const openExternalPlayer = useCallback(async (streamUrl: string) => {
    setShowServerModal(false);
    setVlcLoading(true);

    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: streamUrl,
        type: 'video/*',
      });
    } catch (error) {
      console.error('Error opening external player:', error);
      show('Failed to open external player', 'error');
    } finally {
      setVlcLoading(false);
    }
  }, []);

  // Memoized play handler
  const playHandler = useCallback(
    async ({
      linkIndex,
      type,
      primaryTitle,
      secondaryTitle,
      seasonTitle,
      episodeData,
    }: PlayHandlerProps) => {
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

      if (!episodeData || episodeData.length === 0) {
        return;
      }

      const link = episodeData[linkIndex].link;
      const file = (
        metaTitle +
        seasonTitle +
        episodeData[linkIndex]?.title
      ).replaceAll(/[^a-zA-Z0-9]/g, '_');

      const externalPlayer = settingsStorage.getBool('useExternalPlayer');
      const dwFile = await ifExists(file);

      if (externalPlayer) {
        if (dwFile) {
          await IntentLauncher.startActivityAsync(
            'android.intent.action.VIEW',
            {
              data: dwFile,
              type: 'video/*',
            },
          );
          return;
        }
        handleExternalPlayer(link, type, {
          title:
            metaTitle.length > 30
              ? metaTitle.slice(0, 30) + '... ' + episodeData[linkIndex]?.title
              : metaTitle + ' ' + episodeData[linkIndex]?.title,
          fileName: file,
        });
        return;
      }

      navigation.navigate('Player', {
        linkIndex,
        episodeList: episodeData as EpisodeLink[],
        type: type,
        primaryTitle: primaryTitle,
        secondaryTitle: seasonTitle,
        poster: poster,
        providerValue: providerValue,
        infoUrl: routeParams.link,
      });
    },
    [
      addItem,
      routeParams.link,
      poster,
      providerValue,
      metaTitle,
      handleExternalPlayer,
      navigation,
    ],
  );

  // Toggle watched handler
  const toggleWatched = useCallback((link: string, watched: boolean) => {
    cacheStorage.setString(
      link,
      JSON.stringify({
        position: watched ? 10000 : 0,
        duration: 1,
      }),
    );
  }, []);

  // Memoized episode render item
  const renderEpisodeItem = useCallback(
    ({item, index}: {item: EpisodeLink; index: number}) => {
      if (!item || !item.link || !item.title) {
        console.warn('Invalid episode item at index', index, item);
        return null;
      }

      const completed = isCompleted(item.link);

      return (
        <View
          key={item.link + index}
          className={`w-full my-2 justify-center items-center gap-y-2
          ${completed ? 'opacity-80' : ''}`}>
          <View className="flex-row w-full justify-between gap-x-2 items-center">
            {/* Episode Thumbnail/Badge */}
            <View
              style={{width: thumbnailWidth, height: thumbnailHeight}}
              className={`${mode === 'dark' ? 'bg-white/5' : 'bg-black/5'} rounded-md justify-center items-center overflow-hidden`}>
              {(item as any).image ? (
                <Image
                  source={{uri: (item as any).image}}
                  style={{width: '100%', height: '100%'}}
                  resizeMode="stretch"
                />
              ) : (
                <View className="items-center justify-center">
                  <Text
                    className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} font-bold`}
                    style={{fontSize: isTablet ? 14 : 12}}>
                    EP
                  </Text>
                  <Text
                    className={`${mode === 'dark' ? 'text-white/60' : 'text-black/60'} font-bold`}
                    style={{fontSize: isTablet ? 18 : 16}}>
                    {index + 1}
                  </Text>
                </View>
              )}
            </View>

            {/* Watched Button */}
            <TouchableOpacity
              className="flex-1 flex-row justify-center items-center gap-2 p-3 bg-tertiary rounded-md h-12"
              onPress={() => toggleWatched(item.link, !completed)}>
              <Ionicons
                name={completed ? 'checkmark-done' : 'checkmark'}
                size={22}
                color={primary}
              />
            </TouchableOpacity>

            {/* Play Button */}
            <TouchableOpacity
              className={`flex-[3] flex-row justify-center items-center gap-2 p-3 ${mode === 'dark' ? 'bg-white/10' : 'bg-black/10'} rounded-md h-12`}
              onPress={() =>
                playHandler({
                  linkIndex: index,
                  type: type,
                  primaryTitle: metaTitle,
                  secondaryTitle: item.title,
                  seasonTitle: activeSeason?.title || '',
                  episodeData: filteredAndSortedEpisodes,
                })
              }>
              <Ionicons name="play" size={24} color={primary} />
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-sm font-semibold flex-1 text-center`}>
                {item.title.length > 30
                  ? item.title.slice(0, 30) + '...'
                  : item.title}
              </Text>
            </TouchableOpacity>

            {/* Servers Button */}
            <TouchableOpacity
              className="flex-1 flex-row justify-center bg-tertiary rounded-md items-center p-3 h-12"
              onPress={() =>
                handleExternalPlayer(item.link, 'series', {
                  title:
                    metaTitle.length > 30
                      ? metaTitle.slice(0, 30) + '... ' + item.title
                      : metaTitle + ' ' + item.title,
                  fileName: (
                    metaTitle +
                    (activeSeason?.title || '') +
                    item.title
                  ).replaceAll(/[^a-zA-Z0-9]/g, '_'),
                })
              }>
              <Feather name="external-link" size={20} color={primary} />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      isCompleted,
      toggleWatched,
      playHandler,
      metaTitle,
      activeSeason?.title,
      filteredAndSortedEpisodes,
      primary,
      type,
      handleExternalPlayer,
    ],
  );

  // Memoized direct link render item
  const renderDirectLinkItem = useCallback(
    ({item, index}: {item: any; index: number}) => {
      if (!item || !item.link || !item.title) {
        console.warn('Invalid direct link item at index', index, item);
        return null;
      }

      const completed = isCompleted(item.link);
      const displayTitle =
        activeSeason?.directLinks?.length &&
        activeSeason?.directLinks?.length > 1
          ? item.title?.length > 27
            ? item.title.slice(0, 27) + '...'
            : item.title
          : 'Play';

      return (
        <View
          key={item.link + index}
          className={`w-full my-2 justify-center items-center gap-y-2
          ${completed ? 'opacity-80' : ''}`}>
          <View className="flex-row w-full justify-between gap-x-2 items-center">
            {/* Link Thumbnail/Badge */}
            

            {/* Watched Button */}
            <TouchableOpacity
              className="flex-1 flex-row justify-center items-center gap-2 p-3 bg-tertiary rounded-md h-12"
              onPress={() => toggleWatched(item.link, !completed)}>
              <Ionicons
                name={completed ? 'checkmark-done' : 'checkmark'}
                size={22}
                color={primary}
              />
            </TouchableOpacity>

            {/* Play Button */}
            <TouchableOpacity
              className={`flex-[3] flex-row justify-center items-center gap-2 p-3 ${mode === 'dark' ? 'bg-white/10' : 'bg-black/10'} rounded-md h-12`}
              onPress={() =>
                playHandler({
                  linkIndex: index,
                  type: type,
                  primaryTitle: metaTitle,
                  secondaryTitle: item.title,
                  seasonTitle: activeSeason?.title || '',
                  episodeData: filteredAndSortedDirectLinks,
                })
              }>
              <Ionicons name="play" size={24} color={primary} />
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-sm font-semibold flex-1 text-center`}>
                {displayTitle}
              </Text>
            </TouchableOpacity>

            {/* Servers Button */}
            <TouchableOpacity
              className="flex-1 flex-row justify-center bg-tertiary rounded-md items-center p-3 h-12"
              onPress={() =>
                handleExternalPlayer(item.link, item?.type || 'series', {
                  title:
                    metaTitle.length > 30
                      ? metaTitle.slice(0, 30) + '... ' + item.title
                      : metaTitle + ' ' + item.title,
                  fileName: (metaTitle + item.title).replaceAll(
                    /[^a-zA-Z0-9]/g,
                    '_',
                  ),
                })
              }>
              <Feather name="external-link" size={20} color={primary} />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      isCompleted,
      toggleWatched,
      playHandler,
      metaTitle,
      activeSeason?.title,
      activeSeason?.directLinks,
      filteredAndSortedDirectLinks,
      primary,
      type,
      handleExternalPlayer,
    ],
  );

  // Memoized server render item
  const renderServerItem = useCallback(
    (item: any, index: number) => (
      <View
        key={`server-${index}-${item.server}`}
        className={`${mode === 'dark' ? 'bg-black/30' : 'bg-gray-100'} p-3 rounded-lg mb-2 flex-row justify-between items-center`}
        style={{borderColor: primary, borderWidth: 1}}>
        <TouchableOpacity
          onPress={() => openExternalPlayer(item.link)}
          className="flex-1">
          <View>
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-lg capitalize font-bold`}>
              {item.server || `Server ${index + 1}`}
            </Text>
            <Text className={`${mode === 'dark' ? 'text-white/80' : 'text-black/60'} text-xs`}>
              {item.type ? `Format: ${item.type.toUpperCase()}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <View className="flex-row gap-x-3 items-center">
          <TouchableOpacity
            onPress={() => {
              Clipboard.setString(item.link);
              show('Link copied to clipboard', 'success');
            }}>
            <MaterialIcons name="content-copy" size={24} color={primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openExternalPlayer(item.link)}
            className={`${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'} p-2 rounded-full`}>
            <MaterialIcons name="file-download" size={24} color={mode === 'dark' ? 'white' : 'black'} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [primary, openExternalPlayer, stickyMenuMetadata],
  );


  // Show loading skeleton while episodes are loading
  if (episodeLoading) {
    return (
      <View>
        {LinkList.length > 1 && (
          <Dropdown
            selectedTextStyle={{
              color: primary,
              overflow: 'hidden',
              height: 20,
              fontWeight: 'bold',
            }}
            labelField={'title'}
            valueField={
              LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'
            }
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
            }}
            containerStyle={{
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'gray',
              borderRadius: 8,
              backgroundColor: mode === 'dark' ? 'black' : 'white',
            }}
            renderItem={item => (
              <View
                className={`px-3 py-2 text-white flex-row justify-start items-center border-b border-gray-500 text-center ${
                  activeSeason === item ? (mode === 'dark' ? 'bg-quaternary' : 'bg-gray-200') : (mode === 'dark' ? 'bg-black' : 'bg-white')
                }`}>
                <Text className={mode === 'dark' ? 'text-white' : 'text-black'}>{item?.title || 'Unknown'}</Text>
              </View>
            )}
          />
        )}

        <View
          style={{
            width: '100%',
            padding: 10,
            alignItems: 'flex-start',
            gap: 20,
          }}>
          {[...Array(6)].map((_, index) => (
            <SkeletonLoader key={index} show={true} height={48} width={'85%'} />
          ))}
        </View>
      </View>
    );
  }

  // Show error state
  if (episodeError) {
    return (
      <View className="p-4">
        <Text className="text-red-500 text-center">
          {episodeError.message || 'Failed to load episodes. Please try again.'}
        </Text>
        <TouchableOpacity
          className="mt-2 bg-red-600 p-2 rounded-md"
          onPress={() => refetchEpisodes()}>
          <Text className="text-white text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Season Selector */}
      {LinkList.length > 1 ? (
        <Dropdown
          selectedTextStyle={{
            color: primary,
            overflow: 'hidden',
            height: 20,
            fontWeight: 'bold',
          }}
          labelField={'title'}
          valueField={
            LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'
          }
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
            paddingVertical: 8,
          }}
          containerStyle={{
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 8,
            backgroundColor: mode === 'dark' ? 'black' : 'white',
          }}
          renderItem={item => (
            <View
              className={`px-3 py-2 text-white flex-row justify-start items-center border-b border-gray-500 text-center ${
                activeSeason === item ? (mode === 'dark' ? 'bg-quaternary' : 'bg-gray-200') : (mode === 'dark' ? 'bg-black' : 'bg-white')
              }`}>
              <Text className={mode === 'dark' ? 'text-white' : 'text-black'}>{item?.title || 'Unknown'}</Text>
            </View>
          )}
        />
      ) : (
        <Text className={`${mode === 'dark' ? 'text-red-600' : 'text-red-700'} text-lg font-semibold px-2`}>
          {LinkList[0]?.title || 'Unknown Season'}
        </Text>
      )}

      {/* Search and Sort Controls */}
      {(filteredAndSortedEpisodes.length > 8 ||
        filteredAndSortedDirectLinks.length > 8) && (
        <View className="flex-row justify-between items-center mt-2">
          <TextInput
            placeholder="Search..."
            placeholderTextColor={mode === 'dark' ? '#9ca3af' : '#6b7280'}
            className={`${mode === 'dark' ? 'bg-black/30 text-white border-white/10' : 'bg-white text-black border-black/10'} rounded-md p-2 h-10 w-[80%] border-collapse border`}
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            className={`${mode === 'dark' ? 'bg-black/30' : 'bg-gray-200'} rounded-md p-2 h-10 w-[15%] flex-row justify-center items-center`}
            onPress={toggleSortOrder}>
            <MaterialCommunityIcons
              name={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'}
              size={24}
              color={primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Episode/Direct Links List */}
      <View className="flex-row flex-wrap justify-center gap-x-2 gap-y-2 mt-5">
        {/* Episodes List */}
        {filteredAndSortedEpisodes.length > 0 && (
          <FlatList
            data={filteredAndSortedEpisodes}
            keyExtractor={(item, index) => `episode-${item.link}-${index}`}
            renderItem={renderEpisodeItem}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            getItemLayout={(data, index) => ({
              length: 60,
              offset: 60 * index,
              index,
            })}
          />
        )}

        {/* Direct Links List */}
        {filteredAndSortedDirectLinks.length > 0 && (
          <View className="w-full justify-center items-center gap-y-2 mt-5 p-2">
            <FlatList
              data={filteredAndSortedDirectLinks}
              keyExtractor={(item, index) => `direct-${item.link}-${index}`}
              renderItem={renderDirectLinkItem}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: 68,
                offset: 68 * index,
                index,
              })}
            />
          </View>
        )}

        {/* No Content Available */}
        {filteredAndSortedEpisodes.length === 0 &&
          filteredAndSortedDirectLinks.length === 0 &&
          LinkList?.length === 0 && (
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-lg font-semibold min-h-20`}>
              No stream found
            </Text>
          )}
      </View>

      {/* VLC Loading Indicator */}
      {vlcLoading && (
        <View className={`absolute top-0 left-0 w-full h-full ${mode === 'dark' ? 'bg-black/60' : 'bg-white/60'} justify-center items-center`}>
          <Animated.View style={[vlcLoadingAnimatedStyle]}>
            <MaterialCommunityIcons name="vlc" size={70} color={primary} />
          </Animated.View>
          <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-lg font-semibold mt-2`}>
            Loading available servers...
          </Text>
        </View>
      )}

      {/* Server Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showServerModal}
        onRequestClose={() => setShowServerModal(false)}>
        <Pressable
          onPress={() => setShowServerModal(false)}
          className="flex-1 justify-center items-center bg-black/60">
          <View className={`${mode === 'dark' ? 'bg-tertiary border-quaternary' : 'bg-white border-gray-200'} rounded-2xl p-6 w-[92%] max-w-[400px] border shadow-2xl`}>
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-xl font-bold mb-2 text-center`}>
              Select External Player Server
            </Text>
            <Text className={`${mode === 'dark' ? 'text-white/60' : 'text-black/50'} text-sm mb-4 text-center`}>
              {externalPlayerStreams.length} servers available
            </Text>
            <View className={`${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'} p-3 rounded-xl mb-6 border ${mode === 'dark' ? 'border-white/10' : 'border-black/5'}`}>
              <Text className={`${mode === 'dark' ? 'text-white/70' : 'text-black/70'} text-xs text-center italic`}>
                Note: Copy link and use it in any external downloader or player.
              </Text>
            </View>

            {isLoadingStreams ? (
              <ActivityIndicator size="large" color={primary} />
            ) : (
              <>
                <ScrollView style={{maxHeight: 350}} showsVerticalScrollIndicator={true}>
                  {externalPlayerStreams.map((item, index) =>
                    renderServerItem(item, index),
                  )}
                  {externalPlayerStreams.length === 0 && (
                    <Text className={`${mode === 'dark' ? 'text-white/50' : 'text-black/40'} text-center p-8`}>
                      No servers available
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  className={`mt-6 ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-100'} py-3 rounded-xl`}
                  onPress={() => setShowServerModal(false)}>
                  <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-center font-bold`}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Sticky Menu Modal (Removed in favor of inline buttons) */}

      {/* Shared Download Bottom Sheet */}
      <DownloadBottomSheet
        data={downloadServers}
        loading={downloadLoading}
        showModal={downloadModal}
        setModal={setDownloadModal}
        title={downloadData?.title || 'Download Options'}
        error={downloadError}
        onPressVideo={(server: Stream) => {
          if (!downloadData) return;
          if (settingsStorage.getBool('alwaysExternalDownloader')) {
            Linking.openURL(server.link);
            return;
          }
          downloadManager({
            title: downloadData.title,
            url: server.link,
            fileName: downloadData.fileName,
            fileType: server.type,
            setDownloadActive: setDownloadActive,
            headers: server.headers,
            setAlreadyDownloaded: () => {}, // Handled by Downloader's internal effect
            setDownloadId: () => {}, // Handled by Downloader's internal state if needed
            deleteDownload: () => {}, // Handled by Downloader
            provider: providerValue,
          });
        }}
        onPressSubs={(item: any) => {
          if (!downloadData) return;
          if (settingsStorage.getBool('alwaysExternalDownloader')) {
            Linking.openURL(item.link);
            return;
          }
          downloadManager({
            title: item.title,
            url: item.link,
            fileName: item.title.replaceAll(/[^a-zA-Z0-9]/g, '_'),
            fileType: item.type,
            setDownloadActive: setDownloadActive,
            setAlreadyDownloaded: () => {},
            setDownloadId: () => {},
            deleteDownload: () => {},
            provider: providerValue,
          });
        }}
      />
    </View>
  );
};

export default SeasonList;
