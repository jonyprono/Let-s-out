import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { NAME_MAX_LENGTH, validateName, type NameValidation } from '@/lib/person-name'

interface StepNameProps {
  firstName: string
  lastName: string
  onChange: (firstName: string, lastName: string) => void
}

const ERROR_KEYS: Record<Exclude<NameValidation, 'OK'>, string> = {
  EMPTY: 'signupIntro.nameErrorEmpty',
  TOO_SHORT: 'signupIntro.nameErrorTooShort',
  TOO_LONG: 'signupIntro.nameErrorTooLong',
  INVALID_CHARS: 'signupIntro.nameErrorChars',
}

/** Écran 1/3 — « Comment vous appelez-vous ? » */
export const StepName = forwardRef<HTMLInputElement, StepNameProps>(function StepName(
  { firstName, lastName, onChange },
  firstInputRef,
) {
  const { t } = useTranslation()
  // Les erreurs ne s'affichent qu'après que le champ a été quitté (pas pendant la frappe)
  const [touched, setTouched] = useState({ first: false, last: false })

  const firstError = validateName(firstName)
  const lastError = validateName(lastName)
  const showFirst = touched.first && firstError !== 'OK'
  const showLast = touched.last && lastError !== 'OK'

  return (
    <div>
      <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
        {t('signupIntro.nameTitle')}
      </h1>
      <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
        {t('signupIntro.nameSubtitle')}
      </p>

      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="signup-first-name" className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
            {t('signupIntro.firstNameLabel')}
          </label>
          <Input
            ref={firstInputRef}
            id="signup-first-name"
            type="text"
            value={firstName}
            onChange={(e) => onChange(e.target.value, lastName)}
            onBlur={() => setTouched((s) => ({ ...s, first: true }))}
            autoComplete="given-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={NAME_MAX_LENGTH + 10}
            aria-invalid={showFirst || undefined}
            aria-describedby={showFirst ? 'signup-first-name-error' : undefined}
            className={showFirst ? 'border-[var(--color-icon-danger)]' : undefined}
          />
          {showFirst && (
            <p id="signup-first-name-error" role="alert" className="font-poppins text-[12px] leading-[18px] text-[var(--color-icon-danger)] mt-1.5">
              <span>{t(ERROR_KEYS[firstError as Exclude<NameValidation, 'OK'>], { max: NAME_MAX_LENGTH })}</span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="signup-last-name" className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
            {t('signupIntro.lastNameLabel')}
          </label>
          <Input
            id="signup-last-name"
            type="text"
            value={lastName}
            onChange={(e) => onChange(firstName, e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, last: true }))}
            autoComplete="family-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={NAME_MAX_LENGTH + 10}
            aria-invalid={showLast || undefined}
            aria-describedby={showLast ? 'signup-last-name-error' : undefined}
            className={showLast ? 'border-[var(--color-icon-danger)]' : undefined}
          />
          {showLast && (
            <p id="signup-last-name-error" role="alert" className="font-poppins text-[12px] leading-[18px] text-[var(--color-icon-danger)] mt-1.5">
              <span>{t(ERROR_KEYS[lastError as Exclude<NameValidation, 'OK'>], { max: NAME_MAX_LENGTH })}</span>
            </p>
          )}
        </div>

        <p className="font-poppins text-[12px] leading-[18px] text-gray-500 dark:text-gray-400">
          {t('signupIntro.nameHint')}
        </p>
      </div>
    </div>
  )
})
