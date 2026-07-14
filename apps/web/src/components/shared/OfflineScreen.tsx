import { WifiOff, RefreshCcw } from 'lucide-react'

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--color-background-primary)] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="w-24 h-24 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-8">
        <WifiOff className="w-12 h-12 text-red-500" />
      </div>
      
      <h1 className="text-2xl font-bold font-poppins text-gray-900 dark:text-white mb-3">
        Aucune connexion
      </h1>
      
      <p className="text-gray-500 dark:text-gray-400 font-inter mb-10 max-w-xs mx-auto">
        Vérifiez votre connexion internet et réessayez.
      </p>
      
      <button 
        onClick={onRetry}
        className="flex items-center justify-center gap-2 bg-[var(--color-action-primary)] hover:bg-[#E66A00] active:scale-95 transition-all text-white px-8 py-4 rounded-full font-bold font-poppins shadow-lg shadow-orange-500/30 w-full max-w-xs mx-auto"
      >
        <RefreshCcw className="w-5 h-5" />
        Réessayer
      </button>
    </div>
  )
}
