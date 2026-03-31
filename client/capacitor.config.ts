import type { CapacitorConfig } from '@capacitor/cli';

// Load .env so Capacitor CLI can pick up VITE_* variables when running outside Vite
import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

const config: CapacitorConfig = {
  appId: 'com.pushpulllegs.com',
  appName: 'pushpulllegs',
  webDir: 'dist',
  // server: {
  //   url: 'http://localhost:3001',
  //   cleartext: true
  // },
  ios: {
    scheme: 'com.pushpulllegs.com',
    allowsLinkPreview: false,
    loggingBehavior: 'debug', // oder 'production'
  },
  plugins: {
    CapacitorHttp: {
      enabled: String(process.env.VITE_CAP_HTTP_ENABLED || 'false').toLowerCase() === 'true'
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // Prefer explicit VITE_* env vars from client/.env
      serverClientId: process.env.VITE_GOOGLE_SERVER_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_WEB_CLIENT_ID,
      clientId: process.env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.VITE_IOS_CLIENT_ID || process.env.VITE_GOOGLE_IOS_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
      forceCodeForRefreshToken: true,
    },
  }
};

export default config;
