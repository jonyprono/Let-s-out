import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BirthdatePicker } from './BirthdatePicker'
import type { BirthDateValidation } from '@/lib/age'

interface StepBirthdateProps {
  value: string | null
  onChange: (value: string | null) => void
  /** Résultat de validateBirthDate (null tant que l'âge minimum n'est pas chargé) */
  validation: BirthDateValidation | null
}

const ERROR_KEYS: Partial<Record<string, string>> = {
  INVALID_DATE: 'signupIntro.birthErrorInvalid',
  FUTURE_DATE: 'signupIntro.birthErrorFuture',
  TOO_OLD: 'signupIntro.birthErrorTooOld',
}

/** Écran 2/3 — « Quelle est votre date de naissance ? » */
export const StepBirthdate = forwardRef<HTMLButtonElement, StepBirthdateProps>(function StepBirthdate(
  { value, onChange, validation },
  firstButtonRef,
) {
  const { t } = useTranslation()
  const errorKey = validation && !validation.ok ? ERROR_KEYS[validation.code] : undefined
  // L'âge est affiché dès qu'une date complète et réelle est choisie (y compris sous l'âge minimum :
  // le refus n'intervient qu'au clic sur « Suivant »)
  const age = validation?.ok ? validation.age : validation && 'age' in validation && validation.code === 'UNDERAGE' ? validation.age : undefined

  return (
    <div>
      <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
        {t('signupIntro.birthTitle')}
      </h1>
      <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
        {t('signupIntro.birthSubtitle')}
      </p>

      <fieldset className="border-0 p-0 m-0 min-w-0">
        <legend className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 p-0">
          {t('signupIntro.birthLabel')}
        </legend>
        <BirthdatePicker
          ref={firstButtonRef}
          value={value}
          onChange={onChange}
          invalid={!!errorKey}
          describedBy="signup-birth-status"
        />
        <div id="signup-birth-status" aria-live="polite" className="min-h-[24px] mt-2">
          {errorKey ? (
            <p className="font-poppins text-[12px] leading-[18px] text-[var(--color-icon-danger)]">
              <span>{t(errorKey)}</span>
            </p>
          ) : age !== undefined ? (
            <p className="flex items-center gap-1.5 font-poppins text-[13px] font-medium text-gray-900 dark:text-white">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand-orange-500)] shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span>{t('signupIntro.ageDisplay', { count: age })}</span>
            </p>
          ) : null}
        </div>
      </fieldset>
    </div>
  )
})
