import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface UnderageScreenProps {
  /** Âge minimum (MIN_SIGNUP_AGE) ; null si la configuration n'a pas pu être lue */
  minAge: number | null
}

/** Écran de blocage — âge inférieur à MIN_SIGNUP_AGE. La date n'est pas enregistrée. */
export function UnderageScreen({ minAge }: UnderageScreenProps) {
  const { t } = useTranslation()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Annonce l'écran aux lecteurs d'écran
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-3 py-8">
      <div className="w-[88px] h-[88px] rounded-full bg-[var(--brand-orange-200)] flex items-center justify-center">
        <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand-orange-500)]">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 font-poppins font-semibold text-[22px] leading-[30px] text-gray-900 dark:text-white outline-none"
      >
        <span>
          {minAge ? t('signupIntro.underageTitle', { age: minAge }) : t('signupIntro.underageTitleGeneric')}
        </span>
      </h1>
      <p className="font-poppins text-[14px] leading-[22px] text-gray-500 dark:text-gray-400">
        {t('signupIntro.underageBody')}
      </p>
      <p className="font-poppins text-[12px] leading-[18px] text-gray-500 dark:text-gray-400">
        {t('signupIntro.underageNotSaved')}
      </p>
    </div>
  )
}
