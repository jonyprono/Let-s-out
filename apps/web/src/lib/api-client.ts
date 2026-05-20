import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { isOnline } from '@/lib/offline'

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
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('172.30.') && !envUrl.includes('192.168.')) {
    // If a production API URL is explicitly configured in env, use it
    return envUrl
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin
    // If running on Vercel or production domain, point to the live Render backend
    if (origin.includes('vercel.app') || origin.includes('let-s-out-web')) {
      return 'https://let-s-out.onrender.com/api/v1'
    }
    if (origin.includes(':3000')) {
      return origin.replace(':3000', ':3001') + '/api/v1'
    }
    // If running in Capacitor native platform in production build, point to Render
    const isCap = () => {
      try { return !!(window as any).Capacitor?.isNativePlatform?.() } catch { return false }
    }
    if (isCap() && process.env.NODE_ENV === 'production') {
      return 'https://let-s-out.onrender.com/api/v1'
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
  // On web browser, keep a snappy 10s timeout
  timeout: isCapacitor() ? 60000 : 10000,
})

// ── Request interceptor ───────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  // Let the browser handle FormData boundary automatically
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  } else if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
    // Force an empty object for POST/PUT/PATCH so Axios and CapacitorHttp don't drop Content-Type
    config.data = config.data || {}
    config.headers['Content-Type'] = 'application/json'
  }

  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`

  // For Capacitor mobile, send refreshToken in body if it's a refresh request
  if (isCapacitor() && config.url?.includes('/auth/refresh')) {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken && config.data === undefined) {
      config.data = { refreshToken }
    }
  }

  return config
})

// ── Response interceptor ─────────────────────────────────────────────────────

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

// Track if we've already shown the offline toast to avoid spamming
let offlineToastShown = false
window.addEventListener('online', () => { offlineToastShown = false })

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

// Endpoints that should NOT trigger the network error toast
const silentEndpoints = ['/notifications', '/auth/me', '/auth/refresh']
const isSilent = (url?: string) => silentEndpoints.some(e => url?.includes(e))

// Auth endpoints that should NOT trigger 401 refresh logic
const authEndpoints = ['/auth/login', '/auth/register', '/auth/check-', '/auth/verify-', '/auth/send-']
const isAuthEndpoint = (url?: string) => authEndpoints.some(e => url?.includes(e))

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // ── 401: try to refresh token ──────────────────────────────────────────
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint(original.url)) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return apiClient(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        // Always send refreshToken in body (works for cross-origin web + Capacitor)
        // Also relies on cookie as fallback if body token is missing
        const storedRefreshToken = useAuthStore.getState().refreshToken
        const body = storedRefreshToken ? { refreshToken: storedRefreshToken } : {}
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          body,
          { withCredentials: true },
        )
        const { accessToken, refreshToken } = data
        useAuthStore.getState().setAccessToken(accessToken)
        if (refreshToken) useAuthStore.getState().setRefreshToken(refreshToken)
        processQueue(null, accessToken)
        original.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(original)
      } catch (err) {
        processQueue(err, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    // ── 5xx server errors ──────────────────────────────────────────────────
    if (error.response?.status >= 500 && !isSilent(original.url)) {
      toast.error('Erreur serveur. Veuillez réessayer plus tard.')
    }

    // ── Network error / timeout ────────────────────────────────────────────
    const isNetworkError = !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ERR_CANCELED'
    )

    if (isNetworkError && !isSilent(original.url)) {
      if (!isOnline()) {
        // Device is truly offline — show once, not on every background request
        if (!offlineToastShown) {
          offlineToastShown = true
          toast.warning('Vous êtes hors ligne. Les données affichées peuvent ne pas être à jour.', {
            duration: 4000,
            id: 'offline-toast', // Prevent duplicates
          })
        }
      } else {
        // Online but can't reach the server (wrong IP, server down, etc.)
        toast.error('Serveur inaccessible. Vérifiez que le serveur est démarré.', {
          duration: 5000,
          id: 'server-error-toast',
        })
      }
    }

    return Promise.reject(error)
  },
)
