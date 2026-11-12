import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { getDebugLog, subscribeDebugLog, clearDebugLog, type DebugLogEntry } from '@/lib/debugLog'

// Hidden diagnostic overlay — toggled by 5 taps on "Version de l'app" in Settings
// (see useDebugPanel below). Shows every API request made by the app: URL, HTTP
// status, error message and the first 200 chars of the response body. Purely
// local/in-memory — nothing is sent anywhere, this is only so a real device can
// show us the actual cause of a bug instead of us guessing.

let setOpenExternal: ((open: boolean) => void) | null = null

export function openDebugPanel() {
  setOpenExternal?.(true)
}

function statusColor(status: DebugLogEntry['status']): string {
  if (status === 'PENDING') return 'text-gray-400'
  if (status === 'ERROR') return 'text-red-500'
  if (typeof status === 'number' && status >= 400) return 'text-red-500'
  if (typeof status === 'number' && status >= 200 && status < 300) return 'text-green-500'
  return 'text-amber-500'
}

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<DebugLogEntry[]>([])

  useEffect(() => {
    setOpenExternal = setOpen
    return () => { setOpenExternal = null }
  }, [])

  useEffect(() => {
    if (!open) return
    setEntries(getDebugLog())
    return subscribeDebugLog(setEntries)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 text-white overflow-y-auto font-mono text-[11px]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="sticky top-0 bg-black/95 flex items-center justify-between px-3 py-2 border-b border-white/20">
        <span className="font-sans font-semibold text-sm">Debug réseau ({entries.length})</span>
        <div className="flex items-center gap-3">
          <button onClick={clearDebugLog} aria-label="Effacer">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {entries.length === 0 && <p className="font-sans text-gray-400">Aucune requête enregistrée encore.</p>}
        {entries.map((e) => (
          <div key={e.id} className="border border-white/10 rounded-lg p-2 break-all">
            <div className="flex items-center justify-between">
              <span>{e.method} {e.url}</span>
              <span className={statusColor(e.status)}>{e.status}</span>
            </div>
            <div className="text-gray-500">{e.timestamp}</div>
            {e.message && <div className="text-red-400 mt-1">{e.message}</div>}
            {e.bodyPreview && <div className="text-gray-300 mt-1">{e.bodyPreview}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
