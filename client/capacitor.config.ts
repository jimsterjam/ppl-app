import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pushpulllegs.com',
  appName: 'pushpulllegs',
  webDir: 'dist',
  server: {
    url: 'http://localhost:5173',
    cleartext: true
  },
  ios: {
    scheme: 'com.pushpulllegs.com',
    allowsLinkPreview: false
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
