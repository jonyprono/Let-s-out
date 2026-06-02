import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { useSendOtp, useCheckTarget, useCheckOtp, useResetPassword } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'

declare global {
  interface Window { recaptchaVerifier: any; }
}

interface ForgotPasswordProps {
  onBack: () => void
  onComplete: () => void
}

import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import {
  authShell,
  authTitle,
  authHeader,
  authSubtitle,
  authLabel,
  authInput,
  authPhoneInputFlex,
  authChannelBtn,
  authChannelLabel,
} from '@/lib/auth-ui'

function maskPhone(full: string) {
  if (full.length <= 7) return full
  return full.slice(0, 5) + ' ' + full.slice(5, 7) + ' ' + full.slice(7, -2).replace(/\d/g, '0') + ' ' + full.slice(-2)
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
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [idToken, setIdToken] = useState<string>('')
  const [isFirebaseSending, setIsFirebaseSending] = useState(false)
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const { mutate: checkTarget, isPending: checkingTarget } = useCheckTarget()
  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp()
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp()
  const { mutate: resetPassword, isPending: resetting } = useResetPassword()

  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

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
                if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-fp', { size: 'invisible' })
                const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
                setConfirmationResult(confirmation); setStep(2); setCountdown(59)
                setTimeout(() => otpRefs.current[0]?.focus(), 100)
              } catch {
                if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
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
      if (codeStr.length < 6) return
      if (currentChannel === 'sms' && confirmationResult) {
        setIsFirebaseVerifying(true)
        try {
          const result = await confirmationResult.confirm(codeStr)
          const token = await result.user.getIdToken()
          setIdToken(token); setStep(3)
        } catch { toast.error('Code SMS invalide ou expiré') }
        finally { setIsFirebaseVerifying(false) }
      } else {
        checkOtp({ target: fullPhone, code: codeStr }, {
          onSuccess: () => setStep(3),
          onError: () => toast.error('Code invalide ou expiré. Vérifiez et réessayez.'),
        })
      }
    } else if (step === 3) {
      const isFirebaseFlow = currentChannel === 'sms' && !!idToken
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

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setOtp(['', '', '', '', '', ''])
    try {
      setIsFirebaseSending(true)
      if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-fp', { size: 'invisible' })
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
      setConfirmationResult(confirmation); setCountdown(59); setCurrentChannel('sms')
      toast.success('Code renvoyé par SMS'); setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
      setConfirmationResult(null)
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => { setCountdown(59); toast.success('Code renvoyé'); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
        onError: () => toast.error('Impossible de renvoyer le code'),
      })
    } finally { setIsFirebaseSending(false) }
  }

  const pwdLength = password.length >= 6
  const pwdMixed = /[a-z]/.test(password) && /[A-Z]/.test(password)
  const pwdNumber = /[0-9]/.test(password)
  const pwdMatch = password === confirmPassword && password.length > 0
  const isPwdValid = pwdLength && pwdMixed && pwdNumber && pwdMatch

  const isNextDisabled = () => {
    if (step === 1) return !phone.trim() || !currentChannel || sendingOtp || checkingTarget || isFirebaseSending
    if (step === 2) return otp.join('').length < 6 || isFirebaseVerifying || checkingOtp
    if (step === 3) return !isPwdValid || resetting
    return false
  }

  const isLoading = sendingOtp || checkingTarget || isFirebaseSending || isFirebaseVerifying || checkingOtp || resetting

  return (
    <div className={authShell}>
      <div id="recaptcha-container-fp" />

      {/* ── Header ─────────────────────────────────── */}
      <div className="px-5 pt-4 pb-0 shrink-0">
        <div className="flex items-center justify-center relative mb-4">
          <button onClick={handlePrev} className="absolute left-0 w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
          </button>
          <span className={authHeader}>Réinitialiser votre mot de passe</span>
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div className="flex-1 px-6 pt-7 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* STEP 1: PHONE */}
        {step === 1 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Entrez votre numéro de téléphone
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Entrez le numéro de téléphone lié à votre compte pour recevoir un code et réinitialiser votre mot de passe.
            </p>

            <label className={`${authLabel} mb-1.5 block`}>Numéro de téléphone</label>
            <div className="flex gap-2 mb-6">
              <CountryPicker value={country} onChange={(c) => { setCountry(c); resetPhone() }} />
              <input
                type="tel" inputMode="numeric" value={phoneDisplay} onChange={handlePhoneChange}
                placeholder="01 97 00 00 00"
                className={`auth-phone-input ${authPhoneInputFlex}`}
              />
            </div>

            <label className={`${authLabel} mb-2 block`}>Recevoir le code par</label>
            <div className="flex gap-3">
              {(['SMS', 'Whatsapp'] as const).map(ch => {
                const val = ch.toLowerCase() as 'sms' | 'whatsapp'
                const isActive = currentChannel === val
                return (
                  <button key={ch} type="button" onClick={() => setCurrentChannel(val)}
                    className={authChannelBtn}>
                    <span className={authChannelLabel}>{ch}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? 'border-action-primary' : 'border-[#CCCCCC]'}`}>
                      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-action-primary" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 2: OTP (6 digits) */}
        {step === 2 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Quel est le code reçu&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Code à 6 chiffres envoyé par <strong className="text-foreground">{currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</strong> au<br />
              <strong className="text-foreground">{maskPhone(fullPhone)}</strong>
            </p>

            <div className="grid grid-cols-6 gap-2 mb-5 w-full">
              {otp.map((d, i) => (
                <input
                  key={i} ref={el => { otpRefs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors bg-card text-foreground
                    ${d ? 'border-action-primary' : 'border-border'}
                    focus:border-action-primary`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleResend} disabled={countdown > 0}
                className="flex items-center justify-center gap-2 px-[18px] py-[10px] bg-neutral-gray-100 rounded-full text-[14px] font-medium text-foreground disabled:opacity-50 active:scale-95 transition-all">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Renvoyer le code
              </button>
              {countdown > 0 && (
                <span className="text-[14px] font-medium text-text-secondary">
                  dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: NEW PASSWORD */}
        {step === 3 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>Nouveau mot de passe</h1>
            <p className={`${authSubtitle} mb-7`}>
              Définissez un nouveau mot de passe robuste et sécurisé pour<br />protéger votre compte
            </p>

            <label className={`${authLabel} mb-1.5 block`}>Mot de passe</label>
            <div className="relative mb-5">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${authInput} pr-12`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <label className={`${authLabel} mb-1.5 block`}>Confirmer mot de passe</label>
            <div className="relative mb-5">
              <input
                type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`${authInput} pr-12`}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Validation rules */}
            <div className="space-y-2">
              {[
                { ok: pwdLength, label: 'Au moins 6 caractères numériques' },
                { ok: pwdMixed, label: 'Au moins 1 majuscule et 1 minuscule' },
                { ok: pwdNumber, label: 'Au moins 1 chiffre' },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-[#34C759]' : 'bg-[#E5E5E5]'}`}>
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                  <span className={`text-[12px] ${ok ? 'text-[#34C759]' : 'text-[#888888]'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Button ───────────────────────────── */}
      <div className="px-6 pb-5 pt-3 shrink-0 bg-background">
        <button
          type="button"
          onClick={handleNext}
          disabled={isNextDisabled()}
          className="auth-primary-btn w-full py-[17px] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:opacity-90 bg-action-primary text-white disabled:bg-[#FFD99A] disabled:text-white"
        >
          {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          </button>
          <span className={authHeader}>Réinitialiser votre mot de passe</span>
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div className="flex-1 px-6 pt-7 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* STEP 1: PHONE */}
        {step === 1 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Entrez votre numéro de téléphone
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Entrez le numéro de téléphone lié à votre compte pour recevoir un code et réinitialiser votre mot de passe.
            </p>

            <label className={`${authLabel} mb-1.5 block`}>Numéro de téléphone</label>
            <div className="flex gap-2 mb-6">
              <CountryPicker value={country} onChange={(c) => { setCountry(c); resetPhone() }} />
              <input
                type="tel" inputMode="numeric" value={phoneDisplay} onChange={handlePhoneChange}
                placeholder="01 97 00 00 00"
                className={`auth-phone-input ${authPhoneInputFlex}`}
              />
            </div>

            <label className={`${authLabel} mb-2 block`}>Recevoir le code par</label>
            <div className="flex gap-3">
              {(['SMS', 'Whatsapp'] as const).map(ch => {
                const val = ch.toLowerCase() as 'sms' | 'whatsapp'
                const isActive = currentChannel === val
                return (
                  <button key={ch} type="button" onClick={() => setCurrentChannel(val)}
                    className={authChannelBtn}>
                    <span className={authChannelLabel}>{ch}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? 'border-action-primary' : 'border-[#CCCCCC]'}`}>
                      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-action-primary" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 2: OTP (6 digits) */}
        {step === 2 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Quel est le code reçu&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Code à 6 chiffres envoyé par <strong className="text-foreground">{currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</strong> au<br />
              <strong className="text-foreground">{maskPhone(fullPhone)}</strong>
            </p>

            <div className="grid grid-cols-6 gap-2 mb-5 w-full">
              {otp.map((d, i) => (
                <input
                  key={i} ref={el => { otpRefs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors bg-card text-foreground
                    ${d ? 'border-action-primary' : 'border-border'}
                    focus:border-action-primary`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleResend} disabled={countdown > 0}
                className="flex items-center justify-center gap-2 px-[18px] py-[10px] bg-neutral-gray-100 rounded-full text-[14px] font-medium text-foreground disabled:opacity-50 active:scale-95 transition-all">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Renvoyer le code
              </button>
              {countdown > 0 && (
                <span className="text-[14px] font-medium text-text-secondary">
                  dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: NEW PASSWORD */}
        {step === 3 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>Nouveau mot de passe</h1>
            <p className={`${authSubtitle} mb-7`}>
              Définissez un nouveau mot de passe robuste et sécurisé pour<br />protéger votre compte
            </p>

            <label className={`${authLabel} mb-1.5 block`}>Mot de passe</label>
            <div className="relative mb-5">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${authInput} pr-12`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <label className={`${authLabel} mb-1.5 block`}>Confirmer mot de passe</label>
            <div className="relative mb-5">
              <input
                type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`${authInput} pr-12`}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Validation rules */}
            <div className="space-y-2">
              {[
                { ok: pwdLength, label: 'Au moins 6 caractères numériques' },
                { ok: pwdMixed, label: 'Au moins 1 majuscule et 1 minuscule' },
                { ok: pwdNumber, label: 'Au moins 1 chiffre' },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-[#34C759]' : 'bg-[#E5E5E5]'}`}>
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                  <span className={`text-[12px] ${ok ? 'text-[#34C759]' : 'text-[#888888]'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Button ───────────────────────────── */}
      <div className="px-6 pb-5 pt-3 shrink-0 bg-background">
        <button
          type="button"
          onClick={handleNext}
          disabled={isNextDisabled()}
          className="auth-primary-btn w-full py-[17px] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:opacity-90 bg-action-primary text-white disabled:bg-[#FFD99A] disabled:text-white"
        >
          {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          <span>{step === 3 ? 'Réinitialiser' : 'Suivant'}</span>
        </button>
      </div>
    </div>
  )
}
