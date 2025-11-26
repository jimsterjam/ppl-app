import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pushpulllegs.com',
  appName: 'pushpulllegs',
  webDir: 'dist',
  server: {
    url: 'http://localhost:3001',
    cleartext: true
  },
  ios: {
    scheme: 'com.pushpulllegs.com',
    allowsLinkPreview: false
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '440924652132-h60bcdrh3nu22nf72pagohfgg7cslq8r.apps.googleusercontent.com',
      clientId: '440924652132-h60bcdrh3nu22nf72pagohfgg7cslq8r.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  }
};

export default config;
