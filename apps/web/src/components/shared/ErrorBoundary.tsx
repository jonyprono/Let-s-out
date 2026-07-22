import { Component, ErrorInfo, ReactNode } from 'react'
import { OfflineScreen } from './OfflineScreen'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  isNetworkError: boolean
  attemptCount: number
  error?: Error | null
}

const IS_DEV = import.meta.env.DEV

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isNetworkError: false,
    attemptCount: 0,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const isNetwork =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      !navigator.onLine

    return { hasError: true, isNetworkError: isNetwork, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (IS_DEV) {
      console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
    }

    // ── Chunk load / network error → auto-reload once ─────────────────────
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')

    if (isChunkError) {
      const reloaded = sessionStorage.getItem('vite-chunk-reload')
      if (!reloaded) {
        sessionStorage.setItem('vite-chunk-reload', 'true')
        window.location.reload()
        return
      }
    }

    // ── Production: silent auto-recovery strategy ──────────────────────────
    // TEMPORARILY DISABLED for debugging — show the error screen immediately
    if (false && !IS_DEV) {
      const attemptCount = Number(sessionStorage.getItem('error-recovery-count') || '0')

      if (attemptCount === 0) {
        // First crash → reload silently (user sees nothing)
        sessionStorage.setItem('error-recovery-count', '1')
        window.location.reload()
        return
      }

      if (attemptCount === 1) {
        // Second crash → redirect to home (user sees nothing)
        sessionStorage.setItem('error-recovery-count', '2')
        window.location.href = '/app'
        return
      }

      // Third crash → show minimal message (no technical details)
      this.setState(prev => ({ attemptCount: prev.attemptCount + 1 }))
    }
  }

  private handleRetry = () => {
    sessionStorage.removeItem('error-recovery-count')
    sessionStorage.removeItem('vite-chunk-reload')
    window.location.reload()
  }

  private handleGoHome = () => {
    sessionStorage.removeItem('error-recovery-count')
    sessionStorage.removeItem('vite-chunk-reload')
    this.setState({ hasError: false, error: null })
    window.location.href = '/app'
  }

  public componentDidMount() {
    // Clean up recovery counters on a fresh successful load
    if (!this.state.hasError) {
      sessionStorage.removeItem('error-recovery-count')
      sessionStorage.removeItem('vite-chunk-reload')
    }
  }

  public render() {
    if (this.state.hasError) {
      // ── Offline / network error ─────────────────────────────────────────
      if (this.state.isNetworkError || !navigator.onLine) {
        return <OfflineScreen onRetry={this.handleRetry} />
      }

      // ── Production: minimal, non-technical fallback ─────────────────────
      if (false) {
        return (
          <div
            style={{
              minHeight: '100dvh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              background: '#fff',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#FFF5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                fontSize: 28,
              }}
            >
              😕
            </div>

            <p
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#111',
                marginBottom: 8,
              }}
            >
              Quelque chose s'est mal passé
            </p>

            <p
              style={{
                fontSize: 14,
                color: '#666',
                maxWidth: 280,
                lineHeight: 1.5,
                marginBottom: 28,
              }}
            >
              L'application a rencontré un problème. Retournez à l'accueil pour continuer.
            </p>

            <button
              onClick={this.handleGoHome}
              style={{
                width: '100%',
                maxWidth: 260,
                padding: '14px 0',
                background: '#FF7A00',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              Retour à l'accueil
            </button>

            <button
              onClick={this.handleRetry}
              style={{
                width: '100%',
                maxWidth: 260,
                padding: '14px 0',
                background: 'transparent',
                color: '#666',
                fontWeight: 600,
                fontSize: 14,
                border: '1.5px solid #E5E5E5',
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
          </div>
        )
      }

      // ── Development: full technical details ────────────────────────────
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F9F9F9] p-6 text-center z-[9999] relative">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>

          <h1 className="text-[20px] font-bold text-gray-900 mb-1">⚠️ Erreur (dev)</h1>

          <p className="text-[14px] text-gray-500 max-w-[320px] mx-auto mb-6 leading-relaxed">
            Cette erreur n'est visible qu'en développement.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-[280px] mb-8">
            <button
              onClick={this.handleRetry}
              className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-transform"
            >
              Recharger
            </button>
            <button
              onClick={this.handleGoHome}
              className="w-full py-3.5 bg-white text-gray-900 font-bold rounded-xl border border-gray-200 active:scale-95 transition-transform"
            >
              Accueil
            </button>
          </div>

          {this.state.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl max-w-[90vw] overflow-auto text-left w-full sm:max-w-[420px]">
              <p className="text-[11px] font-mono text-red-600 whitespace-pre-wrap break-all">
                {this.state.error.stack || this.state.error.toString()}
              </p>
            </div>
          )}
        </div>
      )
    }

    // No error — render children normally
    return this.props.children
  }
}
