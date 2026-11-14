import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BackButton } from '@/components/ui/BackButton'
import { ProgressBar } from '@/components/ui/progress-bar'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { useCheckAge, useSignupConfig } from '@/features/auth/hooks/useAuth'
import { validateBirthDate } from '@/lib/age'
import { normalizeName, validateName } from '@/lib/person-name'
import {
  useSignupIntroStore,
  isSignupBlockedForSession,
} from '@/stores/signup-intro.store'
import { StepName } from './StepName'
import { StepBirthdate } from './StepBirthdate'
import { StepGender } from './StepGender'
import { UnderageScreen } from './UnderageScreen'

const TOTAL_STEPS = 3

interface SignupIntroProps {
  /** Retour depuis l'écran 1 ou depuis l'écran de blocage → accueil / connexion */
  onExit: () => void
  /** Lien « J'ai déjà un compte ? Se connecter » */
  onLogin: () => void
  /** Les 3 réponses sont enregistrées dans le store → suite de l'inscription */
  onComplete: () => void
}

/**
 * Parcours d'accueil avant l'inscription : nom (1/3), date de naissance (2/3),
 * genre (3/3). L'étape courante est dans l'URL (?step=) pour que le bouton
 * retour Android et le rechargement de page fonctionnent naturellement.
 */
export function SignupIntro({ onExit, onLogin, onComplete }: SignupIntroProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()

  const firstName = useSignupIntroStore((s) => s.firstName)
  const lastName = useSignupIntroStore((s) => s.lastName)
  const storedBirthDate = useSignupIntroStore((s) => s.birthDate)
  const gender = useSignupIntroStore((s) => s.gender)
  const setName = useSignupIntroStore((s) => s.setName)
  const setBirthDate = useSignupIntroStore((s) => s.setBirthDate)
  const setGender = useSignupIntroStore((s) => s.setGender)
  const markUnderage = useSignupIntroStore((s) => s.markUnderage)

  const config = useSignupConfig()
  const minAge = config.data?.minSignupAge ?? null
  const { mutate: checkAge, isPending: checkingAge } = useCheckAge()

  const [blocked, setBlocked] = useState(isSignupBlockedForSession)
  // Date en cours de saisie : écrite dans le store SEULEMENT après validation
  // client + serveur (la date d'un mineur n'est jamais conservée).
  const [birthDraft, setBirthDraft] = useState<string | null>(storedBirthDate)

  const nameOk = validateName(firstName) === 'OK' && validateName(lastName) === 'OK'
  const maxReachable = !nameOk ? 1 : !storedBirthDate ? 2 : 3
  const requested = Number(params.get('step')) || 1
  const step = Math.min(Math.max(requested, 1), maxReachable)

  // URL incohérente (ex. ?step=3 sans réponses) → on corrige sans créer d'entrée d'historique
  useEffect(() => {
    if (step !== requested) {
      setParams((p) => { p.set('step', String(step)); return p }, { replace: true })
    }
  }, [step, requested, setParams])

  // Focus sur le premier champ de chaque écran
  const nameRef = useRef<HTMLInputElement>(null)
  const birthRef = useRef<HTMLButtonElement>(null)
  const genderRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (blocked) return
    const id = window.setTimeout(() => {
      if (step === 1) nameRef.current?.focus()
      if (step === 2) birthRef.current?.focus()
      if (step === 3) genderRef.current?.focus()
    }, 150)
    return () => window.clearTimeout(id)
  }, [step, blocked])

  const birthValidation = minAge !== null ? validateBirthDate(birthDraft, minAge) : null

  const goToStep = (next: number) => {
    const search = new URLSearchParams(params)
    search.set('step', String(next))
    navigate({ search: search.toString() }, { state: { introStep: next } })
  }

  const handleBack = () => {
    if (step === 1) return onExit()
    // Si l'étape précédente est dans l'historique, on y revient (cohérent avec le retour Android)
    if ((location.state as { introStep?: number } | null)?.introStep === step) navigate(-1)
    else setParams((p) => { p.set('step', String(step - 1)); return p }, { replace: true })
  }

  const block = () => {
    markUnderage()
    setBirthDraft(null)
    setBlocked(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isNextDisabled) return

    if (step === 1) {
      setName(normalizeName(firstName), normalizeName(lastName))
      goToStep(2)
      return
    }

    if (step === 2) {
      if (!birthValidation || !birthDraft) return
      if (!birthValidation.ok) {
        if (birthValidation.code === 'UNDERAGE') block()
        return
      }
      // Confirmation serveur (MIN_SIGNUP_AGE, limite par IP) — rien n'est enregistré côté serveur
      checkAge(
        { birthDate: birthDraft },
        {
          onSuccess: () => {
            setBirthDate(birthDraft)
            goToStep(3)
          },
          onError: (err: any) => {
            const status = err?.response?.status
            const code = err?.response?.data?.code
            if (status === 403 && code === 'UNDERAGE') block()
            else if (status === 429) toast.error(t('signupIntro.errorTooManyAttempts'))
            else if (status === 400) toast.error(t('signupIntro.birthErrorInvalid'))
            else toast.error(t('signupIntro.errorNetwork'))
          },
        },
      )
      return
    }

    if (step === 3 && gender) onComplete()
  }

  // Étape 2 : « Suivant » reste actif pour un âge insuffisant (le clic affiche l'écran de blocage),
  // désactivé pour une date incomplète ou invalide.
  const birthCanSubmit = !!birthValidation && (birthValidation.ok || birthValidation.code === 'UNDERAGE')
  const isNextDisabled =
    (step === 1 && !nameOk) ||
    (step === 2 && (!birthCanSubmit || checkingAge)) ||
    (step === 3 && !gender)

  const loginLink = (
    <p className="text-center font-poppins text-[13px] text-gray-500 dark:text-gray-400">
      <span>{t('signupIntro.haveAccount')}</span>{' '}
      <button type="button" onClick={onLogin} className="font-semibold text-[var(--color-text-link)] hover:text-[var(--brand-orange-500)] focus:outline-none focus-visible:underline">
        <span>{t('signupIntro.login')}</span>
      </button>
    </p>
  )

  const footerStyle = { paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }

  // ── Écran de blocage (âge insuffisant) ──────────────────────────────
  if (blocked) {
    return (
      <div className="w-full h-full flex flex-col flex-1 bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden">
        <div className="px-4 pt-5 shrink-0">
          <div className="flex items-center justify-center mb-3">
            <span className="font-poppins text-[15px] font-semibold">{t('signup.title')}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 flex flex-col" style={{ scrollbarWidth: 'none' }}>
          <UnderageScreen minAge={minAge} />
        </div>
        <div className="px-5 pt-3 shrink-0 flex flex-col gap-4" style={footerStyle}>
          <PrimaryButton onClick={onExit}>{t('signupIntro.back')}</PrimaryButton>
          {loginLink}
        </div>
      </div>
    )
  }

  // ── Parcours 1/3 → 3/3 ──────────────────────────────────────────────
  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="w-full h-full flex flex-col flex-1 bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden"
    >
      <div className="px-4 pt-5 shrink-0">
        {/* Même géométrie que l'en-tête de Signup.tsx (pas de saut à l'enchaînement) */}
        <div className="flex items-center justify-center relative mb-3">
          <BackButton type="button" onClick={handleBack} aria-label={t('signupIntro.back')} className="absolute left-0" />
          <span className="font-poppins text-[15px] font-semibold text-gray-900 dark:text-white">
            {t('signup.title')}
          </span>
          <span
            className="absolute right-0 font-poppins text-[12px] font-medium text-gray-500 dark:text-gray-400"
            aria-label={t('signupIntro.progressLabel', { step, total: TOTAL_STEPS })}
          >
            <span aria-hidden="true">{`${step}/${TOTAL_STEPS}`}</span>
          </span>
        </div>
        <ProgressBar value={step} max={TOTAL_STEPS} className="h-[3px] rounded-none" aria-hidden="true" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-7 pb-4" style={{ scrollbarWidth: 'none' }}>
        {step === 1 && (
          <StepName ref={nameRef} firstName={firstName} lastName={lastName} onChange={setName} />
        )}
        {step === 2 && (
          <>
            <StepBirthdate ref={birthRef} value={birthDraft} onChange={setBirthDraft} validation={birthValidation} />
            {config.isError && (
              <div role="alert" className="mt-4 p-4 rounded-[12px] bg-[var(--brand-orange-100)] flex flex-col gap-2">
                <p className="font-poppins text-[12px] leading-[18px] text-gray-900">
                  <span>{t('signupIntro.configError')}</span>
                </p>
                <button type="button" onClick={() => config.refetch()} className="self-start font-poppins text-[13px] font-semibold text-gray-900 underline">
                  <span>{t('signupIntro.retry')}</span>
                </button>
              </div>
            )}
          </>
        )}
        {step === 3 && <StepGender ref={genderRef} value={gender} onChange={setGender} />}
      </div>

      <div className="px-5 pt-3 shrink-0 flex flex-col gap-4 bg-white dark:bg-black" style={footerStyle}>
        <PrimaryButton type="submit" disabled={isNextDisabled} loading={checkingAge || (step === 2 && config.isLoading)}>
          {t('signupIntro.next')}
        </PrimaryButton>
        {loginLink}
      </div>
    </form>
  )
}
