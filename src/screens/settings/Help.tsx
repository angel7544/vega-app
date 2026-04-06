import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  StyleSheet,
} from 'react-native';
import React from 'react';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SettingsStackParamList} from '../../types/navigation';
import {BlurView} from 'expo-blur';
import {StatusBar as ExpoStatusBar} from 'expo-status-bar';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Help'>;

const Help = ({navigation}: Props) => {
  const {primary, mode} = useThemeStore(state => state);

  const Section = ({
    title,
    icon,
    children,
    delay = 0,
  }: {
    title: string;
    icon: string;
    children: React.ReactNode;
    delay?: number;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      className={`${
        mode === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-100'
      } rounded-2xl p-5 mb-6 border ${
        mode === 'dark' ? 'border-white/5' : 'border-black/5'
      }`}>
      <View className="flex-row items-center mb-4">
        <View
          style={{backgroundColor: `${primary}20`}}
          className="w-10 h-10 rounded-xl items-center justify-center mr-3">
          <MaterialCommunityIcons name={icon as any} size={22} color={primary} />
        </View>
        <Text
          className={`text-lg font-bold ${
            mode === 'dark' ? 'text-white' : 'text-black'
          }`}>
          {title}
        </Text>
      </View>
      {children}
    </Animated.View>
  );

  return (
    <View className={`flex-1 ${mode === 'dark' ? 'bg-black' : 'bg-white'}`}>
      <ExpoStatusBar
        style={mode === 'dark' ? 'light' : 'dark'}
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Premium Sticky Header */}
      <View 
        className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 flex-row items-center justify-between"
        style={{ backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }}
      >
        <BlurView intensity={30} tint={mode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className={`w-10 h-10 items-center justify-center rounded-full ${mode === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={mode === 'dark' ? 'white' : 'black'} />
        </TouchableOpacity>
        <Text className={`text-lg font-black uppercase tracking-[2px] ${mode === 'dark' ? 'text-white' : 'text-black'}`}>
          Help Center
        </Text>
        <View className="w-10" />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 60, paddingTop: 140}}>
        
        <View className="px-5">
           {/* Introduction */}
           <Animated.View entering={FadeInDown.delay(50).springify()} className="mb-8 items-center">
              <Text className="text-gray-500 font-bold uppercase tracking-[4px] text-[10px] mb-2">Documentation</Text>
              <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-center text-sm px-6 leading-5 opacity-60 font-medium`}>
                 Master the ultimate streaming experience with our high-performance pipeline and intuitive UI.
              </Text>
           </Animated.View>

          {/* New UI & App Update */}
          <Section title="The New Experience" icon="auto-fix" delay={100}>
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } leading-6 mb-3`}>
              Welcome to the whole new updated app! We've completely redesigned
              the interface with a focus on Glassmorphism, fluid animations, and
              high-performance responsiveness.
            </Text>
            <View className="flex-row items-center space-x-2 bg-primary/10 p-3 rounded-lg">
              <Feather name="zap" size={16} color={primary} />
              <Text style={{color: primary}} className="font-bold text-xs uppercase tracking-widest">
                Optimized for Speed & Fluidity
              </Text>
            </View>
          </Section>

          {/* Live TV & EPG */}
          <Section title="Live TV & EPG 2.0" icon="television-guide" delay={200}>
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } leading-6 mb-3`}>
              Our advanced EPG 2.0 pipeline fetches schedules in real-time,
              splitting massive XML data into optimized JSON chunks for near-zero
              latency via <Text className="font-black text-primary">iptv-org</Text> standards.
            </Text>
            <View className="space-y-2">
              <View className="flex-row items-start">
                <View className="w-1.5 h-1.5 rounded-full bg-primary mt-2 mr-2" />
                <Text className={mode === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  <Text className="font-bold text-primary">Time Shift:</Text> If show times are misaligned, use EPG Time Shift in Preferences.
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-1.5 h-1.5 rounded-full bg-primary mt-2 mr-2" />
                <Text className={mode === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  <Text className="font-bold text-primary">Force Sync:</Text> Use the sync button if channel data is missing.
                </Text>
              </View>
            </View>
          </Section>

          {/* Streaming & VOD */}
          <Section title="Streaming & VOD" icon="movie-play" delay={300}>
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } leading-6 mb-3`}>
              Enjoy multi-source support for Movies and Series. The app scrapes
              publicly available data to provide you with the best available quality.
            </Text>
            <View className="flex-row space-x-2">
               <View className="bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                  <Text className="text-[10px] text-gray-500 font-bold uppercase">Ad-Free</Text>
               </View>
               <View className="bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                  <Text className="text-[10px] text-gray-500 font-bold uppercase">Multi-Audio</Text>
               </View>
               <View className="bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                  <Text className="text-[10px] text-gray-500 font-bold uppercase">Subtitles</Text>
               </View>
            </View>
          </Section>

          {/* Providers & Themes */}
          <Section title="Customization" icon="palette-swatch" delay={400}>
            <View className="space-y-4">
              <View>
                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-bold mb-1`}>Provider System</Text>
                <Text className={mode === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  Manage your content sources in Provider Manager. Install extensions to unlock more categories and signals.
                </Text>
              </View>
              <View>
                <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-bold mb-1`}>Dark & Light Mode</Text>
                <Text className={mode === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  Switch themes instantly in settings. The entire app adjusts its palette for the best viewing comfort.
                </Text>
              </View>
            </View>
          </Section>

          {/* Usage Tips */}
          <Section title="Usage Tips & VPN" icon="lightbulb-on" delay={500}>
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } leading-6`}>
              • <Text className="font-bold">VPN Choice:</Text> Use a high-quality VPN if certain providers are blocked in your region.
              {"\n"}• <Text className="font-bold">External Player:</Text> Enable "Always Use External Player" if you prefer apps like VLC or MX Player.
              {"\n"}• <Text className="font-bold">Downloading:</Text> For the best speeds, use an external downloader via the download options.
            </Text>
          </Section>

          {/* Disclaimer */}
          <Section title="Legal Disclaimer" icon="shield-check" delay={600}>
            <Text
              className={`${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
              } text-xs italic leading-5`}>
              VEGA APP is a technology tool designed to consolidate searching 
              and indexing functionality for content already available on the public internet. 
              We do NOT host, store, or upload any media files. Usage of this software is 
              at the user's discovery and risk.
            </Text>
          </Section>

          {/* Developer Info */}
          <Animated.View entering={FadeInDown.delay(700).springify()} className="items-center mt-4">
            <Image 
              source={{ uri: 'https://br31tech.live/logo.png' }}
              style={{ width: 60, height: 60, borderRadius: 12 }}
              resizeMode="contain"
            />
            <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} font-black text-xl mt-3`}>
              BR31 TECHNOLOGIES
            </Text>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
              Digital Solution Experts
            </Text>
            
            <View className="mt-8 p-6 rounded-3xl bg-primary/5 border border-primary/10 w-full items-center">
               <Text className={`${mode === 'dark' ? 'text-white/40' : 'text-black/40'} text-[10px] uppercase font-black tracking-widest mb-4`}>Technical Credits</Text>
               <Text className={`${mode === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-center text-xs font-medium leading-5 mb-4`}>
                  Ported on <Text className="text-primary font-black">Vega App</Text> by <Text className="text-primary font-black">Vega Org</Text> powered by <Text className="text-primary font-black">iptv-org</Text> & global <Text className="text-primary font-black">EPG</Text> support standards.
               </Text>
               <View className="h-[1px] w-12 bg-primary/20 mb-4" />
               <Text className={`${mode === 'dark' ? 'text-white' : 'text-black'} text-center text-sm font-bold leading-5`}>
                  Major contributor to whole new design and pipeline <Text style={{ color: primary }} className="font-black">angel7544</Text>
               </Text>
            </View>

            <TouchableOpacity 
              onPress={() => Linking.openURL('https://www.br31tech.live')}
              className="mt-8 bg-primary/20 px-8 py-4 rounded-full flex-row items-center border border-primary/30 shadow-lg"
              style={{ gap: 10 }}
            >
              <Feather name="globe" size={16} color={primary} />
              <Text style={{ color: primary }} className="font-black uppercase text-xs tracking-widest">
                Visit Website
              </Text>
            </TouchableOpacity>

            <Text className="text-gray-500 text-[10px] font-bold mt-10 mb-2 uppercase tracking-widest opacity-40">
               © 2026 BR31 Technologies • Built for Excellence
            </Text>
          </Animated.View>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

export default Help;
