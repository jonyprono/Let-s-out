import { useState, useRef, useEffect } from 'react'
import i18n from '@/lib/i18n'
import { ViewIcon, ViewOffSlashIcon, Tick01Icon, RefreshIcon } from 'hugeicons-react'
import { BackButton } from '@/components/ui/BackButton';
import { useSendOtp, useCheckTarget, useCheckOtp, useResetPassword } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { COUNTRIES, Country } from '@/lib/countries'
import { PhoneInputField } from '@/components/shared/PhoneInputField'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { Input } from '@/components/ui/input'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { useTranslation } from 'react-i18next'

declare global {
  interface Window { recaptchaVerifier: any }
}

const OTP_LENGTH = 6

interface ForgotPasswordProps {
  onBack: () => void
  onComplete: () => void
}

function formatPhone(code: string, local: string) {
  const digits = local.replace(/\s+/g, '')
  const grouped = digits.match(/.{1,2}/g)?.join(' ') || digits
  return `${code} ${grouped}`
}

function validatePhone(code: string, phone: string) {
  const cleanPhone = phone.replace(/\s+/g, '')
  if (code === '+229') return /^01\d{8}$/.test(cleanPhone)
  if (code === '+225' || code === '+234') return /^\d{10,11}$/.test(cleanPhone)
  if (code === '+228' || code === '+221') return /^\d{8,9}$/.test(cleanPhone)
  return /^\d{8,15}$/.test(cleanPhone)
}

export function ForgotPassword({ onBack, onComplete }: ForgotPasswordProps) {
  const { t } = useTranslation()
  // step: 1=phone, 2=otp(6 digits), 3=new password
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const { displayValue: phoneDisplay, rawValue: phone, handleChange: handlePhoneChange, reset: resetPhone } = usePhoneFormatter()
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp' | ''>('')
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [nativeVerificationId, setNativeVerificationId] = useState<string>('')
  const [idToken, setIdToken] = useState<string>('')
  const [isFirebaseSending, setIsFirebaseSending] = useState(false)
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false)
  // Tracks exactly which channel sent the LAST code — prevents stale Firebase session
  // from hijacking backend OTP verification (root cause of the OTP rejection bug)
  const [lastCodeVia, setLastCodeVia] = useState<'firebase' | 'backend' | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const { mutate: checkTarget, isPending: checkingTarget } = useCheckTarget()
  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp()
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp()
  const { mutate: resetPassword, isPending: resetting } = useResetPassword()

  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`

  // ── Countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // ── Navigation ──────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 1) {
      if (!phone.trim()) return
      if (!currentChannel) { toast.error(t('forgotPassword.veuillezSelectionnerSmsOuWhatsapp')); return }
      if (!validatePhone(country.code, phone)) {
        return toast.error(country.code === '+229'
          ? t('forgotPassword.auBeninLeNumeroDoit')
          : t('forgotPassword.leFormatDeVotreNumero'))
      }
      checkTarget({ target: fullPhone }, {
        onSuccess: async ({ data }) => {
          if (!data.exists) {
            toast.error(t('forgotPassword.ceNumeroNEstLie'))
          } else {
            if (currentChannel === 'sms') {
              try {
                setIsFirebaseSending(true)
                if (Capacitor.isNativePlatform()) {
                  const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
                    setNativeVerificationId(event.verificationId)
                    setLastCodeVia('firebase')
                  })
                  await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone })
                  setStep(2); setCountdown(59)
                  setTimeout(() => otpRefs.current[0]?.focus(), 100)
                  setTimeout(() => listener.remove(), 60000)
                } else {
                  if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-fp', { size: 'invisible' })
                  const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
                  setConfirmationResult(confirmation)
                  setLastCodeVia('firebase')
                  setStep(2); setCountdown(59)
                  setTimeout(() => otpRefs.current[0]?.focus(), 100)
                }
              } catch {
                if (!Capacitor.isNativePlatform() && window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
                // CRITICAL: Clear ALL Firebase state before backend fallback
                setConfirmationResult(null)
                setNativeVerificationId('')
                setLastCodeVia('backend')
                sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
                  onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                  onError: (e: any) => toast.error(e.response?.data?.message || t('forgotPassword.erreurDEnvoiDuCode')),
                })
              } finally { setIsFirebaseSending(false) }
            } else {
              setLastCodeVia('backend')
              sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
                onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                onError: (e: any) => toast.error(e.response?.data?.message || t('forgotPassword.erreurDEnvoi')),
              })
            }
          }
        },
        onError: () => toast.error(t('forgotPassword.erreurDeVerificationDuNumero')),
      })
    } else if (step === 2) {
      const codeStr = otp.join('')
      if (codeStr.length < OTP_LENGTH) return
      // Use lastCodeVia to determine the EXACT path — prevents stale Firebase session
      // from hijacking a verification that should go to backend
      const useFirebasePath = lastCodeVia === 'firebase' && (confirmationResult || nativeVerificationId)
      if (useFirebasePath) {
        setIsFirebaseVerifying(true)
        try {
          if (Capacitor.isNativePlatform() && nativeVerificationId) {
            await FirebaseAuthentication.confirmVerificationCode({
              verificationId: nativeVerificationId,
              verificationCode: codeStr,
            })
            const tokenResult = await FirebaseAuthentication.getIdToken()
            if (tokenResult.token) setIdToken(tokenResult.token)
            setStep(3)
          } else if (confirmationResult) {
            const result = await confirmationResult.confirm(codeStr)
            const token = await result.user.getIdToken()
            setIdToken(token); setStep(3)
          }
        } catch { toast.error(t('forgotPassword.codeSmsInvalideOuExpire')) }
        finally { setIsFirebaseVerifying(false) }
      } else {
        checkOtp({ target: fullPhone, code: codeStr }, {
          onSuccess: () => setStep(3),
          onError: () => toast.error(t('forgotPassword.codeInvalideOuExpireVerifiez')),
        })
      }
    } else if (step === 3) {
      const isFirebaseFlow = currentChannel === 'sms' && (!!idToken || !!nativeVerificationId)
      resetPassword({
        target: fullPhone,
        code: isFirebaseFlow ? undefined : otp.join(''),
        idToken: isFirebaseFlow ? idToken : undefined,
        newPassword: password,
      }, {
        onSuccess: () => { toast.success(t('forgotPassword.motDePasseReinitialiseAvec')); onComplete() },
        onError: (e: any) => toast.error(e.response?.data?.error || t('forgotPassword.erreurLorsDeLaReinitialisation')),
      })
    }
  }

  const handlePrev = () => { if (step === 1) onBack(); else setStep(s => s - 1) }

  // ── OTP handlers ─────────────────────────────────────────────
  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
    if (v && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    e.preventDefault()
    const next = [...otp]
    pasted.split('').forEach((ch, idx) => { next[idx] = ch })
    setOtp(next)
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
    otpRefs.current[focusIdx]?.focus()
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setOtp(Array(OTP_LENGTH).fill(''))
    try {
      setIsFirebaseSending(true)
      if (Capacitor.isNativePlatform()) {
        const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
          setNativeVerificationId(event.verificationId)
        })
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone })
        setTimeout(() => listener.remove(), 60000)
        setCountdown(59)
        toast.success(t('forgotPassword.codeRenvoyeParSms')); setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-fp', { size: 'invisible' })
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
        setConfirmationResult(confirmation); setCountdown(59)
        toast.success(t('forgotPassword.codeRenvoyeParSms')); setTimeout(() => otpRefs.current[0]?.focus(), 100)
      }
    } catch {
      if (!Capacitor.isNativePlatform() && window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
      // CRITICAL: Clear ALL Firebase state when falling back to backend resend
      setConfirmationResult(null)
      setNativeVerificationId('')
      setLastCodeVia('backend')
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => { setCountdown(59); toast.success(t('forgotPassword.codeRenvoye')); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
        onError: () => toast.error(t('forgotPassword.impossibleDeRenvoyerLeCode')),
      })
    } finally { setIsFirebaseSending(false) }
  }

  // ── Password validation ───────────────────────────────────────
  const pwdLength = password.length >= 6
  const hasLower = /[a-zà-ÿ]/.test(password)
  const hasUpper = /[A-ZÀ-Ÿ]/.test(password)
  const pwdNumber = /[0-9]/.test(password)
  const pwdMatch = password === confirmPassword && password.length > 0
  const isPwdValid = pwdLength && hasLower && hasUpper && pwdNumber && pwdMatch

  const isNextDisabled = () => {
    if (step === 1) return !phone.trim() || !currentChannel || sendingOtp || checkingTarget || isFirebaseSending
    if (step === 2) return otp.join('').length < OTP_LENGTH || isFirebaseVerifying || checkingOtp
    if (step === 3) return !isPwdValid || resetting
    return false
  }

  const isLoading = sendingOtp || checkingTarget || isFirebaseSending || isFirebaseVerifying || checkingOtp || resetting

  return (
    <div className="w-full h-full flex flex-col flex-1 bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden relative">
      <div id="recaptcha-container-fp" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-0 shrink-0">
        <div className="flex items-center justify-center relative mb-3">
          <BackButton
            onClick={handlePrev}
            aria-label={t('forgotPassword.retour')}
            className="absolute left-0 shrink-0"
          />
          <span className="font-poppins text-[15px] font-semibold text-gray-900 dark:text-white">
            <span>{t('forgotPassword.reinitialiserVotreMotDePasse')}</span>
          </span>
        </div>
        {/* Barre de progression fine */}
        <div className="h-[3px] w-full bg-[var(--border-default)] rounded-none overflow-hidden">
          <div
            className="h-full bg-[var(--brand-orange-500)] transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="flex-1 px-5 pt-7 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* ── STEP 1: PHONE ── */}
        {step === 1 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              <span>{t('forgotPassword.entrezVotreNumeroDeTelephone')}</span>
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              <span>{t('forgotPassword.entrezLeNumeroDeTelephone')}</span>
            </p>

            <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              <span>{t('forgotPassword.numeroDeTelephone')}</span>
            </label>
            <div className="mb-8">
              <PhoneInputField
                country={country}
                onCountryChange={(c) => { setCountry(c); resetPhone() }}
                phoneDisplay={phoneDisplay}
                onPhoneChange={handlePhoneChange}
              />
            </div>

            <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-3 block">
              <span>{t('forgotPassword.recevoirLeCodePar')}</span>
            </label>
            <div className="flex gap-3">
              {/* TODO: réactiver le bouton WhatsApp quand prêt 
                 (['SMS', 'Whatsapp'] as const)
              */}
              {(['SMS'] as const).map((ch) => {
                const val = ch.toLowerCase() as 'sms' | 'whatsapp'
                const isActive = currentChannel === val
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setCurrentChannel(val)}
                    className="flex-1 flex items-center justify-between px-4 h-[52px] rounded-[12px] border border-gray-200 dark:border-white/10 transition-colors gap-2 bg-white dark:bg-[#1A1A1A]"
                  >
                    <span className="flex-1 text-left font-poppins text-[15px] font-medium text-gray-900 dark:text-white">
                      {ch}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'border-[var(--brand-orange-500)]'
                          : 'border-gray-200 dark:border-white/10'
                      }`}
                    >
                      {isActive && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-orange-500)]" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === 2 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              <span>{i18n.t('forgotPassword.whichCode')}</span>
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              <span>{i18n.t('forgotPassword.codeSentBy', { count: OTP_LENGTH })}</span>{' '}
              <strong className="text-gray-900 dark:text-white">
                {currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </strong>{' '}au
              <br />
              <strong className="text-gray-900 dark:text-white">
                {formatPhone(country.code, phone)}
              </strong>
            </p>

            {/* OTP boxes */}
            <div
              className="grid gap-3 mb-6"
              style={{ gridTemplateColumns: `repeat(${OTP_LENGTH}, 1fr)` }}
            >
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  className={`aspect-square w-full text-center font-poppins text-[24px] font-semibold rounded-[12px] border-2 outline-none transition-colors bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white ${
                    d
                      ? 'border-[var(--brand-orange-500)]'
                      : 'border-gray-200 dark:border-white/10'
                  } focus:border-[var(--brand-orange-500)]`}
                />
              ))}
            </div>

            {/* Resend */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResend}
                disabled={countdown > 0}
                className="flex items-center gap-1.5 font-poppins text-[13px] text-gray-500 dark:text-gray-400 disabled:opacity-50 transition-opacity"
              >
                <RefreshIcon className="w-4 h-4" strokeWidth={2} />
                <span>{t('forgotPassword.renvoyerLeCode')}</span>
              </button>
              {countdown > 0 && (
                <span className="font-poppins text-[13px] text-gray-500 dark:text-gray-400">
                  dans{' '}
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: NEW PASSWORD ── */}
        {step === 3 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              <span>{t('forgotPassword.nouveauMotDePasse')}</span>
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-7">
              <span>{t('forgotPassword.definissezUnNouveauMotDe')}</span>
            </p>

            <div className="flex flex-col gap-5 mb-5">
              {/* Mot de passe */}
              <div>
                <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                  <span>{t('forgotPassword.motDePasse')}</span>
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  icon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)] transition-colors"
                    >
                      {showPassword
                        ? <ViewIcon size={20} strokeWidth={1.5} />
                        : <ViewOffSlashIcon size={20} strokeWidth={1.5} />}
                    </button>
                  }
                />
              </div>

              {/* Confirmer mot de passe */}
              <div>
                <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                  <span>{t('forgotPassword.confirmerMotDePasse')}</span>
                </label>
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder=""
                  icon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="focus:outline-none text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)] transition-colors"
                    >
                      {showConfirmPassword
                        ? <ViewIcon size={20} strokeWidth={1.5} />
                        : <ViewOffSlashIcon size={20} strokeWidth={1.5} />}
                    </button>
                  }
                />
              </div>
            </div>

            {/* Critères de validation */}
            <div className="space-y-2 mb-2">
              {[
                { ok: pwdLength, label: t('forgotPassword.auMoins6CaracteresNumeriques') },
                { ok: hasLower && hasUpper, label: 'Au moins 1 majuscule et 1 minuscule' },
                { ok: pwdNumber, label: 'Au moins 1 chiffre' },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      ok ? 'bg-[#34C759]' : 'bg-[#E0E0E0]'
                    }`}
                  >
                    {ok && <Tick01Icon width={10} height={10} strokeWidth={2.5} className="text-white" />}
                  </div>
                  <span
                    className={`font-poppins text-[12px] leading-[18px] ${
                      ok ? 'text-[#34C759]' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Button ───────────────────────────── */}
      <div 
        className="px-5 pt-3 mt-auto shrink-0 bg-white dark:bg-black"
        style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}
      >
        <PrimaryButton
          onClick={handleNext}
          disabled={isNextDisabled()}
          loading={isLoading}
        >
          {step === 3 ? t('forgotPassword.reinitialiser') : i18n.t('createEvent.actions.next')}
        </PrimaryButton>
      </div>
    </div>
  )
}
