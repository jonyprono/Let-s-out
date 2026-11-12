// Lightweight in-memory request log used by the hidden debug panel (5 taps on
// "Version de l'app" in Settings). Not persisted, not sent anywhere — purely
// local so a user can show us the real HTTP status/error/response on their phone.

export interface DebugLogEntry {
  id: number
  timestamp: string
  method: string
  url: string
  status: number | 'ERROR' | 'PENDING'
  message?: string
  bodyPreview?: string
}

const MAX_ENTRIES = 80
let entries: DebugLogEntry[] = []
let nextId = 1
const listeners = new Set<(entries: DebugLogEntry[]) => void>()

function notify() {
  listeners.forEach((l) => l(entries))
}

function preview(data: unknown): string {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data)
    return (str || '').slice(0, 200)
  } catch {
    return '(unserializable response)'
  }
}

export function logRequest(method: string, url: string): number {
  const id = nextId++
  entries = [{ id, timestamp: new Date().toISOString(), method, url, status: 'PENDING' as const }, ...entries].slice(0, MAX_ENTRIES)
  notify()
  return id
}

export function logResponse(id: number, status: number, data: unknown) {
  entries = entries.map((e) => (e.id === id ? { ...e, status, bodyPreview: preview(data) } : e))
  notify()
}

export function logError(id: number, status: number | 'ERROR', message: string, data?: unknown) {
  entries = entries.map((e) => (e.id === id ? { ...e, status, message, bodyPreview: data !== undefined ? preview(data) : undefined } : e))
  notify()
}

export function getDebugLog(): DebugLogEntry[] {
  return entries
}

export function clearDebugLog() {
  entries = []
  notify()
}

export function subscribeDebugLog(listener: (entries: DebugLogEntry[]) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
