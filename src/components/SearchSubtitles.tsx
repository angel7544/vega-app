import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {useState} from 'react';
import useThemeStore from '../lib/zustand/themeStore';
import {ScrollView} from 'react-native';
import {Dropdown} from 'react-native-element-dropdown';
import {TextTracks, TextTrackType} from 'react-native-video';
import useToastStore from '../lib/zustand/toastStore';

const SearchSubtitles = ({
  searchQuery,
  setSearchQuery,
  setExternalSubs,
}: {
  searchQuery: string;
  setSearchQuery: (text: string) => void;
  setExternalSubs: React.Dispatch<React.SetStateAction<TextTracks>>;
}) => {
  const {primary, mode} = useThemeStore(state => state);
  const {show} = useToastStore();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [subId, setSubId] = useState('eng');

  const subLanguageIds = [
    {name: 'English', id: 'eng'},
    {name: 'Spanish', id: 'spa'},
    {name: 'French', id: 'fre'},
    {name: 'German', id: 'ger'},
    {name: 'Italian', id: 'ita'},
    {name: 'Portuguese', id: 'por'},
    {name: 'Russian', id: 'rus'},
    {name: 'Chinese', id: 'chi'},
    {name: 'Japanese', id: 'jpn'},
    {name: 'Korean', id: 'kor'},
    {name: 'Arabic', id: 'ara'},
    {name: 'Hindi', id: 'hin'},
    {name: 'Dutch', id: 'dut'},
    {name: 'Swedish', id: 'swe'},
    {name: 'Polish', id: 'pol'},
    {name: 'Turkish', id: 'tur'},
    {name: 'Danish', id: 'dan'},
    {name: 'Norwegian', id: 'nor'},
    {name: 'Finnish', id: 'fin'},
    {name: 'Vietnamese', id: 'vie'},
    {name: 'Indonesian', id: 'ind'},
  ];

  const searchSubtitles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://rest.opensubtitles.org/search${
          episode ? '/episode-' + episode : ''
        }${
          (searchQuery?.startsWith('tt') ? '/imdbid-' : '/query-') +
          encodeURIComponent(searchQuery.toLocaleLowerCase())
        }${season ? '/season-' + season : ''}${
          subId ? '/sublanguageid-' + subId : ''
        }`,
        {
          method: 'GET',
          headers: {
            'x-user-agent': 'VLSub 0.10.2',
          },
        },
      );
      const data = await response.json();
      setLoading(false);
      if (data?.length === 0) {
        setError('No Results Found');
        setSearchResults([]);
        return;
      }
      setSearchResults(data);
    } catch (e: any) {
      setLoading(false);
      setError(e?.message);
      show('Error fetching subtitles', 'error');
    }
  };
  return (
    <View>
      <TouchableOpacity
        className="flex-row gap-3 items-center rounded-md my-1 overflow-hidden ml-2"
        onPress={() => setSearchModalVisible(true)}>
        <MaterialIcons name="add" size={20} color={mode === 'dark' ? 'white' : 'black'} />
        <Text className="text-base font-semibold text-black dark:text-white">
          search subtitles online
        </Text>
      </TouchableOpacity>
      <Modal
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        visible={searchModalVisible}
        onRequestClose={() => {
          setSearchModalVisible(!searchModalVisible);
        }}>
        <SafeAreaView className="h-full w-full bg-white dark:bg-black">
          <View className="flex-row justify-start items-center gap-x-4 px-4 py-2 border-b border-black/5 dark:border-white/5">
            <MaterialIcons
              name="arrow-back-ios-new"
              size={24}
              color={mode === 'dark' ? 'white' : 'black'}
              onPress={() => setSearchModalVisible(false)}
            />
            <Text className="text-black dark:text-white text-xl font-semibold">
              Search Subtitles
            </Text>
          </View>
          <View className="flex-row justify-between items-center px-4 py-4 gap-x-2">
            <TextInput
              placeholder="Name or IMDB ID"
              placeholderTextColor={mode === 'dark' ? '#666' : '#999'}
              className="bg-black/5 dark:bg-quaternary flex-1 rounded-md p-2 text-black dark:text-white"
              onChangeText={text => setSearchQuery(text)}
              value={searchQuery}
            />
            <View className="bg-black/5 dark:bg-quaternary w-14 h-11 rounded-md p-2 justify-center">
              <Dropdown
                selectedTextStyle={{
                  color: mode === 'dark' ? 'white' : 'black',
                  fontSize: 12,
                  fontWeight: 'bold',
                }}
                containerStyle={{
                  borderColor: mode === 'dark' ? '#363636' : '#ccc',
                  width: 140,
                  borderRadius: 8,
                  backgroundColor: mode === 'dark' ? 'black' : 'white',
                  marginTop: 10,
                }}
                labelField={'id'}
                valueField={'id'}
                placeholder="Select"
                value={subId}
                data={subLanguageIds}
                onChange={async item => {
                  setSubId(item.id);
                }}
                renderItem={(item) => (
                  <View className={`px-3 py-3 ${mode === 'dark' ? 'bg-black' : 'bg-white'} border-b border-black/5 dark:border-white/5`}>
                    <Text className={`text-base ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
                      {item.name}
                    </Text>
                  </View>
                )}
              />
            </View>
            <TextInput
              placeholder="S"
              placeholderTextColor={mode === 'dark' ? '#666' : '#999'}
              keyboardType="numeric"
              className="bg-black/5 dark:bg-quaternary text-black dark:text-white w-10 rounded-md p-2 text-center"
              onChangeText={text => setSeason(text)}
              value={season}
            />
            <TextInput
              placeholder="E"
              placeholderTextColor={mode === 'dark' ? '#666' : '#999'}
              keyboardType="numeric"
              className="bg-black/5 dark:bg-quaternary text-black dark:text-white w-10 rounded-md p-2 text-center"
              onChangeText={text => setEpisode(text)}
              value={episode}
            />
            <TouchableOpacity onPress={() => searchSubtitles()}>
              <MaterialIcons
                name="search"
                size={34}
                color={primary}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            className="px-4 py-2"
            contentContainerStyle={{flexGrow: 1}}>
            {loading ? (
              <View className="w-full h-full justify-center items-center">
                <ActivityIndicator size="large" color={primary} />
              </View>
            ) : (
              searchResults.map((result: any) => (
                <TouchableOpacity
                  key={result?.IDSubtitleFile}
                  className="flex-row items-center gap-x-4 p-3 my-1 border-b border-black/5 dark:border-white/10"
                  onPress={() => {
                    setSearchModalVisible(false);
                    setExternalSubs(prev => [
                      {
                        type: TextTrackType.SUBRIP,
                        language: result?.ISO639,
                        title:
                          result?.InfoReleaseGroup + ' ' + result?.UserNickName,
                        uri: result?.SubDownloadLink?.replace('.gz', ''),
                      },
                      ...prev,
                    ]);
                  }}>
                  <View className="bg-primary/20 p-2 rounded-md w-12 items-center">
                    <Text className="text-primary font-bold uppercase text-xs">
                      {result?.SubLanguageID}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-black dark:text-white text-base font-semibold" numberOfLines={1}>
                      {result?.MovieName?.trim()}
                    </Text>
                    <View className="flex-row items-center gap-x-2 mt-1">
                      {Number(result?.SeriesSeason) > 0 && (
                        <Text className="text-black/60 dark:text-white/60 text-xs">
                          S{result?.SeriesSeason}
                        </Text>
                      )}
                      {Number(result?.SeriesEpisode) > 0 && (
                        <Text className="text-black/60 dark:text-white/60 text-xs">
                          E{result?.SeriesEpisode}
                        </Text>
                      )}
                      <Text className="text-black/40 dark:text-white/40 text-[10px] italic flex-1" numberOfLines={1}>
                        {result?.InfoReleaseGroup} • {result?.UserNickName}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
            {searchResults.length === 0 && !loading && error && (
              <View className="flex-1 justify-center items-center mt-20">
                <MaterialIcons name="error-outline" size={48} color="#ef4444" />
                <Text className="text-red-500 text-lg font-semibold mt-4">
                  {error}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default SearchSubtitles;

