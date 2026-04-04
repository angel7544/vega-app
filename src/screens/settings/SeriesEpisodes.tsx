import React from 'react';
import {View, Text, Image, TouchableOpacity, useWindowDimensions} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Feather} from '@expo/vector-icons';
import {CompositeNavigationProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList, WatchHistoryStackParamList} from '../../App';
import useThemeStore from '../../lib/zustand/themeStore';

type SeriesEpisodesRouteProp = NativeStackScreenProps<
  WatchHistoryStackParamList,
  'SeriesEpisodes'
>;

type SeriesEpisodesNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<WatchHistoryStackParamList, 'SeriesEpisodes'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const SeriesEpisodes = ({
  navigation,
  route,
}: {
  navigation: SeriesEpisodesNavigationProp;
  route: SeriesEpisodesRouteProp['route'];
}) => {
  const {width: windowWidth} = useWindowDimensions();
  const isTablet = windowWidth > 768;
  const thumbnailWidth = isTablet ? 120 : 80;
  const thumbnailHeight = isTablet ? 180 : 120;
  const {primary, mode} = useThemeStore(state => state);
  const {series, episodes, thumbnails} = route.params;

  // Function to extract episode number from filename
  const getEpisodeNumber = (filename: string): number => {
    const match =
      filename.match(/episode[\s-]*(\d+)/i) ||
      filename.match(/episode[_\s-]*(\d+)/i) ||
      filename.match(/ep[\s-]*(\d+)/i) ||
      filename.match(/Episodes[_\s-]*(\d+)/i) ||
      filename.match(/Episode[_\s-]*(\d+)/i) ||
      filename.match(/[^a-zA-Z]E(\d+)[^a-zA-Z]/i) ||
      filename.match(/[^\d](\d+)[^\d]/);
    console.log('match', match);

    return match ? parseInt(match[1], 10) : 0;
  };

  // Sort episodes by episode number
  const sortedEpisodes = [...episodes].sort((a, b) => {
    const aFilename = a.uri.split('/').pop() || '';
    const bFilename = b.uri.split('/').pop() || '';
    return getEpisodeNumber(aFilename) - getEpisodeNumber(bFilename);
  });

  return (
    <View className={`w-full h-full ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
      {/* Simple Header */}
      <View className={`${mode === 'dark' ? 'bg-quaternary' : 'bg-gray-100'} px-4 pt-14 pb-4`}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className={`${mode === 'dark' ? 'bg-tertiary' : 'bg-white'} p-2 rounded-full`}>
            <Feather name="arrow-left" size={24} color={mode === 'dark' ? 'white' : 'black'} />
          </TouchableOpacity>
          <Text
            className={`text-xl font-bold ml-4 flex-1 ${mode === 'dark' ? 'text-white' : 'text-black'}`}
            numberOfLines={1}
            ellipsizeMode="tail">
            {series.length > 20 ? series.substring(0, 20) + '...' : series}
          </Text>
        </View>
      </View>

      {/* Episodes list */}
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between py-4">
          <Text className={`text-lg font-bold ${mode === 'dark' ? 'text-white' : 'text-black'}`}>Episodes</Text>
          <Text className="text-gray-400">{episodes.length} episodes</Text>
        </View>

        <FlashList
          data={sortedEpisodes}
          estimatedItemSize={100}
          renderItem={({item}) => {
            const fileName = item.uri.split('/').pop() || '';
            const episodeNumber = getEpisodeNumber(fileName);

            return (
              <TouchableOpacity
                className={`flex-row rounded-lg overflow-hidden mb-2 ${mode === 'dark' ? 'bg-tertiary' : 'bg-gray-100'}`}
                style={{height: thumbnailHeight}}
                onPress={() => {
                  navigation.navigate('Player', {
                    episodeList: [{title: fileName || '', link: item.uri}],
                    linkIndex: 0,
                    type: '',
                    directUrl: item.uri,
                    primaryTitle: fileName,
                    poster: {},
                    providerValue: 'OrbixPlay',
                    doNotTrack: true,
                  });
                }}>
                <View style={{width: thumbnailWidth, height: '100%', position: 'relative'}}>
                  {thumbnails[item.uri] ? (
                    <Image
                      source={{uri: thumbnails[item.uri]}}
                      className="w-full h-full"
                      resizeMode="stretch"
                    />
                  ) : (
                    <View className={`w-full h-full ${mode === 'dark' ? 'bg-quaternary' : 'bg-gray-200'}`} />
                  )}
                  <View className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded">
                    <Text className="text-white text-[10px]">
                      EP {episodeNumber}
                    </Text>
                  </View>
                </View>
                <View className="flex-1 p-3 justify-center">
                  <Text className={`text-base font-medium mb-1 ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                    Episode {episodeNumber}
                  </Text>
                  <Text className="text-[10px] my-1 text-gray-400" numberOfLines={1}>
                    {fileName}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {item.size ? (item.size / (1024 * 1024)).toFixed(1) : '0.0'} MB
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

export default SeriesEpisodes;
