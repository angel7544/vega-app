import { mainStorage } from './storage/StorageService';

// Export mainStorage as MMKV for compatibility with Search.tsx and others
export const MMKV = mainStorage;

// Default storage for low-level react-native-mmkv use if needed
export const storage = mainStorage;

// Cache storage
export const cacheStorage = mainStorage;
