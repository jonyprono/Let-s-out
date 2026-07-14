import { Component, ErrorInfo, ReactNode } from 'react'
import { OfflineScreen } from './OfflineScreen'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  isNetworkError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isNetworkError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    const isNetwork = 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      !navigator.onLine

    return { hasError: true, isNetworkError: isNetwork }
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
        <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--color-background-primary)]">
          <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Oups, une erreur inattendue est survenue.</h1>
          <button 
            onClick={this.handleRetry}
            className="bg-[var(--color-action-primary)] text-white px-6 py-3 rounded-full font-bold"
          >
            Recharger l'application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
