import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 min — data is "fresh" for 2 min
      gcTime: 1000 * 60 * 60 * 24,    // 24 hours in memory (allows cache to persist)
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors or not found
        if ([401, 403, 404].includes(error?.response?.status)) return false
        // Don't retry if offline — fail fast so cached data is shown
        if (!navigator.onLine) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      // When reconnecting, automatically refetch stale queries
      refetchOnReconnect: 'always',
      // offlineFirst: use cache when offline, try network when online
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
})

// ── Simple localStorage query cache persistence ────────────────────────────
// Saves/restores query cache to localStorage so data survives app restarts.
// Skips auth/chat queries (sensitive or ephemeral).

const CACHE_KEY = 'LETSOUT_QUERY_CACHE_V1'
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 // 24 hours

const skipCacheKeys = ['auth', 'notifications', 'conversations', 'chat', 'wallet']
const shouldPersist = (keyStr: string) => !skipCacheKeys.some(k => keyStr.includes(k))

/**
 * Listes paginées (useInfiniteQuery) : on ne persiste que la 1re page. Elle suffit
 * pour un affichage instantané au redémarrage et évite de sérialiser tout le fil
 * déjà parcouru (la cause principale des sauvegardes lourdes).
 */
function trimInfiniteData(data: unknown): unknown {
  const d = data as { pages?: unknown[]; pageParams?: unknown[] } | null
  if (d && Array.isArray(d.pages) && Array.isArray(d.pageParams) && d.pages.length > 1) {
    return { pages: d.pages.slice(0, 1), pageParams: d.pageParams.slice(0, 1) }
  }
  return data
}

/** Save current query cache to localStorage (called on query success) */
export function saveQueryCache() {
  try {
    const dehydrated = queryClient.getQueryCache().getAll()
      .filter(q => {
        const keyStr = q.queryKey.join(',').toLowerCase()
        return q.state.status === 'success' && shouldPersist(keyStr)
      })
      .map(q => ({
        queryKey: q.queryKey,
        data: trimInfiniteData(q.state.data),
        dataUpdatedAt: q.state.dataUpdatedAt,
      }))

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      queries: dehydrated,
    }))
  } catch {
    // Ignore storage errors (quota exceeded etc.)
  }
}

/** Restore query cache from localStorage on app start */
export function restoreQueryCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return

    const { timestamp, queries } = JSON.parse(raw)
    if (!timestamp || Date.now() - timestamp > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY)
      return
    }

    for (const { queryKey, data, dataUpdatedAt } of queries) {
      // Guard: skip any cached entry that looks like an error object
      // (e.g. axios error { code, message } or API error { error })
      // Rendering these directly would cause React error #31
      if (
        data === null ||
        data === undefined ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        // Allow plain data objects but block known error shapes
        !('code' in data && 'message' in data) &&
        !('error' in data && Object.keys(data).length === 1)
      ) {
        queryClient.setQueryData(queryKey, data, { updatedAt: dataUpdatedAt })
      }
    }
  } catch {
    // Ignore parse errors — nuke the cache to prevent boot crashes
    localStorage.removeItem(CACHE_KEY)
  }
}

// ── Auto-save subscriber ───────────────────────────────────────────────────
// La sérialisation + localStorage.setItem sont synchrones : lancées pendant un
// défilement, elles provoquaient des micro-gels. On sauvegarde donc :
//  - après une période calme (SAVE_DEBOUNCE_MS sans nouvelle requête réussie),
//  - pendant un moment d'inactivité du navigateur (requestIdleCallback si dispo),
//  - et immédiatement quand l'app passe en arrière-plan (rien n'est perdu).
const SAVE_DEBOUNCE_MS = 5000
const IDLE_TIMEOUT_MS = 3000
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }

function flushIfDirty() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (!dirty) return
  dirty = false
  saveQueryCache()
}

function scheduleSave() {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const w = window as IdleWindow
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(flushIfDirty, { timeout: IDLE_TIMEOUT_MS })
    else flushIfDirty()
  }, SAVE_DEBOUNCE_MS)
}

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'success') scheduleSave()
})

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushIfDirty() })
  window.addEventListener('pagehide', flushIfDirty)
}
