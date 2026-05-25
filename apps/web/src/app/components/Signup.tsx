import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Eye, EyeOff, Loader2, Check, MapPin, X, Calendar } from 'lucide-react'
import { useSendOtp, useRegister, useCheckTarget, useCheckOtp } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { apiClient } from '@/lib/api-client'

declare global {
  interface Window { recaptchaVerifier: any; }
}

interface SignupProps { onBack: () => void }

import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { CategoryChip } from '@/components/shared/CategoryChip'
import {
  authShell,
  authTitle,
  authHeader,
  authSubtitle,
  authLabel,
  authInput,
  authInputFlex,
  authChannelBtn,
  authChannelLabel,
} from '@/lib/auth-ui'

const INTERESTS_LIST = [
  'Social', 'Art & Culture', 'Bien-être & Santé',
  'Technologie', 'Science & Education',
  'Voyages', 'Lifestyle', 'Tourisme',
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

export function Signup({ onBack }: SignupProps) {
  const nav = useNavigate()

  // Steps:
  // 1=phone, 2=otp, 3=name, 4=birthday, 5=city, 6=interests, 7=password
  const [step, setStep] = useState(1)

  // Step 1 – Phone
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp' | ''>('')

  // Step 2 – OTP (6 digits)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 3 – Name
  const [firstName, setFirstName] = useState('')
  const [pseudo, setPseudo] = useState('')

  // Step 4 – Birthday
  const [birthday, setBirthday] = useState('')

  // Step 5 – City
  const [city, setCity] = useState('')

  // Step 6 – Interests
  const [interests, setInterests] = useState<string[]>([])

  // Step 7 – Password
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Firebase
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [idToken, setIdToken] = useState<string>('')
  const [isFirebaseSending, setIsFirebaseSending] = useState(false)
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false)

  const { mutate: checkTarget, isPending: checkingTarget } = useCheckTarget()
  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp()
  const { mutate: register, isPending: registering } = useRegister()
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp()

  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── Navigation ─────────────────────────────────────────────────
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
          if (data.exists) {
            toast.error('Numéro ou mot de passe incorrect. Veuillez vous connecter.')
          } else {
            if (currentChannel === 'sms') {
              try {
                setIsFirebaseSending(true)
                if (!window.recaptchaVerifier) {
                  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
                }
                const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
                setConfirmationResult(confirmation); setStep(2); setCountdown(59)
                setTimeout(() => otpRefs.current[0]?.focus(), 100)
              } catch {
                if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
                setConfirmationResult(null)
                sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
                  onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                  onError: (e: any) => { if (e?.response?.status === 429) toast.error('Trop de tentatives.'); else toast.error(e?.response?.data?.message || "Erreur d'envoi du code") },
                })
              } finally { setIsFirebaseSending(false) }
            } else {
              sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
                onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                onError: (e: any) => { if (e?.response?.status === 429) toast.error('Trop de tentatives.'); else toast.error(e?.response?.data?.message || "Erreur d'envoi") },
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
    } else if (step === 7) {
      // Final step: register
      const isFirebaseFlow = currentChannel === 'sms' && !!idToken
      register({
        target: fullPhone,
        code: isFirebaseFlow ? undefined : otp.join(''),
        idToken: isFirebaseFlow ? idToken : undefined,
        username: `${firstName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(Math.random() * 9999)}`,
        displayName: `${firstName} ${pseudo}`.trim(),
        password,
      }, {
        onSuccess: async () => {
          try {
            const profileData: any = { interests }
            if (birthday) profileData.birthdate = birthday
            if (city) profileData.city = city
            await apiClient.patch('/users/me/profile', profileData)
          } catch (e) { console.error('Background updates error:', e) }
          finally { localStorage.setItem('letsout_onboarding_done', 'true'); nav('/home') }
        },
        onError: (e: any) => {
          const msg = e.response?.data?.error || ''
          if (msg.includes('exists') || msg.includes('USER_ALREADY_EXISTS')) toast.error('Numéro de téléphone ou mot de passe incorrect. Veuillez vous connecter.')
          else if (msg.includes('OTP') || msg.includes('code') || msg.includes('expiré')) { toast.error('Code expiré. Veuillez recommencer.'); setStep(1) }
          else if (e.message === 'Network Error') toast.error('Erreur réseau : serveur inaccessible')
          else toast.error("Erreur lors de l'inscription")
        },
      })
    } else {
      setStep(s => s + 1)
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
      if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
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

  const toggleInterest = (interest: string) => {
    setInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest])
  }

  const pwdLength = password.length >= 6
  const pwdMixed = /[a-z]/.test(password) && /[A-Z]/.test(password)
  const pwdNumber = /[0-9]/.test(password)
  const pwdMatch = password === confirmPassword && password.length > 0
  const isPwdValid = pwdLength && pwdMixed && pwdNumber && pwdMatch

  const isNextDisabled = () => {
    if (step === 1) return !phone.trim() || !currentChannel || sendingOtp || checkingTarget || isFirebaseSending
    if (step === 2) return otp.join('').length < 6 || isFirebaseVerifying || checkingOtp
    if (step === 3) return !firstName.trim()
    if (step === 4) return false
    if (step === 5) return false
    if (step === 6) return interests.length === 0
    if (step === 7) return !isPwdValid || !acceptedTerms || registering
    return false
  }

  const isLoading = sendingOtp || registering || checkingTarget || isFirebaseSending || checkingOtp || isFirebaseVerifying

  const buttonLabel = () => {
    if (step === 7) return "Rejoindre Let's Out"
    return 'Suivant'
  }

  return (
    <div className={authShell}>
      <div id="recaptcha-container" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-0 shrink-0">
        <div className="flex items-center justify-center relative mb-1">
          <button onClick={handlePrev} className="absolute left-0 w-8 h-8 flex items-center justify-center active:opacity-70">
            <ChevronLeft className="w-5 h-5 text-foreground" strokeWidth={2.5} />
          </button>
          <span className={authHeader}>Inscription</span>
        </div>
        <div className="flex justify-center mt-1">
          <div className="w-10 h-[2.5px] bg-action-primary rounded-full" />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="flex-1 px-6 pt-7 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* ── STEP 1: PHONE ── */}
        {step === 1 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Quel est votre numéro de<br />téléphone&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Vous recevrez un code de vérification<br />pour confirmer votre numéro
            </p>

            <label className={`${authLabel} mb-1.5 block`}>Numéro de téléphone</label>
            <div className="flex gap-2 mb-6">
              <CountryPicker value={country} onChange={setCountry} />
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder=""
                className={`${authInputFlex} border-2`}
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
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? 'border-action-primary' : 'border-border-primary'}`}>
                      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-action-primary" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2: OTP (6 digits) ── */}
        {step === 2 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Quel est le code reçu&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Code à 6 chiffres envoyé par <strong className="text-foreground">{currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</strong> au<br />
              <strong className="text-foreground">{maskPhone(fullPhone) || '+229 01 97 00 00 00'}</strong>
            </p>

            <div className="grid grid-cols-6 gap-2 mb-5 w-full">
              {otp.map((d, i) => (
                <input
                  key={i} ref={el => { otpRefs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors bg-card text-foreground
                    ${d ? 'border-action-primary' : 'border-border-primary'}
                    focus:border-action-primary`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleResend} disabled={countdown > 0}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Renvoyer le code
              </button>
              {countdown > 0 && (
                <span className="text-[13px] text-muted-foreground">
                  dans {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: NAME ── */}
        {step === 3 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Quel est votre nom&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Ces informations aideront vos amis à vous reconnaître et ne<br />seront visibles que sur Let's Out.
            </p>
            <input
              type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="Nom complet"
              className={`${authInput} mb-4`}
            />
            <input
              type="text" value={pseudo} onChange={e => setPseudo(e.target.value)}
              placeholder="Pseudo"
              className={authInput}
            />
          </div>
        )}

        {/* ── STEP 4: BIRTHDAY ── */}
        {step === 4 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Et votre date d'anniversaire&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Cette information restera privée et nous aidera à<br />vous faire les meilleures suggestions<br />d'événements possibles.
            </p>
            <div className="relative">
              <input
                type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                className={`${authInput} pr-12 appearance-none ${birthday ? '' : 'text-muted-foreground'}`}
              />
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888] pointer-events-none" />
            </div>
          </div>
        )}

        {/* ── STEP 5: CITY ── */}
        {step === 5 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Dans quelle ville habitez-vous&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Indiquez votre ville pour trouver des événements et<br />rencontrer des amis près de vous.
            </p>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
              <input
                type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Sélectionnez une ville"
                className={`${authInput} pl-10 pr-10`}
              />
              {city && (
                <button onClick={() => setCity('')} className="absolute right-4 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-[#888888]" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 6: INTERESTS ── */}
        {step === 6 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>
              Quels sont vos centres d'intérêts&nbsp;?
            </h1>
            <p className={`${authSubtitle} mb-7`}>
              Indiquez au moins un centre d'intérêt afin d'obtenir<br />les meilleures recommandations d'activités pour<br />vous.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS_LIST.map(interest => (
                <CategoryChip
                  key={interest}
                  label={interest}
                  selected={interests.includes(interest)}
                  onClick={() => toggleInterest(interest)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 7: PASSWORD ── */}
        {step === 7 && (
          <div>
            <h1 className={`${authTitle} mb-1.5`}>Créez votre mot de passe</h1>
            <p className={`${authSubtitle} mb-7`}>
              Définissez un mot de passe robuste et sécurisé de<br />connexion à votre compte
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

      {/* ── Bottom Area ─────────────────────────────────── */}
      <div className="px-6 pb-5 pt-3 shrink-0 bg-background">
        {/* CGU — uniquement à l'étape 7 */}
        {step === 7 && (
          <label className="flex items-start gap-2.5 cursor-pointer mb-4"
            onClick={e => { e.preventDefault(); setAcceptedTerms(!acceptedTerms) }}>
            <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${acceptedTerms ? 'bg-action-primary border-action-primary' : 'border-border-primary bg-background-white'}`}>
              {acceptedTerms && <Check className="w-3 h-3 text-text-inverse" strokeWidth={3} />}
            </div>
            <span className="text-[12px] text-text-secondary leading-relaxed">
              Je certifie avoir plus de 18 ans. J'ai lu et j'accepte les{' '}
              <span className="text-action-primary font-semibold">Conditions d'Utilisation</span> de Let's Out
            </span>
          </label>
        )}
        <button
          onClick={handleNext}
          disabled={isNextDisabled()}
          className="auth-primary-btn w-full py-[17px] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-action-primary hover:bg-action-primary-hover text-text-inverse disabled:opacity-50"
        >
          {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          <span>{buttonLabel()}</span>
        </button>
      </div>

      {/* Home indicator */}
      <div className="h-6 flex items-center justify-center pb-1 shrink-0">
        <div className="w-32 h-[4px] bg-foreground rounded-full opacity-80" />
      </div>
    </div>
  )
}
