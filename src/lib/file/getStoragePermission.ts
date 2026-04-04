import {PermissionsAndroid, Platform} from 'react-native';

export default async function requestStoragePermission() {
  try {
    console.log('requesting storage permission', Platform.OS, Platform.Version);
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        // Android 13+ uses granular permissions
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } else if (Platform.Version > 29) {
        // Android 10-12
        return true;
      } else {
        // Android 9 and below
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to storage to download files',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
}
