import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/index.css'
import 'leaflet/dist/leaflet.css'
import '@/lib/i18n'
import { restoreQueryCache } from '@/lib/query-client'

// Polyfill for crypto.randomUUID (required for HTTP testing on mobile/LAN)
if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
  window.crypto.randomUUID = function() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
    ) as any;
  };
}

import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { initOneSignal } from '@/lib/onesignal'

// Notifications push OneSignal (app native uniquement ; no-op sur le web).
// Non bloquant et isolé : quoi qu'il arrive, le rendu React ci-dessous s'exécute.
try {
  initOneSignal().catch((e) => console.warn('[OneSignal] init error caught:', e))
} catch (e) {
  console.warn('[OneSignal] sync error caught:', e)
}

// Restore cached query data from localStorage before first render
// This ensures offline users see their last-known data immediately
restoreQueryCache()

// Automatically reload the page when Vite fails to fetch a dynamic chunk
// (e.g. after a Vercel deployment where old chunks are deleted)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const reloaded = sessionStorage.getItem('vite-chunk-reload')
  if (!reloaded) {
    sessionStorage.setItem('vite-chunk-reload', 'true')
    window.location.reload()
  }
})

// Développement : alerte console si un élément dépasse la largeur de l'écran (absent du build prod)
if (import.meta.env.DEV) {
  import('@/lib/dev-overflow-check').then((m) => m.startDevOverflowCheck()).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)