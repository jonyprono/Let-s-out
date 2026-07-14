import { Component, ErrorInfo, ReactNode } from 'react'
import { OfflineScreen } from './OfflineScreen'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  isNetworkError: boolean
  error?: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isNetworkError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    const isNetwork = 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      !navigator.onLine

    return { hasError: true, isNetworkError: isNetwork, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    
    // Auto-reload for Vercel deployment chunk errors
    if (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ) {
      // Prevent infinite reload loops by checking sessionStorage
      const reloaded = sessionStorage.getItem('vite-chunk-reload')
      if (!reloaded) {
        sessionStorage.setItem('vite-chunk-reload', 'true')
        window.location.reload()
      }
    }
  }

  private handleRetry = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.isNetworkError || !navigator.onLine) {
        return <OfflineScreen onRetry={this.handleRetry} />
      }
      
      // Fallback for non-network errors
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b] p-6 text-center z-[9999] relative">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white mb-2">
            ⚠️ Erreur
          </h1>
          
          <p className="text-[15px] text-gray-500 max-w-[320px] mx-auto mb-8 leading-relaxed">
            Une erreur inattendue s'est produite. Ne vous inquiétez pas, vous pouvez recharger la page ou retourner à l'accueil.
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <button
              onClick={this.handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-black font-bold rounded-xl active:scale-95 transition-transform"
            >
              Recharger la page
            </button>
            
            <button
              onClick={() => window.location.href = '/app'}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-gray-800 active:scale-95 transition-transform"
            >
              Retour à l'accueil
            </button>
          </div>
          
          {(this.state as any).error && (
            <div className="mt-12 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-[90vw] overflow-auto text-left w-full sm:max-w-[400px]">
              <p className="text-[11px] font-mono text-red-500 whitespace-pre-wrap break-all">{(this.state as any).error?.toString()}</p>
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
