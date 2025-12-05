import type { CapacitorConfig } from '@capacitor/cli';

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
      enabled: true
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '109118119734-73sv2hb5cjnqdifvgar84t27et1bvvid.apps.googleusercontent.com',
      clientId: '109118119734-73sv2hb5cjnqdifvgar84t27et1bvvid.apps.googleusercontent.com',
      iosClientId: '109118119734-a1ruf512sojeho0vkgrkjmutp2v2j03g.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  }
};

export default config;
