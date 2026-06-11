import { authPrimaryBtn, authSecondaryBtn } from '@/lib/auth-ui'

interface WelcomeProps {
  onLogin: () => void
  onSignup: () => void
}

export function Welcome({ onLogin, onSignup }: WelcomeProps) {
  return (
    <div className="auth-flow w-full h-full bg-background-default flex flex-col overflow-hidden">

      {/* ── Zone logo — flex-1 pour centrer verticalement ───── */}
      <div className="flex-1 flex flex-col items-center justify-center px-[1rem]">
        {/* Logo */}
        <div className="mb-[2rem] flex justify-center w-full">
          <img
            src="/logoci.png"
            alt="Let's Out"
            className="w-[180px] h-auto object-contain"
          />
        </div>

        {/* Titre */}
        <h1 className="text-[26px] font-bold text-center text-foreground leading-tight mb-[0.5rem]">
          Connectez-vous
        </h1>

        {/* Sous-titre */}
        <p className="text-[14px] text-text-secondary text-center leading-relaxed mb-[2rem] max-w-[272px]">
          Rejoignez des événements près de&nbsp;vous et<br />
          vivez des expériences partagées.
        </p>

        {/* Boutons — largeur pleine, marges latérales 16px */}
        <div className="w-full flex flex-col gap-[0.75rem]">
          <button
            id="welcome-login-btn"
            type="button"
            onClick={onLogin}
            className={authPrimaryBtn}
          >
            Se connecter
          </button>

          <button
            id="welcome-signup-btn"
            type="button"
            onClick={onSignup}
            className={authSecondaryBtn}
          >
            S&apos;inscrire
          </button>
        </div>
      </div>

      {/* ── Mentions légales bas de page ──────────────────────── */}
      <div className="px-[1rem] pb-[1.5rem] pt-[0.5rem]">
        <p className="text-[11px] text-text-secondary text-center leading-relaxed">
          En continuant, vous acceptez nos{' '}
          <span className="text-action-primary font-semibold">
            Conditions d&apos;utilisation
          </span>{' '}
          et notre{' '}
          <span className="text-action-primary font-semibold">
            Politique de Confidentialité
          </span>
        </p>
      </div>

    </div>
  )
}
