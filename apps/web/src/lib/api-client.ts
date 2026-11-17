import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { isOnline } from '@/lib/offline'
import { logRequest, logResponse, logError } from '@/lib/debugLog'

// Detect if running in Capacitor (native mobile)
const isCapacitor = () => {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

const resolveApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (
    envUrl &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1') &&
    !envUrl.includes('172.30.') &&
    !envUrl.includes('192.168.') &&
    !envUrl.includes('onrender.com')
  ) {
    // If a production API URL is explicitly configured in env, use it
    return envUrl
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin
    // If running on any production domain, point to the live Railway backend
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('192.168.')) {
      return 'https://let-s-out-production.up.railway.app/api/v1'
    }
    if (origin.includes(':3000')) {
      return origin.replace(':3000', ':3001') + '/api/v1'
    }
    // If running in Capacitor native platform, point to Railway backend
    const isCap = () => {
      try { return !!(window as any).Capacitor?.isNativePlatform?.() } catch { return false }
    }
    if (isCap()) {
      return 'https://let-s-out-production.up.railway.app/api/v1'
    }
    return `${origin}/api/v1`
  }

  return envUrl || 'http://localhost:3001/api/v1'
}

export const apiClient = axios.create({
  baseURL: resolveApiUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // On mobile (Capacitor), allow more time for Render free-tier cold starts (~50s)
  // On web browser, allow 45s for Render free-tier cold starts
  timeout: isCapacitor() ? 90000 : 45000,
})

// ── Renouvellement du jeton d'accès (partagé) ─────────────────────────────────
//
// Le jeton d'accès dure 15 min (JWT_EXPIRES_IN). Avant : à l'ouverture de l'app après une pause,
// TOUTES les requêtes partaient avec un jeton périmé → 401 → renouvellement → renvoi, soit
// 3 allers-retours avant le premier affichage (+ un 2e renouvellement si un 401 arrivait en retard).
// Maintenant : (A) le jeton est renouvelé AVANT l'envoi s'il expire dans moins de
// TOKEN_REFRESH_MARGIN_MS, et (B) un seul renouvellement à la fois, partagé par tous les appels.

/** Renouvellement anticipé si le jeton expire dans moins de 30 s (horloges client/serveur décalées) */
const TOKEN_REFRESH_MARGIN_MS = 30_000

// Auth endpoints that should NOT trigger refresh logic (proactive or after a 401)
const authEndpoints = ['/auth/login', '/auth/register', '/auth/check-', '/auth/verify-', '/auth/send-', '/auth/logout', '/auth/refresh']
const isAuthEndpoint = (url?: string) => authEndpoints.some(e => url?.includes(e))

/** Millisecondes avant expiration, lues dans le jeton (champ `exp`) — sans appel réseau. null = illisible. */
function msBeforeExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')))
    return typeof json.exp === 'number' ? json.exp * 1000 - Date.now() : null
  } catch {
    return null
  }
}

const isNetworkOrServerError = (err: any) => {
  const isNetworkError = !err?.response && (
    err?.message === 'Network Error' ||
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ERR_NETWORK' ||
    err?.code === 'ERR_CANCELED'
  )
  return isNetworkError || err?.response?.status >= 500
}

async function doRefresh(): Promise<string> {
  // Always send refreshToken in body (works for cross-origin web + Capacitor)
  // Also relies on cookie as fallback if body token is missing
  const storedRefreshToken = useAuthStore.getState().refreshToken
  const body = storedRefreshToken ? { refreshToken: storedRefreshToken } : {}

  // For admin sessions, the refresh token is a dummy string.
  // We include the expired access token in the Authorization header so the
  // backend can decode it (without verifying expiry) to identify the admin.
  const refreshHeaders: Record<string, string> = {}
  if (storedRefreshToken === 'admin_no_refresh_token_needed') {
    const expiredToken = useAuthStore.getState().accessToken
    if (expiredToken) {
      refreshHeaders['Authorization'] = `Bearer ${expiredToken}`
    }
  }

  try {
    // axios brut (pas apiClient) : le renouvellement ne repasse pas par ces intercepteurs
    const { data } = await axios.post(
      `${resolveApiUrl()}/auth/refresh`,
      body,
      { withCredentials: true, headers: refreshHeaders },
    )
    const { accessToken, refreshToken } = data
    useAuthStore.getState().setAccessToken(accessToken)
    if (refreshToken) useAuthStore.getState().setRefreshToken(refreshToken)
    return accessToken
  } catch (err: any) {
    // If the refresh failed simply due to a network drop or a server error (500), DO NOT log the user out!
    if (!isNetworkOrServerError(err)) {
      // Session vraiment invalide : déconnexion (comportement inchangé)
      const wasAdmin = useAuthStore.getState().user?.role === 'ADMIN'
      useAuthStore.getState().logout()
      if (!useAuthStore.getState().isLoggingOut) {
        window.location.href = wasAdmin ? '/admin/login' : '/welcome'
      }
    }
    throw err
  }
}

let refreshPromise: Promise<string> | null = null

/** Un seul renouvellement à la fois : tous les appels concurrents attendent le même. */
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// ── Request interceptor ───────────────────────────────────────────────────────

apiClient.interceptors.request.use(async (config) => {
  // Let the browser handle FormData boundary automatically
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
    // File uploads can be slow on Render — give them 3 minutes
    config.timeout = 180000
  } else if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
    // Force an empty object for POST/PUT/PATCH so Axios and CapacitorHttp don't drop Content-Type
    config.data = config.data || {}
    config.headers['Content-Type'] = 'application/json'
  }

  let token = useAuthStore.getState().accessToken
  // (A) Jeton expiré ou sur le point de l'être : renouvelé AVANT l'envoi (plus de cascade 401 → renvoi).
  // En cas d'échec réseau, on envoie quand même avec l'ancien jeton (le filet 401 ci-dessous prend le relais).
  if (token && !isAuthEndpoint(config.url) && !useAuthStore.getState().isLoggingOut) {
    const remaining = msBeforeExpiry(token)
    if (remaining !== null && remaining < TOKEN_REFRESH_MARGIN_MS) {
      token = await refreshAccessToken().catch(() => useAuthStore.getState().accessToken)
      // Session invalide : doRefresh a déconnecté et redirige → inutile d'envoyer la requête
      if (!token) throw new axios.CanceledError('Session expirée')
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`

  // For Capacitor mobile, send refreshToken in body if it's a refresh request
  if (isCapacitor() && config.url?.includes('/auth/refresh')) {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken && config.data === undefined) {
      config.data = { refreshToken }
    }
  }

  ;(config as any).__debugId = logRequest((config.method || 'get').toUpperCase(), `${config.baseURL ?? ''}${config.url ?? ''}`)

  return config
})

// ── Response interceptor ─────────────────────────────────────────────────────

// Track if we've already shown the offline toast to avoid spamming
let offlineToastShown = false
window.addEventListener('online', () => { offlineToastShown = false })

// Endpoints that should NOT trigger the network error toast
const silentEndpoints = ['/notifications', '/auth/me', '/auth/refresh', '/chat/admin']
const isSilent = (url?: string) => silentEndpoints.some(e => url?.includes(e))

apiClient.interceptors.response.use(
  (res) => {
    const debugId = (res.config as any).__debugId
    if (debugId) logResponse(debugId, res.status, res.data)
    return res
  },
  async (error) => {
    // ── Debug log: record every failed request for the hidden debug panel ──
    const debugId = (error?.config as any)?.__debugId
    if (debugId) {
      const status = error?.response?.status ?? 'ERROR'
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || String(error)
      logError(debugId, status, message, error?.response?.data)
    }

    // ── Guard: raw browser event (e.g. ProgressEvent from XHR onerror on Capacitor) ──
    const isProgressEvent =
      !error ||
      !(error instanceof Error) ||
      String(error).includes('ProgressEvent') ||
      String(error?.message).includes('ProgressEvent')

    if (isProgressEvent && !error?.response) {
      const wrapped = new Error('Erreur de connexion au serveur. Vérifiez votre connexion.')
      ;(wrapped as any).code = 'ERR_NETWORK'
      ;(wrapped as any).isNetworkError = true
      return Promise.reject(wrapped)
    }

    const original = error.config

    // ── 401: filet de sécurité (jeton révoqué, horloge du téléphone décalée…) ──
    // (B) Même renouvellement PARTAGÉ que l'envoi anticipé : plusieurs 401 simultanés ou tardifs
    // n'en déclenchent qu'un seul. Chaque requête n'est renvoyée qu'une fois (_retry).
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint(original.url)) {
      const authState = useAuthStore.getState()
      // Ne pas rétablir la session après une déconnexion volontaire
      if (authState.isLoggingOut || !authState.accessToken) {
        return Promise.reject(error)
      }

      original._retry = true
      // Un autre appel a peut-être déjà obtenu un nouveau jeton pendant que celui-ci était en vol
      const sentToken = String(original.headers?.Authorization ?? '').replace(/^Bearer /, '')
      const currentToken = useAuthStore.getState().accessToken
      try {
        const token = currentToken && currentToken !== sentToken ? currentToken : await refreshAccessToken()
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      } catch (err) {
        // Déconnexion éventuelle déjà gérée dans doRefresh (sauf coupure réseau / erreur 500)
        return Promise.reject(err)
      }
    }

    // ── 403: Forbidden (e.g. Account Banned) ──────────────────────────────
    if (error.response?.status === 403 && error.response.data?.message?.includes('suspendu')) {
      const wasAdmin = useAuthStore.getState().user?.role === 'ADMIN'
      useAuthStore.getState().logout()
      toast.error('Votre compte a été suspendu par un administrateur.')
      window.location.href = wasAdmin ? '/admin/login' : '/login'
      return Promise.reject(error)
    }

    // ── 5xx server errors ──────────────────────────────────────────────────
    if (error.response?.status >= 500 && !isSilent(original.url)) {
      toast.error('Erreur serveur. Veuillez réessayer plus tard.')
    }

    // ── Network error / timeout ────────────────────────────────────────────
    // Fix for Capacitor/Axios edge case where XHR onerror throws raw ProgressEvent
    if (String(error).includes('ProgressEvent') || String(error.message).includes('ProgressEvent')) {
      error.message = 'Network Error';
      error.code = 'ERR_NETWORK';
    }

    const isNetworkError = !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ERR_CANCELED'
    )

    if (isNetworkError && !isSilent(original.url)) {
      const isGet = original.method?.toLowerCase() === 'get'

      if (!isOnline()) {
        // Device is truly offline — show once, not on every background request
        if (!offlineToastShown && !isGet) {
          offlineToastShown = true
          toast.warning('Vous êtes hors ligne. Les données affichées peuvent ne pas être à jour.', {
            duration: 4000,
            id: 'offline-toast', // Prevent duplicates
          })
        }
      } else {
        // Online but can't reach the server (wrong IP, server down, cold start etc.)
        // Only show for explicit user actions (POST/PUT/DELETE), not for background GET fetches
        if (!isGet) {
          toast.error('Erreur de connexion au serveur. Vérifiez votre connexion.', {
            duration: 4000,
            id: 'server-error-toast',
          })
        }
      }
    }

    return Promise.reject(error)
  },
)
