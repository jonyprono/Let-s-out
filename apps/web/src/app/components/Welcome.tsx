interface WelcomeProps {
  onLogin: () => void
  onSignup: () => void
}

export function Welcome({ onLogin, onSignup }: WelcomeProps) {
  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] dark:bg-[#FFFFFF] flex flex-col">


      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Illustration */}
        <div className="mb-8 flex justify-center w-full">
          <img src="/logoci.png" alt="Let's Out Logo" className="w-[180px] h-auto object-contain" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-3 text-gray-900 dark:text-[#FFFFFF] dark:text-[#1A1A1A]">Connectez-vous</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-10 leading-relaxed px-4">
          Rejoignez des événements près de chez vous et vivez des expériences à plusieurs.
        </p>

        <div className="w-full space-y-3">
          <button
            id="welcome-login-btn"
            onClick={onLogin}
            className="w-full bg-[#FF9F1C] text-[#FFFFFF] dark:text-[#1A1A1A] py-4 rounded-full font-semibold text-base"
          >
            Se connecter
          </button>
          <button
            id="welcome-signup-btn"
            onClick={onSignup}
            className="w-full bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 py-4 rounded-full font-semibold text-base"
          >
            S'inscrire
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 pb-8 pt-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 text-center leading-relaxed">
          En continuant, vous acceptez nos{' '}
          <span className="text-[#FF9F1C]">Conditions d'utilisation</span>
          {' '}et notre{' '}
          <span className="text-[#FF9F1C]">Politique de Confidentialité</span>
        </p>
      </div>
    </div>
  )
}



