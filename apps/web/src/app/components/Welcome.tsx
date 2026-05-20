interface WelcomeProps {
  onLogin: () => void
  onSignup: () => void
}

export function Welcome({ onLogin, onSignup }: WelcomeProps) {
  return (
    <div className="w-full h-full bg-white flex flex-col">

      {/* Main Content — logo + text + buttons centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">

        {/* Logo */}
        <div className="mb-8 flex justify-center w-full">
          <img src="/logoci.png" alt="Let's Out" className="w-[160px] h-auto object-contain" />
        </div>

        {/* Title */}
        <h1 className="text-[26px] font-bold text-center text-[#1A1A1A] mb-2 leading-tight">
          Connectez-vous
        </h1>

        {/* Subtitle */}
        <p className="text-[13px] text-[#888888] text-center mb-10 leading-relaxed px-2">
          Rejoignez des événements près de{'\u00a0'}vous et<br />vivez des expériences partagées.
        </p>

        {/* CTA Buttons */}
        <div className="w-full space-y-3">
          <button
            id="welcome-login-btn"
            onClick={onLogin}
            className="w-full bg-[#FF9F1C] text-white py-[17px] rounded-full font-semibold text-[15px] tracking-wide active:opacity-90 transition-opacity"
          >
            Se connecter
          </button>
          <button
            id="welcome-signup-btn"
            onClick={onSignup}
            className="w-full bg-white border border-gray-200 text-[#1A1A1A] py-[17px] rounded-full font-semibold text-[15px] tracking-wide active:bg-gray-50 transition-colors"
          >
            S'inscrire
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 pb-8 pt-2">
        <p className="text-[11px] text-[#AAAAAA] text-center leading-relaxed">
          En continuant, vous acceptez nos{' '}
          <span className="text-[#FF9F1C]">Conditions d'utilisation</span>
          {' '}et notre{' '}
          <span className="text-[#FF9F1C]">Politique<br />de Confidentialité</span>
        </p>
      </div>

      {/* Home indicator */}
      <div className="h-6 flex items-center justify-center pb-1">
        <div className="w-32 h-[4px] bg-[#1A1A1A] rounded-full" />
      </div>
    </div>
  )
}
