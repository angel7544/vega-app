const {getDefaultConfig} = require('expo/metro-config');
const {withNativeWind} = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('expo-crypto'),
};

config.resolver.assetExts.push('xml');

module.exports = withNativeWind(config, {input: './src/global.css'});
