# @heatflow/mobile

Capacitor 6 wrapper for the HeatFlow web app. Wraps the existing Next.js app
as a native iOS / Android shell with access to camera, file picker, push
notifications, and offline cache.

## Strategy

In dev, the mobile shell **livereloads from your local Next.js dev server**
(`apps/web` on `:3000`). No separate web build needed — every change to the
Next.js code shows up in the simulator immediately.

In prod, the shell loads the **deployed URL** (e.g. `https://app.heatflow.at`).
This is the simplest path; if/when offline-first is needed later, we move to a
PWA-style cache or migrate critical screens to React Native (per CLAUDE.md F.7).

## First-time setup

```bash
# 1) Install deps (only once)
pnpm --filter @heatflow/mobile install

# 2) Add native projects (creates ios/ and android/ folders inside apps/mobile/)
#    Requires:
#    - macOS + Xcode 15+ for iOS
#    - Android Studio + JDK 17+ + Android SDK for Android
pnpm --filter @heatflow/mobile init:ios
pnpm --filter @heatflow/mobile init:android

# 3) Set the dev-server URL Capacitor should load
#    Use your machine's LAN IP so the simulator/device can reach it
export HEATFLOW_MOBILE_URL="http://192.168.0.10:3000"

# 4) Start the Next.js dev server (in apps/web)
pnpm --filter @heatflow/web dev
```

## Run on a device / simulator

```bash
# iOS simulator
pnpm --filter @heatflow/mobile run:ios

# Android emulator
pnpm --filter @heatflow/mobile run:android
```

## After making changes to Capacitor plugins or capacitor.config.ts

```bash
pnpm --filter @heatflow/mobile sync
```

## Production build

1. Deploy the Next.js app (Vercel / Hetzner / Coolify)
2. Set `HEATFLOW_MOBILE_URL=https://app.heatflow.at` in your build environment
3. `cap sync` to update native projects with the new URL
4. `cap open ios` / `cap open android` and archive/release as usual

## Plugins included

- **@capacitor/camera** — for photo capture in FlowAI Foto→Angebot
- **@capacitor/filesystem** — for offline file cache
- **@capacitor/preferences** — for token storage (in addition to cookies)
- **@capacitor/status-bar** — themed status bar matching primary color
- **@capacitor/keyboard** — proper keyboard handling
- **@capacitor/splash-screen** — branded splash

## Required Info.plist additions (iOS)

After `cap add ios`, edit `ios/App/App/Info.plist` and add:

```xml
<key>NSCameraUsageDescription</key>
<string>HeatFlow benötigt Kamera-Zugriff für die Foto-zu-Angebot-Funktion (FlowAI).</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>HeatFlow benötigt Foto-Zugriff für Projekt- und Beleg-Uploads.</string>
<key>NSMicrophoneUsageDescription</key>
<string>HeatFlow benötigt Mikrofon-Zugriff für Sprach-zu-Projekt (kommt später).</string>
```

## Required AndroidManifest.xml additions

After `cap add android`, ensure `android/app/src/main/AndroidManifest.xml` contains:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```
