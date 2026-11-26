export type AuthMethod = 'email' | 'phone'

interface AuthMethodTabsProps {
  value: AuthMethod
  onChange: (method: AuthMethod) => void
  /** Libellés traduits, dans l'ordre d'affichage : e-mail puis téléphone. */
  labels: { email: string; phone: string }
  className?: string
}

/** Format e-mail standard (validation côté client ; le serveur reste la source de vérité). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/** Sélecteur E-mail / Téléphone (connexion et inscription). E-mail en premier. */
export function AuthMethodTabs({ value, onChange, labels, className = '' }: AuthMethodTabsProps) {
  return (
    <div
      role="tablist"
      className={`flex w-full p-1 gap-1 rounded-full bg-gray-100 dark:bg-[#1A1A1A] ${className}`}
    >
      {(['email', 'phone'] as const).map((method) => {
        const active = value === method
        return (
          <button
            key={method}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(method)}
            className={`flex-1 h-9 rounded-full font-inter text-[13px] font-medium transition-colors focus:outline-none ${
              active
                ? 'bg-white dark:bg-[#2A2A2A] text-[#FF7A00] shadow-sm'
                : 'bg-transparent text-[#766F6E] dark:text-gray-400'
            }`}
          >
            <span>{labels[method]}</span>
          </button>
        )
      })}
    </div>
  )
}
