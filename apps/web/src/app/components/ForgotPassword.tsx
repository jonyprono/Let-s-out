import { useState, useRef, useEffect } from 'react'
import { ViewIcon, ViewOffSlashIcon, Tick01Icon, ArrowLeft01Icon, RefreshIcon } from 'hugeicons-react'
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
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const { mutate: checkTarget, isPending: checkingTarget } = useCheckTarget()
  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp()
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp()
  const { mutate: resetPassword, isPending: resetting } = useResetPassword()

  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`

  // ── Countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── Navigation ──────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 1) {
      if (!phone.trim()) return
      if (!currentChannel) { toast.error('Veuillez sélectionner SMS ou Whatsapp.'); return }
      if (!validatePhone(country.code, phone)) {
        return toast.error(country.code === '+229'
          ? 'Au Bénin, le numéro doit faire 10 chiffres et commencer par 01.'
          : 'Le format de votre numéro de téléphone est incorrect.')
      }
      checkTarget({ target: fullPhone }, {
        onSuccess: async ({ data }) => {
          if (!data.exists) {
            toast.error("Ce numéro n'est lié à aucun compte.")
          } else {
            if (currentChannel === 'sms') {
              try {
                setIsFirebaseSending(true)
                if (Capacitor.isNativePlatform()) {
                  const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
                    setNativeVerificationId(event.verificationId)
                  })
                  await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone })
                  setStep(2); setCountdown(59)
                  setTimeout(() => otpRefs.current[0]?.focus(), 100)
                  setTimeout(() => listener.remove(), 60000)
                } else {
                  if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-fp', { size: 'invisible' })
                  const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
                  setConfirmationResult(confirmation); setStep(2); setCountdown(59)
                  setTimeout(() => otpRefs.current[0]?.focus(), 100)
                }
              } catch {
                if (!Capacitor.isNativePlatform() && window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
                setConfirmationResult(null)
                sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
                  onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                  onError: (e: any) => toast.error(e.response?.data?.message || "Erreur d'envoi du code"),
                })
              } finally { setIsFirebaseSending(false) }
            } else {
              sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
                onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                onError: (e: any) => toast.error(e.response?.data?.message || "Erreur d'envoi"),
              })
            }
          }
        },
        onError: () => toast.error('Erreur de vérification du numéro'),
      })
    } else if (step === 2) {
      const codeStr = otp.join('')
      if (codeStr.length < OTP_LENGTH) return
      if (currentChannel === 'sms' && (confirmationResult || nativeVerificationId)) {
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
        } catch { toast.error('Code SMS invalide ou expiré') }
        finally { setIsFirebaseVerifying(false) }
      } else {
        checkOtp({ target: fullPhone, code: codeStr }, {
          onSuccess: () => setStep(3),
          onError: () => toast.error('Code invalide ou expiré. Vérifiez et réessayez.'),
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
        onSuccess: () => { toast.success('Mot de passe réinitialisé avec succès !'); onComplete() },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur lors de la réinitialisation'),
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
        toast.success('Code renvoyé par SMS'); setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-fp', { size: 'invisible' })
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
        setConfirmationResult(confirmation); setCountdown(59)
        toast.success('Code renvoyé par SMS'); setTimeout(() => otpRefs.current[0]?.focus(), 100)
      }
    } catch {
      if (!Capacitor.isNativePlatform() && window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
      setConfirmationResult(null)
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => { setCountdown(59); toast.success('Code renvoyé'); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
        onError: () => toast.error('Impossible de renvoyer le code'),
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
    <div className="w-full min-h-[100dvh] h-[100dvh] flex flex-col bg-[var(--color-background-primary)] text-[var(--color-text-primary)] overflow-hidden relative">
      <div id="recaptcha-container-fp" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-0 shrink-0">
        <div className="flex items-center justify-center relative mb-3">
          <button
            onClick={handlePrev}
            aria-label="Retour"
            className="absolute left-0 w-9 h-9 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft01Icon className="w-5 h-5 text-[var(--color-text-primary)]" strokeWidth={2} />
          </button>
          <span className="font-poppins text-[15px] font-semibold text-[var(--color-text-primary)]">
            Réinitialiser votre mot de passe
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Entrez votre numéro de téléphone
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Entrez le numéro de téléphone lié à votre compte pour recevoir un code et réinitialiser votre mot de passe.
            </p>

            <label className="font-poppins text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">
              Numéro de téléphone
            </label>
            <div className="mb-8">
              <PhoneInputField
                country={country}
                onCountryChange={(c) => { setCountry(c); resetPhone() }}
                phoneDisplay={phoneDisplay}
                onPhoneChange={handlePhoneChange}
              />
            </div>

            <label className="font-poppins text-[13px] font-medium text-[var(--color-text-secondary)] mb-3 block">
              Recevoir le code par
            </label>
            <div className="flex gap-3">
              {(['SMS', 'Whatsapp'] as const).map((ch) => {
                const val = ch.toLowerCase() as 'sms' | 'whatsapp'
                const isActive = currentChannel === val
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setCurrentChannel(val)}
                    className="flex-1 flex items-center justify-between px-4 h-[52px] rounded-[12px] border border-[var(--border-default)] transition-colors gap-2 bg-white"
                  >
                    <span className="flex-1 text-left font-poppins text-[15px] font-medium text-[var(--color-text-primary)]">
                      {ch}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'border-[var(--brand-orange-500)]'
                          : 'border-[var(--border-default)]'
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Quel est le code reçu&nbsp;?
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Code à {OTP_LENGTH} chiffres envoyé par{' '}
              <strong className="text-[var(--color-text-primary)]">
                {currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </strong>{' '}au
              <br />
              <strong className="text-[var(--color-text-primary)]">
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
                  className={`aspect-square w-full text-center font-poppins text-[24px] font-semibold rounded-[12px] border-2 outline-none transition-colors bg-white text-[var(--color-text-primary)] ${
                    d
                      ? 'border-[var(--brand-orange-500)]'
                      : 'border-[var(--border-default)]'
                  } focus:border-[var(--brand-orange-500)]`}
                />
              ))}
            </div>

            {/* Resend */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResend}
                disabled={countdown > 0}
                className="flex items-center gap-1.5 font-poppins text-[13px] text-[var(--color-text-secondary)] disabled:opacity-50 transition-opacity"
              >
                <RefreshIcon className="w-4 h-4" strokeWidth={2} />
                Renvoyer le code
              </button>
              {countdown > 0 && (
                <span className="font-poppins text-[13px] text-[var(--color-text-secondary)]">
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Nouveau mot de passe
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-7">
              Définissez un nouveau mot de passe robuste et sécurisé pour protéger votre compte
            </p>

            <div className="flex flex-col gap-5 mb-5">
              {/* Mot de passe */}
              <div>
                <label className="font-poppins text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">
                  Mot de passe
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
                <label className="font-poppins text-[13px] font-medium text-[var(--color-text-secondary)] mb-2 block">
                  Confirmer mot de passe
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
                { ok: pwdLength, label: 'Au moins 6 caractères numériques' },
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
                      ok ? 'text-[#34C759]' : 'text-[var(--color-text-secondary)]'
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
      <div className="px-5 pb-6 pt-3 shrink-0 bg-[var(--color-background-primary)]">
        <PrimaryButton
          onClick={handleNext}
          disabled={isNextDisabled()}
          loading={isLoading}
        >
          {step === 3 ? 'Réinitialiser' : 'Suivant'}
        </PrimaryButton>
      </div>
    </div>
  )
}
