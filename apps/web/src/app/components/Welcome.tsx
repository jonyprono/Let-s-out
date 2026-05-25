import {
  authShell,
  authTitleLg,
  authSubtitle,
  authGhostBtn,
} from '@/lib/auth-ui'

interface WelcomeProps {
  onLogin: () => void
  onSignup: () => void
}

export function Welcome({ onLogin, onSignup }: WelcomeProps) {
  return (
    <div className={authShell}>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="mb-8 flex justify-center w-full">
          <img src="/logoci.png" alt="Let's Out" className="w-[160px] h-auto object-contain" />
        </div>

        <h1 className={`${authTitleLg} mb-2`}>
          Connectez-vous
        </h1>

        <p className={`${authSubtitle} text-center mb-10 px-2`}>
          Rejoignez des événements près de{'\u00a0'}vous et<br />vivez des expériences partagées.
        </p>

        <div className="w-full space-y-3">
          <button
            id="welcome-login-btn"
            type="button"
            onClick={onLogin}
            className="auth-primary-btn w-full bg-action-primary hover:bg-action-primary-hover text-text-inverse py-[17px] rounded-full font-semibold text-[15px] tracking-wide active:scale-[0.98] transition-all"
          >
            Se connecter
          </button>
          <button
            id="welcome-signup-btn"
            type="button"
            onClick={onSignup}
            className={authGhostBtn}
          >
            S&apos;inscrire
          </button>
        </div>
      </div>

      <div className="px-8 pb-8 pt-2">
        <p className="text-[11px] text-text-secondary text-center leading-relaxed">
          En continuant, vous acceptez nos{' '}
          <span className="text-action-primary">Conditions d&apos;utilisation</span>
          {' '}et notre{' '}
          <span className="text-action-primary">Politique<br />de Confidentialité</span>
        </p>
      </div>

      <div className="h-6 flex items-center justify-center pb-1">
        <div className="w-32 h-[4px] bg-foreground rounded-full opacity-80" />
      </div>
    </div>
  )
}
