import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pplapp.mobile',
  appName: 'PPL App',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // Für Live-Reload im Simulator kannst du temporär eine Dev-URL setzen:
    // url: 'http://localhost:5173',
    // cleartext: true,
  }
}

export default config
