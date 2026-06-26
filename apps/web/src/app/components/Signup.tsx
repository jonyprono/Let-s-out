import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import {
  ArrowLeft01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  Tick01Icon,
  Location01Icon,
  Cancel01Icon,
  Calendar01Icon,
  RefreshIcon,
} from 'hugeicons-react'
import {
  useSendOtp,
  useRegister,
  useCheckTarget,
  useCheckOtp,
} from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { apiClient } from '@/lib/api-client'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

declare global {
  interface Window {
    recaptchaVerifier: any
  }
}

interface SignupProps {
  onBack: () => void
}

import { COUNTRIES, Country } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { PhoneInputField } from '@/components/shared/PhoneInputField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'

const INTERESTS_LIST = [
  'Social',
  'Art & Culture',
  'Bien-être & Santé',
  'Technologie',
  'Science & Education',
  'Voyages',
  'Lifestyle',
  'Tourisme',
]

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

const TOTAL_STEPS = 7

export function Signup({ onBack }: SignupProps) {
  const nav = useNavigate()
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const isGoogleMode = queryParams.get('mode') === 'google'

  // Steps: 1=phone, 2=otp, 3=name, 4=birthday, 5=city, 6=interests, 7=password
  const [step, setStep] = useState(isGoogleMode ? 3 : 1)

  // Step 1 – Phone
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const {
    displayValue: phoneDisplay,
    rawValue: phone,
    handleChange: handlePhoneChange,
    reset: resetPhone,
  } = usePhoneFormatter()
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp' | ''>('')

  // Step 2 – OTP (6 digits — Firebase requires 6)
  const OTP_LENGTH = 6
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 3 – Name
  const [firstName, setFirstName] = useState('')
  const [pseudo, setPseudo] = useState('')

  // Step 4 – Birthday
  const [birthday, setBirthday] = useState('')
  const [birthdayText, setBirthdayText] = useState('')

  // Step 5 – City
  const [city, setCity] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<{ label: string }[]>([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const [citySearching, setCitySearching] = useState(false)

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
  const [nativeVerificationId, setNativeVerificationId] = useState<string>('')
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
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  /* ── City autocomplete — Nominatim ── */
  useEffect(() => {
    if (!city || city.length < 2) {
      setCitySuggestions([])
      setShowCitySuggestions(false)
      return
    }
    const timer = setTimeout(async () => {
      setCitySearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=7&addressdetails=1&featuretype=city`,
          { headers: { 'Accept-Language': 'fr', 'User-Agent': 'LetsOutApp/1.0' } }
        )
        const data = await res.json()
        const seen = new Set<string>()
        const results = (data as any[])
          .map((item: any) => {
            const name =
              item.address?.city ||
              item.address?.town ||
              item.address?.village ||
              item.address?.municipality ||
              item.name
            const cc = (item.address?.country_code ?? '').toUpperCase()
            return name ? `${name}, ${cc}` : null
          })
          .filter((v): v is string => !!v && !seen.has(v) && !!seen.add(v))
          .slice(0, 5)
          .map((label) => ({ label }))
        setCitySuggestions(results)
        setShowCitySuggestions(results.length > 0)
      } catch {
        setCitySuggestions([])
      } finally {
        setCitySearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [city])

  // ── Navigation ─────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 1) {
      if (!phone.trim()) return
      if (!currentChannel) {
        toast.error('Veuillez sélectionner SMS ou Whatsapp.')
        return
      }
      if (!validatePhone(country.code, phone)) {
        return toast.error(
          country.code === '+229'
            ? 'Au Bénin, le numéro doit faire 10 chiffres et commencer par 01.'
            : 'Le format de votre numéro de téléphone est incorrect.'
        )
      }
      checkTarget({ target: fullPhone }, {
        onSuccess: async ({ data }) => {
          if (data.exists) {
            toast.error('Numéro ou mot de passe incorrect. Veuillez vous connecter.')
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
                  if (!window.recaptchaVerifier) {
                    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
                  }
                  const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
                  setConfirmationResult(confirmation); setStep(2); setCountdown(59)
                  setTimeout(() => otpRefs.current[0]?.focus(), 100)
                }
              } catch (err: any) {
                console.error('Firebase sending error:', err)
                toast.error(`[Firebase Error] ${err?.message || err}`)
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
    } else if (step === 4) {
      if (birthday) {
        const birthDate = new Date(birthday)
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const m = today.getMonth() - birthDate.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
        if (age < 18) {
          toast.error("Vous devez avoir au moins 18 ans pour vous inscrire.")
          return
        }
      }
      setStep((s) => s + 1)
    } else if (step === 7) {
      if (isGoogleMode) {
        setIsFirebaseVerifying(true)
        try {
          const profileData: any = { interests, displayName: `${firstName} ${pseudo}`.trim() }
          if (birthday) profileData.birthdate = birthday
          if (city) profileData.city = city
          await apiClient.patch('/users/me/profile', profileData)
          await apiClient.patch('/users/me/password', { newPassword: password })
          localStorage.setItem('letsout_onboarding_done', 'true')
          nav('/home')
        } catch (e: any) {
          toast.error(e?.response?.data?.error || "Erreur lors de l'enregistrement")
        } finally {
          setIsFirebaseVerifying(false)
        }
      } else {
        const isFirebaseFlow = currentChannel === 'sms' && (!!idToken || !!nativeVerificationId)
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
      }
    } else {
      setStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (step === 1) onBack()
    else setStep((s) => s - 1)
  }

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
    if (v && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
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
        toast.success('Code renvoyé par SMS')
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
        }
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
        setConfirmationResult(confirmation); setCountdown(59)
        toast.success('Code renvoyé par SMS')
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      }
    } catch {
      if (!Capacitor.isNativePlatform() && window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear() } catch {}
        window.recaptchaVerifier = undefined
      }
      setConfirmationResult(null)
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => { setCountdown(59); toast.success('Code renvoyé'); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
        onError: () => toast.error('Impossible de renvoyer le code'),
      })
    } finally { setIsFirebaseSending(false) }
  }

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    )
  }

  const pwdLength = password.length >= 6
  const pwdMixed = /[a-z]/.test(password) && /[A-Z]/.test(password)
  const pwdNumber = /[0-9]/.test(password)
  const pwdMatch = password === confirmPassword && password.length > 0
  const isPwdValid = pwdLength && pwdMixed && pwdNumber && pwdMatch

  const isNextDisabled = () => {
    if (!isGoogleMode && step === 1) return !phone.trim() || !currentChannel || sendingOtp || checkingTarget || isFirebaseSending
    if (!isGoogleMode && step === 2) return otp.join('').length < OTP_LENGTH || isFirebaseVerifying || checkingOtp
    if (step === 3) return !firstName.trim()
    if (step === 4) return false
    if (step === 5) return false
    if (step === 6) return interests.length === 0
    if (step === 7) return !isPwdValid || !acceptedTerms || registering
    return false
  }

  const isLoading = sendingOtp || registering || checkingTarget || isFirebaseSending || checkingOtp || isFirebaseVerifying

  const buttonLabel = step === 7 ? "Rejoindre Let's Out" : 'Suivant'

  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-background-primary)] text-[var(--color-text-primary)] overflow-hidden relative">
      <div id="recaptcha-container" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-0 shrink-0">
        {/* Titre "Inscription" centré avec flèche retour */}
        <div className="flex items-center justify-center relative mb-3">
          <button
            onClick={handlePrev}
            aria-label="Retour"
            className="absolute left-0 w-9 h-9 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft01Icon className="w-5 h-5 text-[var(--color-text-primary)]" strokeWidth={2} />
          </button>
          <span className="font-poppins text-[15px] font-semibold text-[var(--color-text-primary)]">
            Inscription
          </span>
        </div>

        {/* Barre de progression orange fine — sous le header */}
        <ProgressBar value={step} max={TOTAL_STEPS} className="h-[3px] rounded-none" />
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div
        className="flex-1 px-5 pt-7 overflow-y-auto pb-4"
        style={{ scrollbarWidth: 'none' }}
      >

        {/* ── STEP 1: PHONE ── */}
        {!isGoogleMode && step === 1 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Quel est votre numéro de téléphone&nbsp;?
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Vous recevrez un code de vérification<br />pour confirmer votre numéro
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
                    className={`flex-1 flex items-center justify-between px-4 h-[52px] rounded-[12px] border transition-colors gap-2 ${
                      isActive
                        ? 'border-[var(--brand-orange-500)] bg-white'
                        : 'border-[var(--border-default)] bg-white'
                    }`}
                  >
                    <span className="font-poppins text-[15px] font-medium text-[var(--color-text-primary)]">
                      {ch}
                    </span>
                    {/* Radio indicator */}
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
        {!isGoogleMode && step === 2 && (
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

            {/* OTP boxes — same width for all */}
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
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
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

        {/* ── STEP 3: NAME ── */}
        {step === 3 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Quel est votre nom&nbsp;?
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Ces informations aideront vos amis à vous reconnaître et ne seront visibles que sur Let's Out.
            </p>
            <div className="flex flex-col gap-4">
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nom complet"
              />
              <Input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="Pseudo"
              />
            </div>
          </div>
        )}

        {/* ── STEP 4: BIRTHDAY ── */}
        {step === 4 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Et votre date d'anniversaire&nbsp;?
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Cette information restera privée et nous aidera à vous faire les meilleures suggestions d'événements possibles.
            </p>

            <div className="relative">
              <Input
                type="text"
                value={birthdayText}
                onChange={(e) => {
                  setBirthdayText(e.target.value)
                  const match = e.target.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
                  if (match) {
                    setBirthday(`${match[3]}-${match[2]}-${match[1]}`)
                  } else {
                    setBirthday('')
                  }
                }}
                placeholder="Sélectionnez une date"
                icon={
                  <button
                    type="button"
                    onClick={() => (document.getElementById('birthday-native') as HTMLInputElement)?.showPicker?.()}
                    className="focus:outline-none text-[var(--color-icon-secondary)]"
                  >
                    <Calendar01Icon size={18} strokeWidth={1.5} />
                  </button>
                }
              />
              <input
                type="date"
                id="birthday-native"
                value={birthday}
                onChange={(e) => {
                  setBirthday(e.target.value)
                  if (e.target.value) {
                    const d = new Date(e.target.value + 'T00:00:00')
                    setBirthdayText(
                      d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                    )
                  }
                }}
                className="sr-only"
              />
            </div>
          </div>
        )}

        {/* ── STEP 5: CITY ── */}
        {step === 5 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Dans quelle ville habitez-vous&nbsp;?
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Indiquez votre ville pour trouver des événements et rencontrer des amis près de vous.
            </p>

            <div className="relative">
              <Input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  if (!e.target.value) {
                    setCitySuggestions([])
                    setShowCitySuggestions(false)
                  }
                }}
                onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                placeholder="Sélectionnez une ville"
                icon={
                  city ? (
                    <button
                      type="button"
                      onClick={() => { setCity(''); setCitySuggestions([]); setShowCitySuggestions(false) }}
                      className="focus:outline-none text-[var(--color-icon-secondary)]"
                    >
                      <Cancel01Icon size={18} strokeWidth={1.5} />
                    </button>
                  ) : (
                    <Location01Icon size={18} strokeWidth={1.5} className="text-[var(--color-icon-secondary)]" />
                  )
                }
              />

              {/* Dropdown suggestions */}
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-[16px] border border-[var(--border-default)] shadow-lg z-50 overflow-hidden bg-white">
                  {citySearching && (
                    <div className="px-4 py-3 font-poppins text-[13px] text-[var(--color-text-secondary)]">
                      Recherche...
                    </div>
                  )}
                  {citySuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={() => {
                        setCity(s.label)
                        setCitySuggestions([])
                        setShowCitySuggestions(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA] active:bg-[#F2F2F2]"
                      style={{
                        borderBottom: idx < citySuggestions.length - 1 ? '1px solid var(--border-default)' : 'none',
                      }}
                    >
                      <Location01Icon
                        width={16}
                        height={16}
                        strokeWidth={1.2}
                        className="text-[var(--color-icon-secondary)] shrink-0"
                      />
                      <span className="font-poppins text-[14px] text-[var(--color-text-primary)]">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 6: INTERESTS ── */}
        {step === 6 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Quels sont vos centres d'intérêts&nbsp;?
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
              Indiquez au moins un centre d'intérêt afin d'obtenir les meilleures recommandations d'activités pour vous.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS_LIST.map((interest) => {
                const selected = interests.includes(interest)
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-full font-poppins text-[14px] font-medium transition-colors ${
                      selected
                        ? 'bg-[var(--brand-orange-500)] text-white'
                        : 'bg-[#F5F5F5] text-[var(--color-text-primary)]'
                    }`}
                  >
                    {interest}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STEP 7: PASSWORD ── */}
        {step === 7 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-[var(--color-text-primary)] mb-2">
              Créez votre mot de passe
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-[var(--color-text-secondary)] mb-7">
              Définissez un mot de passe robuste et sécurisé de connexion à votre compte
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
                        ? <ViewIcon size={18} strokeWidth={1.5} />
                        : <ViewOffSlashIcon size={18} strokeWidth={1.5} />}
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
                        ? <ViewIcon size={18} strokeWidth={1.5} />
                        : <ViewOffSlashIcon size={18} strokeWidth={1.5} />}
                    </button>
                  }
                />
              </div>
            </div>

            {/* Critères de validation */}
            <div className="space-y-2 mb-2">
              {[
                { ok: pwdLength, label: 'Au moins 6 caractères numériques' },
                { ok: pwdMixed, label: 'Au moins 1 majuscule et 1 minuscule' },
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

      {/* ── Bottom Area ─────────────────────────────────── */}
      <div className="px-5 pb-6 pt-3 shrink-0 bg-[var(--color-background-primary)]">
        {/* CGU — uniquement à l'étape 7 */}
        {step === 7 && (
          <div
            className="flex items-start gap-3 cursor-pointer mb-5"
            onClick={() => setAcceptedTerms(!acceptedTerms)}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                acceptedTerms
                  ? 'bg-[var(--brand-orange-500)] border-[var(--brand-orange-500)]'
                  : 'border-[var(--border-default)] bg-white'
              }`}
            >
              {acceptedTerms && (
                <Tick01Icon width={12} height={12} strokeWidth={2.5} className="text-white" />
              )}
            </div>
            <span className="font-poppins text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
              Je certifie avoir plus de 18 ans. J'ai lu et j'accepte les{' '}
              <span className="text-[var(--brand-orange-500)] font-semibold">
                Conditions d'Utilisation
              </span>{' '}
              de Let's Out.
            </span>
          </div>
        )}

        <Button
          onClick={handleNext}
          disabled={isNextDisabled()}
          className="w-full"
        >
          {isLoading && (
            <RefreshIcon
              width={20}
              height={20}
              strokeWidth={1.4}
              className="animate-spin shrink-0 mr-2"
            />
          )}
          <span className="break-words max-w-full">{buttonLabel}</span>
        </Button>
      </div>
    </div>
  )
}
