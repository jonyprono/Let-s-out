import { networkInterfaces } from 'os'
import type { CapacitorConfig } from '@capacitor/cli'

function getLocalIP() {
  const interfaces = networkInterfaces()
  const preferredNames = ['wi-fi', 'wlan', 'wireless', 'eth', 'en0', 'en1']

  const candidates = Object.entries(interfaces)
    .flatMap(([name, addresses]) =>
      (addresses || [])
        .filter((addr) => addr.family === 'IPv4' && !addr.internal)
        .map((addr) => ({ ...addr, name }))
    )

  const preferred = candidates.find((addr) =>
    preferredNames.some((name) => addr.name?.toLowerCase().includes(name))
  )
  if (preferred?.address) return preferred.address

  const privateAddr = candidates.find((addr) =>
    ['192.168.', '10.', '172.16.'].some((prefix) => addr.address.startsWith(prefix))
  )
  if (privateAddr?.address) return privateAddr.address

  return candidates[0]?.address || 'localhost'
}

// Local IP for development - update this if your IP changes (run: pnpm setup-network)
const LOCAL_IP = getLocalIP();

const config: CapacitorConfig = {
  appId: 'com.letsout.app',
  appName: 'Lets Out',
  webDir: 'dist',
  server: {
    // Point the native app to the Vite dev server on your local network
    // This allows live-reload and avoids needing to rebuild after every change
    url: `http://${LOCAL_IP}:3000`,
    cleartext: true, // Allow HTTP for local network development
    allowNavigation: ['*'], // Allow all network requests
    errorPath: 'error.html', // Fallback UI for network errors
  },
  plugins: {
    // Configure SplashScreen
    SplashScreen: {
      launchShowDuration: 0,
    },
    // Status bar overlays the WebView for edge-to-edge display
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
    // Allow HTTP requests (important for local network)
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
