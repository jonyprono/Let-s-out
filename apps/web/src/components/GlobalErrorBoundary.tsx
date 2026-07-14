import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircleIcon, RefreshCcw01Icon, Home01Icon } from 'hugeicons-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/app';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b] p-6 text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircleIcon size={40} className="text-red-500" />
          </div>
          
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white mb-2">
            Oups ! Quelque chose s'est mal passé.
          </h1>
          
          <p className="text-[15px] text-gray-500 max-w-[320px] mx-auto mb-8 leading-relaxed">
            Une erreur inattendue s'est produite. Nous nous en excusons. Vous pouvez recharger la page ou retourner à l'accueil.
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-black font-bold rounded-xl active:scale-95 transition-transform"
            >
              <RefreshCcw01Icon size={18} />
              Recharger la page
            </button>
            
            <button
              onClick={this.handleGoHome}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-gray-800 active:scale-95 transition-transform"
            >
              <Home01Icon size={18} />
              Retour à l'accueil
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-12 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-[90vw] overflow-auto text-left w-full max-w-[400px]">
              <p className="text-xs font-mono text-red-500">{this.state.error.toString()}</p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
