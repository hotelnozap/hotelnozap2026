import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hoteldozap.app',
  appName: 'Hotel do Zap',
  webDir: 'dist',
  server: {
    url: 'https://hotelnozap.com.br',
    cleartext: false
  },
  android: {
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;
