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
    scheme: 'com.pushpulllegs.com'
  }
};

export default config;
