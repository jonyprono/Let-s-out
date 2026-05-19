import { useState, useRef, useEffect } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
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
  if (code === '+229') {
    return /^01\d{8}$/.test(cleanPhone) // 10 chiffres commençant par 01
  }
  if (code === '+225' || code === '+234') {
    return /^\d{10,11}$/.test(cleanPhone)
  }
  if (code === '+228' || code === '+221') {
    return /^\d{8,9}$/.test(cleanPhone)
  }
  return /^\d{8,15}$/.test(cleanPhone) // fallback
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
          const msg = typeof errData === 'string'
            ? errData
            : e?.message === 'Network Error'
              ? "Erreur réseau : serveur inaccessible"
              : `Erreur: ${e?.message || 'Inconnue'}`
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
      } catch (error) {
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
        // Firebase non configuré → fallback backend SMS OTP (affiché dans le terminal)
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear() } catch {}
          window.recaptchaVerifier = undefined
        }
        setConfirmationResult(null)
        sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
          onSuccess: () => {
            setCountdown(59)
            setCurrentChannel('sms')
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
        onSuccess: () => {
          setCountdown(59)
          toast.success('Code renvoyé par WhatsApp')
          setTimeout(() => otpRefs.current[0]?.focus(), 100)
        },
        onError: (e: any) => {
          if (e?.response?.status === 429) toast.error("Trop de tentatives. Veuillez réessayer plus tard.")
          else sendSmsFallback()
        }
      })
    } else {
      sendSmsFallback()
    }
  }

  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col">
      <div id="recaptcha-container"></div>
      {/* Status Bar */}
      {/* <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <span className="text-sm font-semibold">9:41</span>
        <div className="flex items-center gap-1.5">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><rect x="0" y="6" width="3" height="6" rx="1" fill="#111"/><rect x="4.5" y="4" width="3" height="8" rx="1" fill="#111"/><rect x="9" y="2" width="3" height="10" rx="1" fill="#111"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 11 0.5 8 0.5C5 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="#111"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.5 10.2 3.5 8 3.5C5.8 3.5 3.9 4.5 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="#111"/><circle cx="8" cy="10" r="1.5" fill="#111"/></svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#111" strokeOpacity="0.35"/><rect x="2" y="2" width="18" height="8" rx="2" fill="#111"/><path d="M23 4.5V7.5C23.8 7.2 24.5 6.5 24.5 6C24.5 5.5 23.8 4.8 23 4.5Z" fill="#111" fillOpacity="0.4"/></svg>
        </div>
      </div> */}

      <div className="flex-1 px-6 pt-8 flex flex-col overflow-y-auto">
        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-1">Connectez-vous</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Entrez vos identifiants pour vous connecter</p>

            {/* Phone field */}
            <label className="text-sm text-gray-600 mb-2 block">Numéro de téléphone</label>
            <div className="flex gap-2 mb-6">
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowCountry(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-3.5 border border-gray-200 dark:border-[#333333] rounded-xl bg-white dark:bg-[#1A1A1A] text-[16px] font-medium shrink-0 whitespace-nowrap"
                >
                  <span>{country.flag}</span>
                  <span className="text-gray-700 dark:text-gray-300">({country.code.replace('+', '')})</span>
                  <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showCountry && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333333] rounded-xl shadow-lg z-10 w-48">
                    {COUNTRIES.map(c => (
                      <button key={c.code} onClick={() => { setCountry(c); setShowCountry(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:bg-[#222222] text-sm text-left">
                        <span>{c.flag}</span>
                        <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                        <span className="ml-auto text-gray-400 dark:text-gray-500 dark:text-gray-400">{c.code}</span>
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
                className="flex-1 min-w-0 px-4 py-3.5 border border-gray-200 dark:border-[#333333] rounded-xl text-[16px] focus:outline-none focus:border-[#FF9F1C]"
              />
            </div>

            {/* Password field */}
            <label className="text-sm text-gray-600 mb-2 block">Mot de passe</label>
            <div className="relative mb-6">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInit()}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 border border-gray-200 dark:border-[#333333] rounded-xl text-[16px] focus:outline-none focus:border-[#FF9F1C] pr-12"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-400">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <button
              id="login-send-btn"
              onClick={handleInit}
              disabled={!phone.trim() || !password || initializing}
              className="w-full bg-[#1A1A1A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#1A1A1A] py-[18px] rounded-full font-bold mb-4 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98]"
            >
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Se connecter</span>
            </button>

            <div className="text-center -mt-1 mb-4">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 underline underline-offset-2"
              >
                Mot de passe oublié / Problème d'accès ?
              </button>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Si vous n'avez pas encore de compte{' '}
              <button onClick={onSignup} className="text-[#FF9F1C] font-semibold">Inscrivez-vous</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#FFFFFF] mb-1">Quel est le code reçu ?</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Code à 6 chiffres envoyé par <strong>{currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</strong> au <span className="text-gray-700 dark:text-gray-300">{maskPhone(fullPhone)}</span>
            </p>

            {/* 6 OTP boxes */}
            <div className="grid grid-cols-6 gap-1.5 mb-4 w-full">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  id={`login-otp-${i}`}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors ${d ? 'border-gray-800 dark:border-gray-400 bg-white dark:bg-[#1A1A1A]' : 'border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1A1A1A]'} focus:border-gray-800 dark:focus:border-gray-400 dark:border-gray-400`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 mb-8">
              <button
                onClick={handleResend}
                disabled={countdown > 0 || sending || isFirebaseSending}
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {currentChannel === 'whatsapp' ? "Je n'ai rien reçu, renvoyer par SMS" : "Renvoyer le code"}
              </button>
              {countdown > 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}</span>
              )}
            </div>

            <button
              id="login-verify-btn"
              onClick={handleLogin}
              disabled={otp.join('').length < 6 || logging || isFirebaseVerifying}
              className="w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-colors disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-[#333333] dark:disabled:text-gray-500 bg-[#1A1A1A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#1A1A1A]"
            >
              {(logging || isFirebaseVerifying) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Suivant</span>
            </button>

            <button onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']) }} className="text-center text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-4 w-full">
              ← Modifier le numéro
            </button>
          </>
        )}
      </div>

      <div className="h-8 flex items-center justify-center">
        <div className="w-32 h-1 bg-black dark:bg-[#FFFFFF] rounded-full" />
      </div>
    </div>
  )
}



