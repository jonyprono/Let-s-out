import { networkInterfaces } from 'os'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Plugins réservés à iOS (exclus de la synchro Android).
 * - @capacitor/barcode-scanner : scanner QR natif sur iPhone (compatible Swift Package Manager).
 *   Android garde @capacitor-mlkit/barcode-scanning, qui y fonctionne déjà ; embarquer aussi ce
 *   plugin sur Android ajouterait Compose/CameraX et une 2e version de ML Kit pour rien.
 */
const IOS_ONLY_PLUGINS = ['@capacitor/barcode-scanner']

/**
 * Plugins Android = détection automatique de Capacitor (dépendances dont le package.json déclare
 * un champ `capacitor`) MOINS les plugins iOS-only. Ainsi un futur plugin reste inclus d'office.
 */
function androidPlugins(): string[] {
  const req = createRequire(__filename)
  const pkg = JSON.parse(readFileSync(req.resolve('./package.json'), 'utf8'))
  const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) })
  return deps.filter((name) => {
    if (IOS_ONLY_PLUGINS.includes(name)) return false
    try {
      return Boolean(JSON.parse(readFileSync(req.resolve(`${name}/package.json`), 'utf8')).capacitor)
    } catch {
      return false
    }
  })
}

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

// Default to production unless CAPACITOR_DEV is set to 'true'
const isProduction = process.env.CAPACITOR_DEV !== 'true' && process.env.CAPACITOR_PRODUCTION !== 'false'

const LOCAL_IP = getLocalIP()

const config: CapacitorConfig = {
  appId: 'com.fihodecorp.letsout',
  appName: "Let's Out",
  webDir: 'dist',
  android: {
    includePlugins: androidPlugins(),
  },
  server: isProduction
    ? {
        // Production: load /app directly — bypasses LandingPage entirely for native apps
        url: 'https://letsout.app/app',
        cleartext: false,
        allowNavigation: ['letsout.app', 'let-s-out-production.up.railway.app', '*.up.railway.app', 'let-s-out.onrender.com', 'let-s-out-web.vercel.app', 'localhost'],
        errorPath: 'error.html',
      }
    : {
        // Development: point to local Vite dev server for live-reload
        url: `http://${LOCAL_IP}:3000`,
        cleartext: true,
        allowNavigation: ['*'],
        errorPath: 'error.html',
      },
  plugins: {
    // Démarrage sans flash : le splash (= LaunchScreen.storyboard, fond « LaunchBackground »
    // #FFFFFF clair / #111111 sombre) reste affiché jusqu'au premier rendu de l'app, qui le masque
    // elle-même (SplashScreen.hide() dans App.tsx). launchShowDuration n'est qu'un FILET DE SÉCURITÉ
    // (page hors ligne, erreur) : en temps normal le splash est masqué bien avant.
    // Pas de backgroundColor ici : on garde la couleur dynamique (clair / sombre) du storyboard.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 10000,
      launchFadeOutDuration: 200,
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      // DEFAULT : icônes adaptées au mode clair / sombre du téléphone dès le lancement
      style: 'DEFAULT',
      // Transparent : la bande de la barre d'état laisse voir le fond natif (même couleur que l'app)
      // au lieu d'une bande blanche fixe. L'app applique ensuite la couleur exacte de chaque écran.
      backgroundColor: '#00000000',
    },
    Keyboard: {
      // 'native' lets the WKWebView handle its own resize (prevents the page
      // from sliding/jumping when the keyboard opens on iOS); scroll-to-focused-input
      // is handled natively too.
      resize: 'native',
      resizeOnFullScreen: true,
    },
    // Disabled: CapacitorHttp reroutes all axios requests through the native HTTP
    // bridge, which has well-documented bugs on iOS (header/response-shape handling)
    // causing list endpoints (events, conversations) to silently come back empty
    // while simple auth calls still work. Disabling it makes the WKWebView use its
    // standard fetch/XHR — exactly like the web and Android builds — and is safe
    // here because the app's own backend CORS config already explicitly allows the
    // https://letsout.app origin this WebView loads from (server.url below).
    CapacitorHttp: {
      enabled: false,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["phone", "google.com"],
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config
