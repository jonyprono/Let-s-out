import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SignupGender } from '@/stores/signup-intro.store'

interface StepGenderProps {
  value: SignupGender | null
  onChange: (value: SignupGender) => void
}

const OPTIONS: { value: SignupGender; labelKey: string; hintKey?: string }[] = [
  { value: 'FEMALE', labelKey: 'signupIntro.genderFemale' },
  { value: 'MALE', labelKey: 'signupIntro.genderMale' },
  { value: 'OTHER', labelKey: 'signupIntro.genderOther', hintKey: 'signupIntro.genderOtherHint' },
]

/** Écran 3/3 — « Quel est votre genre ? » (vrais boutons radio : flèches clavier et lecteurs d'écran) */
export const StepGender = forwardRef<HTMLInputElement, StepGenderProps>(function StepGender(
  { value, onChange },
  firstRadioRef,
) {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
        {t('signupIntro.genderTitle')}
      </h1>
      <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
        {t('signupIntro.genderSubtitle')}
      </p>

      <fieldset className="border-0 p-0 m-0 min-w-0 flex flex-col gap-3">
        <legend className="sr-only">{t('signupIntro.genderLegend')}</legend>
        {OPTIONS.map((opt, idx) => {
          const checked = value === opt.value
          const hintId = opt.hintKey ? `signup-gender-${opt.value}-hint` : undefined
          return (
            <label
              key={opt.value}
              className={`flex items-center justify-between gap-3 px-4 min-h-[52px] py-3 rounded-[12px] cursor-pointer transition-colors bg-white dark:bg-[#1A1A1A] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--border-brand-primary)] ${
                checked ? 'border-2 border-[var(--brand-orange-500)]' : 'border border-gray-200 dark:border-white/10'
              }`}
            >
              <span className="flex flex-col gap-1 min-w-0">
                <span className="font-poppins text-[15px] font-medium text-gray-900 dark:text-white">
                  {t(opt.labelKey)}
                </span>
                {opt.hintKey && (
                  <span id={hintId} className="font-poppins text-[12px] leading-[18px] text-gray-500 dark:text-gray-400">
                    {t(opt.hintKey)}
                  </span>
                )}
              </span>
              <input
                ref={idx === 0 ? firstRadioRef : undefined}
                type="radio"
                name="signup-gender"
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                aria-describedby={hintId}
                className="sr-only"
              />
              {/* Indicateur visuel identique au choix du canal SMS de l'inscription */}
              <span
                aria-hidden="true"
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked ? 'border-[var(--brand-orange-500)]' : 'border-gray-200 dark:border-white/10'
                }`}
              >
                {checked && <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-orange-500)]" />}
              </span>
            </label>
          )
        })}
      </fieldset>
    </div>
  )
})
