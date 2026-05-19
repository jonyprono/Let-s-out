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

// Set CAPACITOR_PRODUCTION=true when building the production APK
const isProduction = process.env.CAPACITOR_PRODUCTION === 'true'

const LOCAL_IP = getLocalIP()

const config: CapacitorConfig = {
  appId: 'com.letsout.app',
  appName: 'Lets Out',
  webDir: 'dist',
  server: isProduction
    ? {
        // Production: load the live Vercel web app
        url: 'https://let-s-out-web.vercel.app',
        cleartext: false,
        allowNavigation: ['let-s-out.onrender.com', 'let-s-out-web.vercel.app'],
      }
    : {
        // Development: point to local Vite dev server for live-reload
        url: `http://${LOCAL_IP}:3000`,
        cleartext: true,
        allowNavigation: ['*'],
        errorPath: 'error.html',
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
