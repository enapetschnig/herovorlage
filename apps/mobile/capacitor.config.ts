import type { CapacitorConfig } from "@capacitor/cli";

/**
 * HeatFlow mobile shell.
 *
 * In dev: app loads from the Next.js dev server (livereload, set via --external).
 * In prod: build a static export of /portal-routes only OR point at the deployed URL.
 *
 * iOS App Transport Security: see ios/App/App/Info.plist — for HTTP dev URL we
 * whitelist the dev host. Production runs over HTTPS.
 */
const config: CapacitorConfig = {
  appId: "at.epower.heatflow",
  appName: "HeatFlow",
  // Dev: livereload from Next.js. The actual URL is overridden by `cap run --external`.
  // Prod: replace with deployed URL (e.g. https://app.heatflow.at) after first deploy.
  server: {
    url: process.env.HEATFLOW_MOBILE_URL ?? "http://localhost:3000",
    cleartext: process.env.NODE_ENV !== "production",
    iosScheme: "heatflow",
  },
  webDir: "www",
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#1e6fff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: "#1e6fff",
      style: "DARK",
    },
    Keyboard: {
      resize: "body",
    },
    Camera: {
      // iOS requires a usage description in Info.plist, see ios/App/App/Info.plist additions below
    },
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: process.env.NODE_ENV !== "production",
  },
};

export default config;
