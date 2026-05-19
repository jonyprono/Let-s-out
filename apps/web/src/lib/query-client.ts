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

const skipCacheKeys = ['auth', 'notifications', 'conversations', 'chat']
const shouldPersist = (key: string) => !skipCacheKeys.some(k => key.toLowerCase().includes(k))

/** Save current query cache to localStorage (called on query success) */
export function saveQueryCache() {
  try {
    const dehydrated = queryClient.getQueryCache().getAll()
      .filter(q => {
        const key = String(q.queryKey[0])
        return q.state.status === 'success' && shouldPersist(key)
      })
      .map(q => ({
        queryKey: q.queryKey,
        data: q.state.data,
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
// Saves cache to localStorage 2s after any successful query, throttled.
let saveTimer: ReturnType<typeof setTimeout> | null = null

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'success') {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveQueryCache()
      saveTimer = null
    }, 2000)
  }
})
