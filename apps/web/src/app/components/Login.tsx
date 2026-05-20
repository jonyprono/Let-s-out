import { useState, useRef, useEffect } from 'react'
import { Loader2, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useInitLogin, useLogin, useSendOtp } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

interface LoginProps {
  onSignup: () => void
  onForgotPassword: () => void
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

export function Login({ onSignup, onForgotPassword }: LoginProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [country, setCountry] = useState(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [showCountry, setShowCountry] = useState(false)
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp'>('whatsapp')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(0)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [isFirebaseSending, setIsFirebaseSending] = useState(false)
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false)

  const { mutate: initLogin, isPending: initializing } = useInitLogin()
  const { mutate: sendOtp, isPending: sending } = useSendOtp()
  const { mutate: login, isPending: logging } = useLogin()

  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleInit = () => {
    if (!phone.trim() || !password) return
    if (!validatePhone(country.code, phone)) {
      return toast.error(country.code === '+229'
        ? "Au Bénin, le numéro doit faire 10 chiffres et commencer par 01."
        : "Le format de votre numéro de téléphone est incorrect.")
    }
    initLogin({ target: fullPhone, password, channel: 'whatsapp' }, {
      onSuccess: () => {
        setStep(2)
        setCountdown(59)
        setCurrentChannel('whatsapp')
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      },
      onError: (e: any) => {
        if (e?.response?.status === 429) {
          toast.error("Trop de tentatives. Veuillez réessayer plus tard.")
        } else {
          const errData = e?.response?.data?.error
          const msg = typeof errData === 'string' ? errData : e?.message === 'Network Error' ? "Erreur réseau : serveur inaccessible" : `Erreur: ${e?.message || 'Inconnue'}`
          toast.error(msg)
        }
      }
    })
  }

  const handleLogin = async () => {
    const code = otp.join('')
    if (code.length < 6) return
    if (currentChannel === 'sms' && confirmationResult) {
      setIsFirebaseVerifying(true)
      try {
        const result = await confirmationResult.confirm(code)
        const token = await result.user.getIdToken()
        login({ target: fullPhone, idToken: token })
      } catch {
        toast.error("Code SMS invalide ou expiré")
      } finally {
        setIsFirebaseVerifying(false)
      }
    } else {
      login({ target: fullPhone, code })
    }
  }

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
    const sendSmsFallback = async () => {
      try {
        setIsFirebaseSending(true)
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
        }
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
        setConfirmationResult(confirmation)
        setCountdown(59)
        setCurrentChannel('sms')
        toast.success('Code renvoyé par SMS')
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } catch {
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear() } catch {}
          window.recaptchaVerifier = undefined
        }
        setConfirmationResult(null)
        sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
          onSuccess: () => {
            setCountdown(59); setCurrentChannel('sms')
            toast.success('Code renvoyé (vérifiez le terminal en dev)')
            setTimeout(() => otpRefs.current[0]?.focus(), 100)
          },
          onError: (e: any) => {
            if (e?.response?.status === 429) toast.error("Trop de tentatives. Veuillez réessayer plus tard.")
            else toast.error('Impossible de renvoyer le code')
          },
        })
      } finally {
        setIsFirebaseSending(false)
      }
    }
    if (currentChannel === 'whatsapp') {
      sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
        onSuccess: () => { setCountdown(59); toast.success('Code renvoyé par WhatsApp'); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
        onError: (e: any) => { if (e?.response?.status === 429) toast.error("Trop de tentatives."); else sendSmsFallback() }
      })
    } else {
      sendSmsFallback()
    }
  }

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <div id="recaptcha-container"></div>

      {step === 1 ? (
        <>
          {/* Header */}
          <div className="px-6 pt-10 pb-2">
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1">Connectez-vous</h1>
            <p className="text-[13px] text-[#888888]">Entrez vos identifiants pour vous connecter</p>
          </div>

          {/* Content */}
          <div className="flex-1 px-6 pt-6 flex flex-col overflow-y-auto">

            {/* Phone */}
            <label className="text-[13px] text-[#666666] font-medium mb-2 block">Numéro de téléphone</label>
            <div className="flex gap-2 mb-5">
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowCountry(v => !v)}
                  className="flex items-center gap-1 px-3 py-3.5 border border-[#E5E5E5] rounded-xl bg-white text-[15px] font-medium whitespace-nowrap"
                >
                  <span>{country.flag}</span>
                  <span className="text-[#1A1A1A]">({country.code.replace('+', '')})</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#888888] ml-0.5" />
                </button>
                {showCountry && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-10 w-48">
                    {COUNTRIES.map(c => (
                      <button key={c.code} onClick={() => { setCountry(c); setShowCountry(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-left">
                        <span>{c.flag}</span>
                        <span className="text-[#1A1A1A]">{c.name}</span>
                        <span className="ml-auto text-[#888888]">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInit()}
                placeholder="XX XX XX XX"
                className="flex-1 min-w-0 px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A]"
              />
            </div>

            {/* Password */}
            <label className="text-[13px] text-[#666666] font-medium mb-2 block">Mot de passe</label>
            <div className="relative mb-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInit()}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white pr-12 text-[#1A1A1A]"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888888]">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="text-right mb-6">
              <button type="button" onClick={onForgotPassword} className="text-[13px] text-[#FF9F1C] font-medium">
                Mot de passe oublié?
              </button>
            </div>

            {/* Submit */}
            <button
              id="login-send-btn"
              onClick={handleInit}
              disabled={!phone.trim() || !password || initializing}
              className="w-full bg-[#FF9F1C] text-white py-[17px] rounded-full font-semibold text-[15px] mb-6 flex items-center justify-center gap-2 disabled:opacity-50 active:opacity-90"
            >
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Se connecter</span>
            </button>

            {/* Signup link */}
            <p className="text-center text-[13px] text-[#888888]">
              Si vous n'avez pas encore de compte{' '}
              <button onClick={onSignup} className="text-[#FF9F1C] font-semibold">Inscrivez-vous</button>
            </p>
          </div>
        </>
      ) : (
        <>
          {/* OTP Step */}
          <div className="px-6 pt-10 pb-2">
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1">Quel est le code reçu ?</h1>
            <p className="text-[13px] text-[#888888] leading-relaxed">
              Code à 6 chiffres envoyé par <strong className="text-[#1A1A1A]">{currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</strong> au{' '}
              <strong className="text-[#1A1A1A]">{maskPhone(fullPhone)}</strong>
            </p>
          </div>

          <div className="flex-1 px-6 pt-6 flex flex-col overflow-y-auto">
            {/* 6 OTP boxes */}
            <div className="grid grid-cols-6 gap-2 mb-4 w-full">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  id={`login-otp-${i}`}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors bg-white
                    ${d ? 'border-[#FF9F1C] text-[#1A1A1A]' : 'border-[#E5E5E5] text-[#1A1A1A]'}
                    focus:border-[#FF9F1C]`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 mb-8">
              <button
                onClick={handleResend}
                disabled={countdown > 0 || sending || isFirebaseSending}
                className="flex items-center gap-1.5 text-[13px] text-[#666666] disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {currentChannel === 'whatsapp' ? "Je n'ai rien reçu, renvoyer par SMS" : "Renvoyer le code"}
              </button>
              {countdown > 0 && (
                <span className="text-[13px] text-[#888888]">dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}</span>
              )}
            </div>

            <button
              id="login-verify-btn"
              onClick={handleLogin}
              disabled={otp.join('').length < 6 || logging || isFirebaseVerifying}
              className="w-full py-[17px] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition-colors disabled:bg-[#FFD99A] disabled:text-white bg-[#FF9F1C] text-white"
            >
              {(logging || isFirebaseVerifying) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Suivant</span>
            </button>
          </div>
        </>
      )}

      {/* Home indicator */}
      <div className="h-6 flex items-center justify-center pb-1 shrink-0">
        <div className="w-32 h-[4px] bg-[#1A1A1A] rounded-full" />
      </div>
    </div>
  )
}
