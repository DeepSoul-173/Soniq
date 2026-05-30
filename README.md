# 🎵 Soniq — Premium Multi-Source Music Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Expo](https://img.shields.io/badge/Expo-000000?style=flat&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev/)

**Soniq** is a premium, modern music exploration and streaming platform. It offers a unified audio playback experience across mobile devices and desktops, bridging advanced multi-source APIs with state-of-the-art UI styling.

The project contains two main clients:
1. **Mobile App (`/app`)**: A cross-platform mobile client built on React Native & Expo, powered by Zustand, MMKV, and a Spotify-like deep settings system.
2. **Web App (`soniq.html`)**: A lightweight, self-contained desktop-optimized client with smart recommendation heuristics and a gorgeous glassmorphism dark-mode UI.

---

## ✨ Features

### 📱 Mobile App (React Native & Expo)
*   **Multi-Source Audio Adapters**: Seamless fallback system pulling tracks from **Piped (YouTube proxy)**, **Jamendo**, **Internet Archive (Archive.org)**, and a local catalog.
*   **Smart Recommendation Engine**: Heuristic-based engine that automatically queues up related tracks based on genre overlap, mood matching, popularity, and playback history to avoid repetition.
*   **Advanced Settings Infrastructure**: A fully realized 10-category settings schema (Audio Quality, Playback, Storage, Developer mode, etc.) powered by **Zustand** and **MMKV** for ultra-fast storage.
*   **Premium Dark UI**: Implements a curated dark mode palette with vibrant accents, a persistent mini-player overlay, and modern custom drawer navigations.

### 💻 Web Client (`soniq.html`)
*   **Zero-Dependency Design**: A single HTML file that runs instantly in any desktop browser.
*   **Smart Scoring Recommendations**: Real-time scoring using our custom recommendation algorithm.
*   **Dynamic Album Art Generator**: Deterministic SVG art generated on-the-fly for every track.
*   **Interactive Interface**: Smooth hover animations, mood filter buttons, active queue sidebar, and responsive music waveforms.

---

## 🛠️ Project Structure

```
├── app/                  # React Native / Expo mobile application
│   ├── app/              # Expo Router pages (tabs, drawer, modals)
│   ├── src/
│   │   ├── components/   # MiniPlayer, UnifiedPlayer, and UI views
│   │   ├── services/     # SearchService, Piped, Jamendo & Archive adapters
│   │   ├── store/        # Zustand state stores (MMKV local storage)
│   │   └── theme/        # Dark-mode color theme definitions
│   ├── assets/           # Splash screen, fonts, and images
│   └── package.json      # Mobile app dependencies
├── soniq.html            # Desktop Web Client (Self-contained)
├── LICENSE               # MIT License
└── README.md             # Project documentation
```

---

## 🚀 Getting Started

### Run the Mobile Client (`app/`)

1. **Navigate to the app folder and install dependencies**:
   ```bash
   cd app
   npm install
   ```

2. **Start the Expo server**:
   ```bash
   npx expo start
   ```

3. **Run on a device**:
   * Scan the QR code with your phone (using the Expo Go app).
   * Press `i` to open in iOS simulator.
   * Press `a` to open in Android emulator.

---

### Run the Web Client (`soniq.html`)

No installation required! Simply double-click [soniq.html](file:///c:/Users/abhij/Downloads/app-song/soniq.html) or run it using any static file server:

```bash
# Example using Python's built-in server
python -m http.server 8000
```
Then visit `http://localhost:8000/soniq.html` in your browser.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](file://LICENSE) file for details.
