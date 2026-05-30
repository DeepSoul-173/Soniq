# Soniq - Premium React Native Music App

Soniq is a professional-grade mobile music application built with React Native and Expo. It features a robust multi-source adapter architecture, a unified playback engine, and a massive persistent settings system.

## Features
- **Multi-Source Adapters**: Uses Piped as the primary search and streaming backend, with Jamendo, Internet Archive, and a local demo catalog as fallbacks.
- **Unified Playback Engine**: Plays direct audio stream URLs through `expo-audio`.
- **Deep Settings Architecture**: A 10-category settings system utilizing Zustand and MMKV, designed to mimic the depth of commercial apps like Spotify.
- **Recommendation Engine**: Heuristic-based smart recommendations to automatically populate the queue.
- **Premium UI**: Dark-themed, dynamic UI with smooth transitions and persistent mini-player overlay.

## Installation & Running

1. **Install Dependencies**
   ```bash
   cd app
   npm install
   ```

2. **Run the App**
   ```bash
   npx expo start
   ```
   Press `a` to run on Android emulator, or `i` for iOS simulator.

## Settings System Notes
Due to the constraints of the Expo Go environment and general OS limitations, some settings (like system-wide Equalizer or Gapless Playback for external WebViews) are purely architectural in this implementation. However, the state is persisted and securely managed, proving the production-ready structure.
