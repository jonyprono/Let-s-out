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

// Restore cached query data from localStorage before first render
// This ensures offline users see their last-known data immediately
restoreQueryCache()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)