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

const COUNTRIES = [
  { flag: '🇧🇯', code: '+229', name: 'Bénin' },
  { flag: '🇹🇬', code: '+228', name: 'Togo' },
  { flag: '🇨🇮', code: '+225', name: "Côte d'Ivoire" },
  { flag: '🇸🇳', code: '+221', name: 'Sénégal' },
  { flag: '🇳🇬', code: '+234', name: 'Nigeria' },
  { flag: '🇫🇷', code: '+33', name: 'France' },
]

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
  // step: 1=phone, 2=otp(4 digits), 3=new password
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp'>('sms')
  const [showCountry, setShowCountry] = useState(false)
  const [otp, setOtp] = useState(['', '', '', ''])
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
      if (codeStr.length < 4) return
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
    if (v && i < 3) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setOtp(['', '', '', ''])
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
    if (step === 1) return !phone.trim() || sendingOtp || checkingTarget || isFirebaseSending
    if (step === 2) return otp.join('').length < 4 || isFirebaseVerifying || checkingOtp
    if (step === 3) return !isPwdValid || resetting
    return false
  }

  const isLoading = sendingOtp || checkingTarget || isFirebaseSending || isFirebaseVerifying || checkingOtp || resetting

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <div id="recaptcha-container-fp" />

      {/* ── Header ─────────────────────────────────── */}
      <div className="px-5 pt-4 pb-0 shrink-0">
        <div className="flex items-center justify-center relative mb-1">
          <button onClick={handlePrev} className="absolute left-0 w-8 h-8 flex items-center justify-center active:opacity-70">
            <ChevronLeft className="w-5 h-5 text-[#1A1A1A]" strokeWidth={2.5} />
          </button>
          <span className="text-[15px] font-semibold text-[#1A1A1A]">Réinitialiser votre mot de passe</span>
        </div>
        <div className="flex justify-center mt-1">
          <div className="w-10 h-[2.5px] bg-[#FF9F1C] rounded-full" />
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div className="flex-1 px-6 pt-7 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* STEP 1: PHONE */}
        {step === 1 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">
              Entrez votre numéro de téléphone
            </h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Entrez le numéro de téléphone lié à votre compte pour recevoir un code et réinitialiser votre mot de passe.
            </p>

            <label className="text-[13px] text-[#555555] font-medium mb-1.5 block">Numéro de téléphone</label>
            <div className="flex gap-2 mb-6">
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowCountry(!showCountry)}
                  className="flex items-center gap-1 px-3 py-3.5 border border-[#E5E5E5] rounded-xl bg-white text-[15px] font-medium whitespace-nowrap"
                >
                  <span>{country.flag}</span>
                  <span className="text-[#1A1A1A] text-[13px]">({country.code.replace('+', '')})</span>
                  <svg className="w-3 h-3 text-[#888888] ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCountry && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-10 w-48">
                    {COUNTRIES.map(c => (
                      <button key={c.code} onClick={() => { setCountry(c); setShowCountry(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-left">
                        <span>{c.flag}</span><span className="text-[#1A1A1A]">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="01 97 00 00 00"
                className="flex-1 min-w-0 px-4 py-3.5 border-2 border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A] placeholder-[#BBBBBB]"
              />
            </div>

            <label className="text-[13px] text-[#555555] font-medium mb-2 block">Recevoir le code par</label>
            <div className="flex gap-3">
              {(['SMS', 'Whatsapp'] as const).map(ch => {
                const val = ch.toLowerCase() as 'sms' | 'whatsapp'
                const isActive = currentChannel === val
                return (
                  <button key={ch} onClick={() => setCurrentChannel(val)}
                    className="flex-1 flex items-center justify-between px-4 py-3.5 border border-[#E5E5E5] rounded-xl bg-white transition-colors">
                    <span className="text-[15px] font-bold text-[#1A1A1A]">{ch}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isActive ? 'border-[#FF9F1C]' : 'border-[#CCCCCC]'}`}>
                      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 2: OTP (4 digits) */}
        {step === 2 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">
              Quel est le code reçu&nbsp;?
            </h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Code à 4 chiffres envoyé par <strong className="text-[#1A1A1A]">SMS</strong> au<br />
              <strong className="text-[#1A1A1A]">{maskPhone(fullPhone)}</strong>
            </p>

            <div className="grid grid-cols-4 gap-3 mb-5 w-full">
              {otp.map((d, i) => (
                <input
                  key={i} ref={el => { otpRefs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center text-[22px] font-bold border-2 rounded-xl focus:outline-none transition-colors bg-white
                    ${d ? 'border-[#FF9F1C] text-[#1A1A1A]' : 'border-[#E5E5E5] text-[#1A1A1A]'}
                    focus:border-[#FF9F1C]`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleResend} disabled={countdown > 0}
                className="flex items-center gap-1.5 text-[13px] text-[#666666] disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Renvoyer le code
              </button>
              {countdown > 0 && (
                <span className="text-[13px] text-[#888888]">
                  dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: NEW PASSWORD */}
        {step === 3 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">Nouveau mot de passe</h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Définissez un nouveau mot de passe robuste et sécurisé pour<br />protéger votre compte
            </p>

            <label className="text-[13px] text-[#555555] font-medium mb-1.5 block">Mot de passe</label>
            <div className="relative mb-5">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white pr-12 text-[#1A1A1A]"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888888]">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <label className="text-[13px] text-[#555555] font-medium mb-1.5 block">Confirmer mot de passe</label>
            <div className="relative mb-5">
              <input
                type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white pr-12 text-[#1A1A1A]"
              />
              <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888888]">
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
      <div className="px-6 pb-5 pt-3 shrink-0 bg-white">
        <button
          onClick={handleNext}
          disabled={isNextDisabled()}
          className="w-full py-[17px] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:opacity-90 bg-[#FF9F1C] text-white disabled:bg-[#FFD99A] disabled:text-white"
        >
          {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          <span>{step === 3 ? 'Réinitialiser' : 'Suivant'}</span>
        </button>
      </div>

      {/* Home indicator */}
      <div className="h-6 flex items-center justify-center pb-1 shrink-0">
        <div className="w-32 h-[4px] bg-[#1A1A1A] rounded-full" />
      </div>
    </div>
  )
}
