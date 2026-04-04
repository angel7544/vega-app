import React from 'react';
import {View, Text} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';

interface GenrePillProps {
  label: string;
}

const GenrePill = ({label}: GenrePillProps) => {
  const {mode} = useThemeStore(state => state);
  const isDark = mode === 'dark';

  return (
    <View
      className={`px-3 py-1 rounded-full mr-2 mb-2 ${
        isDark ? 'bg-indigo-600/30' : 'bg-indigo-100'
      }`}>
      <Text
        className={`text-xs ${
          isDark ? 'text-indigo-300' : 'text-indigo-600'
        } font-medium`}>
        {label}
      </Text>
    </View>
  );
};

export default GenrePill;
