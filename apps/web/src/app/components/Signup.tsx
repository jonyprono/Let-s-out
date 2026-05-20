import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { useSendOtp, useRegister, useCheckTarget, useCheckOtp } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useDiscoverGroups, chatApi } from '@/features/chat/api'
import { useEvents } from '@/features/events/hooks/useEvents'
import { eventsApi } from '@/features/events/api'
import { apiClient } from '@/lib/api-client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

declare global {
  interface Window { recaptchaVerifier: any; }
}

interface SignupProps { onBack: () => void }

const COUNTRIES = [
  { flag: '🇧🇯', code: '+229', name: 'Bénin' },
  { flag: '🇹🇬', code: '+228', name: 'Togo' },
  { flag: '🇨🇮', code: '+225', name: "Côte d'Ivoire" },
  { flag: '🇸🇳', code: '+221', name: 'Sénégal' },
  { flag: '🇳🇬', code: '+234', name: 'Nigeria' },
  { flag: '🇫🇷', code: '+33', name: 'France' },
]

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
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [interests, setInterests] = useState<string[]>([])

  const [joinedGroups, setJoinedGroups] = useState<string[]>([])
  const [joinedEvents, setJoinedEvents] = useState<string[]>([])

  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [idToken, setIdToken] = useState<string>('')
  const [isFirebaseSending, setIsFirebaseSending] = useState(false)
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const { mutate: checkTarget, isPending: checkingTarget } = useCheckTarget()
  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp()
  const { mutate: register, isPending: registering } = useRegister()
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp()

  const { data: groupsData, isLoading: loadingGroups } = useDiscoverGroups(10)
  const { data: eventsData, isLoading: loadingEvents } = useEvents({ upcoming: true, limit: 10 })
  const groups = groupsData || []
  const events = eventsData?.data || []

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
          ? "Au Bénin, le numéro doit faire 10 chiffres et commencer par 01."
          : "Le format de votre numéro de téléphone est incorrect.")
      }
      checkTarget({ target: fullPhone }, {
        onSuccess: async ({ data }) => {
          if (data.exists) {
            toast.error("Ce numéro est déjà inscrit. Veuillez vous connecter.")
          } else {
            if (currentChannel === 'sms') {
              try {
                setIsFirebaseSending(true)
                if (!window.recaptchaVerifier) {
                  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
                }
                const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
                setConfirmationResult(confirmation)
                setStep(2); setCountdown(59)
                setTimeout(() => otpRefs.current[0]?.focus(), 100)
              } catch {
                if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear() } catch {} window.recaptchaVerifier = undefined }
                setConfirmationResult(null)
                sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
                  onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                  onError: (e: any) => { if (e?.response?.status === 429) toast.error("Trop de tentatives."); else toast.error(e?.response?.data?.message || "Erreur d'envoi du code") }
                })
              } finally { setIsFirebaseSending(false) }
            } else {
              sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
                onSuccess: () => { setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
                onError: (e: any) => { if (e?.response?.status === 429) toast.error("Trop de tentatives."); else toast.error(e?.response?.data?.message || "Erreur d'envoi") }
              })
            }
          }
        },
        onError: () => toast.error("Erreur de vérification du numéro")
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
        } catch { toast.error("Code SMS invalide ou expiré") }
        finally { setIsFirebaseVerifying(false) }
      } else {
        checkOtp({ target: fullPhone, code: codeStr }, {
          onSuccess: () => setStep(3),
          onError: () => toast.error("Code invalide ou expiré. Vérifiez et réessayez."),
        })
      }
    } else if (step === 7) {
      const isFirebaseFlow = currentChannel === 'sms' && !!idToken
      register({
        target: fullPhone,
        code: isFirebaseFlow ? undefined : otp.join(''),
        idToken: isFirebaseFlow ? idToken : undefined,
        username: `${firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(Math.random() * 9999)}`,
        displayName: `${firstName} ${lastName}`.trim(),
        password,
      }, {
        onSuccess: async () => {
          try {
            await apiClient.patch('/users/me/profile', { interests })
            if (joinedGroups.length > 0) await Promise.allSettled(joinedGroups.map(id => chatApi.joinGroup(id)))
            if (joinedEvents.length > 0) await Promise.allSettled(joinedEvents.map(id => eventsApi.join(id)))
          } catch (e) { console.error('Background updates error:', e) }
          finally { localStorage.setItem('letsout_onboarding_done', 'true'); nav('/home') }
        },
        onError: (e: any) => {
          const msg = e.response?.data?.error || ''
          if (msg.includes('exists') || msg.includes('USER_ALREADY_EXISTS')) toast.error('Ce numéro est déjà utilisé')
          else if (msg.includes('OTP') || msg.includes('code') || msg.includes('expiré')) { toast.error('Code expiré. Veuillez recommencer.'); setStep(1) }
          else if (e.message === 'Network Error') toast.error('Erreur réseau : serveur inaccessible')
          else toast.error("Erreur lors de l'inscription")
        }
      })
    } else {
      setStep(s => s + 1)
    }
  }

  const handlePrev = () => {
    if (step === 1) onBack()
    else setStep(s => s - 1)
  }

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
    if (step === 1) return !phone.trim() || sendingOtp || checkingTarget || isFirebaseSending
    if (step === 2) return otp.join('').length < 4 || isFirebaseVerifying || checkingOtp
    if (step === 3) return !isPwdValid || !acceptedTerms
    if (step === 4) return !firstName.trim() || !lastName.trim()
    if (step === 5) return interests.length === 0
    if (step === 6) return false
    if (step === 7) return registering
    return false
  }

  // ── Header with back button + "Inscription" title + orange underline ─────────
  const showHeader = step >= 1
  const stepLabels: Record<number, string> = {
    1: 'Inscription', 2: 'Inscription', 3: 'Inscription',
    4: 'Inscription', 5: 'Inscription', 6: 'Inscription', 7: 'Inscription',
  }


  return (
    <div className="w-full h-full bg-white flex flex-col">
      <div id="recaptcha-container"></div>

      {/* ── Header ─────────────────────────────────────────────── */}
      {showHeader && (
        <div className="px-5 pt-4 pb-0 shrink-0">
          <div className="flex items-center justify-center relative mb-1">
            <button
              onClick={handlePrev}
              className="absolute left-0 w-8 h-8 flex items-center justify-center active:opacity-70"
            >
              <ChevronLeft className="w-5 h-5 text-[#1A1A1A]" />
            </button>
            <span className="text-[15px] font-semibold text-[#1A1A1A]">{stepLabels[step] || 'Inscription'}</span>
          </div>
          {/* Orange underline */}
          <div className="flex justify-center mt-1">
            <div className="w-10 h-[2.5px] bg-[#FF9F1C] rounded-full" />
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 px-6 pt-6 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* STEP 1: PHONE */}
        {step === 1 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">
              Quel est votre numéro de<br />téléphone&nbsp;?
            </h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Vous recevrez un code de vérification<br />pour confirmer votre numéro
            </p>

            <label className="text-[13px] text-[#555555] font-medium mb-1.5 block">Numéro de téléphone</label>
            <div className="flex gap-2 mb-5">
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowCountry(!showCountry)}
                  className="flex items-center gap-1 px-3 py-3.5 border border-[#E5E5E5] rounded-xl bg-white text-[15px] font-medium whitespace-nowrap"
                >
                  <span>{country.flag}</span>
                  <span className="text-[#1A1A1A]">({country.code.replace('+', '')})</span>
                  <svg className="w-3 h-3 text-[#888888] ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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
                className="flex-1 min-w-0 px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A]"
              />
            </div>

            <label className="text-[13px] text-[#555555] font-medium mb-2 block">Recevoir le code par</label>
            <div className="flex gap-3">
              {['SMS', 'Whatsapp'].map(ch => {
                const val = ch.toLowerCase() as 'sms' | 'whatsapp'
                const isActive = currentChannel === val
                return (
                  <button key={ch} onClick={() => setCurrentChannel(val)}
                    className={`flex-1 flex items-center justify-between px-4 py-3.5 border rounded-xl bg-white transition-colors ${isActive ? 'border-[#E5E5E5]' : 'border-[#E5E5E5]'}`}
                  >
                    <span className="text-[15px] font-medium text-[#1A1A1A]">{ch}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-[#FF9F1C]' : 'border-[#CCCCCC]'}`}>
                      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 2: OTP (4 boxes as in designs) */}
        {step === 2 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">
              Quel est le code reçu&nbsp;?
            </h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Code à 4 chiffres envoyé par SMS au<br />
              <strong className="text-[#1A1A1A]">{maskPhone(fullPhone) || '+229 01 97 00 00 00'}</strong>
            </p>

            <div className="flex gap-3 mb-5 w-full">
              {otp.map((d, i) => (
                <input
                  key={i} ref={el => { otpRefs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className={`flex-1 aspect-square text-center text-[22px] font-bold border-2 rounded-xl focus:outline-none transition-colors bg-white
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
              {countdown > 0 && <span className="text-[13px] text-[#888888]">dans 00:{String(countdown).padStart(2, '0')}</span>}
            </div>
          </div>
        )}

        {/* STEP 3: PASSWORD */}
        {step === 3 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">Créez votre mot de passe</h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Définissez un mot de passe robuste et sécurisé de connexion à votre compte
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
            <div className="space-y-2 mb-6">
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

            {/* Terms checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer mb-2" onClick={e => { e.preventDefault(); setAcceptedTerms(!acceptedTerms) }}>
              <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${acceptedTerms ? 'bg-[#FF9F1C] border-[#FF9F1C]' : 'border-[#CCCCCC] bg-white'}`}>
                {acceptedTerms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[12px] text-[#555555] leading-relaxed">
                Je certifie avoir plus de 18 ans. J'ai lu et j'accepte les{' '}
                <span className="text-[#FF9F1C] font-semibold">Conditions d'Utilisation</span> de Let's Out
              </span>
            </label>
          </div>
        )}

        {/* STEP 4: NAME */}
        {step === 4 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">Quel est votre nom&nbsp;?</h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Ces informations aideront vos amis à vous reconnaître et ne seront visibles que sur Let's Out.
            </p>
            <input
              type="text" value={`${firstName} ${lastName}`.trim() ? firstName + ' ' + lastName : ''}
              onChange={e => {
                const parts = e.target.value.split(' ')
                setFirstName(parts[0] || '')
                setLastName(parts.slice(1).join(' ') || '')
              }}
              placeholder="Nom complet"
              className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A] mb-4 placeholder-[#BBBBBB]"
            />
            <input
              type="text" value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Pseudo"
              className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A] placeholder-[#BBBBBB]"
            />
          </div>
        )}

        {/* STEP 5: INTERESTS */}
        {step === 5 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">Quels sont vos centres d'intérêts&nbsp;?</h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Indiquez au moins un centre d'intérêt afin d'obtenir les meilleures recommandations d'activités pour vous.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS_LIST.map(interest => {
                const isSelected = interests.includes(interest)
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-all ${isSelected ? 'bg-[#FF9F1C] border-[#FF9F1C] text-white' : 'bg-white border-[#E5E5E5] text-[#1A1A1A]'}`}
                  >
                    {interest}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 6: GROUPS */}
        {step === 6 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">Quelques groupes pour vous</h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Basé sur vos centres d'intérêts, voici quelques groupes qui pourraient vous intéresser
            </p>
            {loadingGroups ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#888888]" /></div>
            ) : (
              <div className="space-y-3">
                {groups.map(g => {
                  const isJoined = joinedGroups.includes(g.id)
                  return (
                    <div key={g.id} className="bg-white border border-[#F0F0F0] rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                      {g.avatarUrl ? (
                        <img src={g.avatarUrl} alt={g.name || 'Group'} className="w-14 h-14 bg-gray-100 rounded-xl shrink-0 object-cover" />
                      ) : (
                        <div className="w-14 h-14 bg-gray-100 rounded-xl shrink-0 flex items-center justify-center">
                          <span className="text-[#888888] text-lg font-bold">{(g.name || 'G').charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-bold text-[#1A1A1A] truncate">{g.name}</h3>
                        <p className="text-[12px] text-[#888888] truncate mt-0.5">{(g as any)._count?.members || 0} membres</p>
                      </div>
                      <button
                        onClick={() => setJoinedGroups(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                        className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors shrink-0 ${isJoined ? 'bg-transparent border border-[#E5E5E5] text-[#888888]' : 'bg-[#FF9F1C] text-white border border-[#FF9F1C]'}`}
                      >
                        {isJoined ? 'Rejoint' : 'Rejoindre'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 7: EVENTS */}
        {step === 7 && (
          <div>
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5 leading-tight">Événements à venir</h1>
            <p className="text-[13px] text-[#888888] mb-7 leading-relaxed">
              Voici quelques événements à venir qui pourraient vous intéresser.
            </p>
            {loadingEvents ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#888888]" /></div>
            ) : events.length === 0 ? (
              <p className="text-[#888888] text-sm text-center">Aucun événement à venir trouvé.</p>
            ) : (
              <div className="space-y-4">
                {events.map(event => {
                  const isJoined = joinedEvents.includes(event.id)
                  let dateStr = ''
                  try { dateStr = format(new Date(event.startAt), "EEE, d MMM • HH:mm", { locale: fr }) } catch {}
                  return (
                    <div key={event.id} className="bg-white rounded-2xl overflow-hidden border border-[#F0F0F0] shadow-sm">
                      {event.coverUrl ? (
                        <img src={event.coverUrl} className="h-32 w-full object-cover" alt="Cover" />
                      ) : (
                        <div className="h-32 bg-gray-100 w-full" />
                      )}
                      <div className="p-4">
                        <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-1">{event.title}</h3>
                        <p className="text-[12px] text-[#888888] mb-3">{dateStr} {event.city ? `• ${event.city}` : ''}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#888888]">{event.currentAttendees} Participants</span>
                          <button
                            onClick={() => setJoinedEvents(prev => prev.includes(event.id) ? prev.filter(x => x !== event.id) : [...prev, event.id])}
                            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${isJoined ? 'bg-transparent border border-[#E5E5E5] text-[#888888]' : 'bg-[#FF9F1C] text-white border border-[#FF9F1C]'}`}
                          >
                            {isJoined ? 'Participé' : 'Participer'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Button ─────────────────────────────────────────── */}
      <div className="px-6 pb-5 pt-3 shrink-0 bg-white">
        <button
          onClick={handleNext}
          disabled={isNextDisabled()}
          className="w-full py-[17px] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:opacity-90 bg-[#FF9F1C] text-white disabled:bg-[#FFD99A] disabled:text-white"
        >
          {(sendingOtp || registering || checkingTarget || isFirebaseSending || checkingOtp || isFirebaseVerifying) && <Loader2 className="w-5 h-5 animate-spin" />}
          <span>{step === 3 ? 'Rejoindre Let\'s Out' : 'Suivant'}</span>
        </button>
      </div>

      {/* Home indicator */}
      <div className="h-6 flex items-center justify-center pb-1 shrink-0">
        <div className="w-32 h-[4px] bg-[#1A1A1A] rounded-full" />
      </div>
    </div>
  )
}
