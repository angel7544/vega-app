<p align="center">
  <img src="assets/icon.png" width="200" alt="Orbix Play Logo">
</p>

# Orbix Play
Android app for streaming media.
### Features
- Steam and Download Ad-Free.
- Multiple sources.
- Multi Audio and Subs (Hindi, English, etc.).
- WatchList.
- External player and Downloader support.
<br>

[![Discord](https://custom-icon-badges.demolab.com/badge/-Join_Discord-6567a5?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/cr42m6maWy)

___

## Download APK ![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/angel7544/vega-app/total?link=https%3A%2F%2Fgithub.com%2Fangel7544%2Fvega-app%2Freleases&label=Github%20Downloads)
> <sub>Download Universal version if you are confused about armeabi-v7a or arm64-v8a or follow this guide https://vega.8man.in/guide/.</sub>

[![Download Apk](https://custom-icon-badges.demolab.com/badge/-Download_From_Github-black?style=for-the-badge&logo=download&logoColor=white)](https://github.com/angel7544/vega-app/releases/latest)

[![Download Apk](https://custom-icon-badges.demolab.com/badge/-Download_From_Website-tomato?style=for-the-badge&logo=download&logoColor=white)](https://vega.8man.in/#download)


<br>

## Add Provider source
> [!TIP]
> Follow the guide here https://vega.8man.in/guide/adding-providers/

## Screenshots
![Screenshots](https://github.com/user-attachments/assets/b86af756-e66e-4ae7-b2af-61b25cfd8d4e)

___

## Stack
<p align="left">
     
[![React-Native](https://custom-icon-badges.demolab.com/badge/-React_Native-287aad?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://custom-icon-badges.demolab.com/badge/Typescript-3078C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NativeWind](https://custom-icon-badges.demolab.com/badge/Native_Wind-0CA6E9?style=for-the-badge&logo=tailwind&logoColor=white)](https://www.nativewind.dev/)
[![React-Navigation](https://custom-icon-badges.demolab.com/badge/React_Navigation-6838d9?style=for-the-badge&logo=menu&logoColor=white)](https://reactnavigation.org/)
[![Expo-Modules](https://custom-icon-badges.demolab.com/badge/Expo_Modules-black?style=for-the-badge&logo=expo&logoColor=white)](https://docs.expo.dev/modules/overview/)
[![React-Native-Video](https://custom-icon-badges.demolab.com/badge/React_native_video-38d9c9?style=for-the-badge&logo=video&logoColor=white)](https://thewidlarzgroup.github.io/react-native-video/)
[![MMKV-Storage](https://custom-icon-badges.demolab.com/badge/MMKV_Storage-yellow?style=for-the-badge&logo=zap&logoColor=white)](https://github.com/mrousavy/react-native-mmkv)



</p>

## Build and Dev
0. Set-up React Native environment if you haven't already. [Guide](https://reactnative.dev/docs/set-up-your-environment)

1. clone
     ```bash
     git clone https://github.com/angel7544/vega-app.git
     ```
     ```
     cd vega-app
     ```
2. Install
     ```
     npm install
     ```
3. Prebuild
   ```
    npx expo prebuild -p android --clean
   ```
5. Open metro dev server
Dev
     ```
     npm run android
     ```
Build apk/aab
https://reactnative.dev/docs/signed-apk-android

---
> [!IMPORTANT]
> Orbix Play does not store any media files on our servers and is not directly linked to the media. Third-party services host all media, and Orbix Play merely provides a search and web scraping tool that indexes publicly available data. We are not responsible for the content or availability of the media, as we do not host or control any of it.



## 🚀 Recent Contributors & Technical Evolution

### 💎 Elite Contributor: Angel Mehul Singh ([@angel7544](https://github.com/angel7544))

#### 🛠️ Core Engineering & Innovations
*   **EPG Pipeline 2.0**: Engineered a high-performance extraction system that slices monolithic XML feeds into lean, on-demand JSON chunks.
*   **Tata Play Synergy**: Successfully integrated Tata Play metadata, ensuring seamless alignment with global `iptv-org` standards.
*   **Infinite Performance**: Optimized UI responsiveness via TV Guide virtualization and memory-safe parsing.
*   **Zero-Latency Lookups**: Implemented dictionary-based caching for instant (O(1)) schedule synchronization.

#### 📊 EPG Data Flow Architecture
```mermaid
graph TD
    RemoteSource["🌐 Remote IPTV Sources"] -->|"XMLTV / M3U"| Engine["⚙️ Extraction Engine"]
    Engine -->|"Large XML Pruning"| Parser["🔬 Data Parser"]
    Parser -->|"Tata Play Integration"| Metadata["🏗️ Metadata Alignment"]
    Parser -->|"JSON Chunking"| Storage["📦 Optimized JSON Storage"]
    Storage -->|"On-Demand Fetching"| App["📱 Orbix Play Frontend"]
    App -->|"Virtual Grid"| Guide["📅 Live TV Guide"]
    App -->|"O(1) Lookup"| RealTime["⏱️ Real-time Schedules"]

    style Storage fill:#f9f,stroke:#333,stroke-width:2px
    style App fill:#bbf,stroke:#333,stroke-width:2px
    style Guide fill:#bfb,stroke:#333,stroke-width:2px
```

---

> [!CAUTION]
> **LEGAL NOTICE & PRIVACY**:
> Orbix Play is a technology tool designed to provide a consolidated interface for searching and indexing content already available on the public internet. 
> - **No Hosting**: We do **not** host, store, or upload any media, files, or copyrighted material on our servers. 
> - **Source Linkage**: All content is provided via third-party services. 
> - **Internet Availability**: We merely index publicly available web data for research and convenience purposes.
> - **User Responsibility**: Usage of this software is at the user's own discretion and risk.

## Stars
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=angel7544/vega-app&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=angel7544/vega-app&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=angel7544/vega-app&type=Date" />
 </picture>
</a>
