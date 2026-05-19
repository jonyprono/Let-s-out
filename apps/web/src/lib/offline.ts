/**
 * Offline detection utility for Capacitor mobile apps.
 * Uses navigator.onLine as the primary signal, with event listeners for changes.
 */

type Listener = (online: boolean) => void
const listeners: Listener[] = []

export function isOnline(): boolean {
  return navigator.onLine
}

export function onConnectivityChange(fn: Listener): () => void {
  listeners.push(fn)
  const handleOnline = () => listeners.forEach(l => l(true))
  const handleOffline = () => listeners.forEach(l => l(false))
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    const idx = listeners.indexOf(fn)
    if (idx > -1) listeners.splice(idx, 1)
  }
}
