# Mmaraka Mobile App (Expo + React Native)

React Native app for Mmaraka, using the same backend API as the web frontend. Built with **Expo** for easy testing on device or simulator.

## Setup

1. **Install dependencies**

   ```bash
   cd mobile_app
   npm install
   ```

2. **Configure API URL**

   Create a `.env` file (or set in your shell):

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `EXPO_PUBLIC_API_URL`:

   - **Same machine (simulator):** `http://localhost:3000`
   - **Physical device:** use your computer’s LAN IP, e.g. `http://192.168.1.5:3000`
   - **Production:** your deployed backend URL, e.g. `https://api.mmaraka.example.com`

   Ensure the backend is running and reachable from the device/emulator (CORS is configured on the backend for API requests).

3. **Start the backend** (from `production/backend`)

   ```bash
   npm run dev
   ```

4. **Start Expo**

   ```bash
   npm start
   ```

   Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with the Expo Go app on a physical device.

## Building for distribution (EAS Build)

To build installable Android APK/AAB or iOS IPA (not just Expo Go):

1. **Install EAS CLI** (one-time)

   ```bash
   npm install -g eas-cli
   ```

2. **Log in to Expo**

   ```bash
   eas login
   ```

3. **Configure the project** (one-time, if not already linked)

   From the `mobile_app` folder:

   ```bash
   eas build:configure
   ```

   Update `app.json` → `extra.eas.projectId` with the project ID from your Expo account (or run `eas init` to create/link the project).

4. **Build**

   - **Android APK** (for direct install / testing; no Play Store):

     ```bash
     eas build --platform android --profile preview
     ```

     APK will be available in the Expo dashboard; download and share or install.

   - **Android App Bundle** (for Play Store):

     ```bash
     eas build --platform android --profile production
     ```

   - **iOS** (simulator only with default profiles; for device/TestFlight use a production profile and proper Apple setup):

     ```bash
     eas build --platform ios --profile preview
     ```

   The API URL for builds is set in `eas.json` per profile (`EXPO_PUBLIC_API_URL`, e.g. `https://api.mmaraka.com`). Change it there if you use a different backend.

5. **Submit to stores** (optional)

   ```bash
   eas submit --platform android --profile production
   eas submit --platform ios --profile production
   ```

   Configure credentials and store metadata in the Expo dashboard or via `eas credentials` / `eas submit` prompts.

## Features (ported from web)

- **Auth:** Login, sign up, forgot password, terms & conditions
- **Products:** List products from API, search, pull-to-refresh, product detail screen
- **Services:** List services, service detail placeholder
- **My Listings:** Placeholder (full add/edit can be added)
- **Messages:** Placeholder
- **Settings:** Profile summary, sign out

The app uses the same API base URL and JWT token storage (AsyncStorage) so users can log in and use the backend from the mobile app.

## Project structure

- `App.js` – Root: `AuthProvider`, auth gate, navigation (stack + bottom tabs)
- `src/api.js` – API client and `EXPO_PUBLIC_API_URL`
- `src/AuthContext.js` – Auth state, login/logout, token persistence
- `src/theme.js` – Colors (aligned with web)
- `src/screens/` – Auth, Products, Services, My Listings, Messages, Settings, Product/Service detail

## Adding more screens

To mirror more of the web app (e.g. Add Product, full Messages), add new screens under `src/screens/` and register them in `App.js` in the stack or tab navigator.
