import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/index.css'
import 'leaflet/dist/leaflet.css'
import '@/lib/i18n'
import { restoreQueryCache } from '@/lib/query-client'

// Restore cached query data from localStorage before first render
// This ensures offline users see their last-known data immediately
restoreQueryCache()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)