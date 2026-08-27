import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import {
  ViewIcon,
  ViewOffSlashIcon,
  Tick01Icon,
  Location01Icon,
  Cancel01Icon,
  Calendar01Icon,
} from 'hugeicons-react'
import { BackButton } from '@/components/ui/BackButton';
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
import { useAuthStore } from '@/stores/auth.store'

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
import { CategoryChip } from '@/components/shared/CategoryChip'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { Input } from '@/components/ui/input'
import { isFieldValid } from '@/lib/validation'
import { ProgressBar } from '@/components/ui/progress-bar'
import { otpLogger } from '@/lib/auth-logger'
import { useTranslation } from 'react-i18next'

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


export function Signup({ onBack }: SignupProps) {
  const { t } = useTranslation()
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
  const currentUser = useAuthStore((s) => s.user)
  const defaultDisplayName = isGoogleMode && currentUser?.profile?.displayName ? currentUser.profile.displayName : ''
  const defaultFirstName = defaultDisplayName.split(' ')[0] || ''
  const defaultPseudo = defaultDisplayName.split(' ').slice(1).join(' ') || ''

  const [firstName, setFirstName] = useState(defaultFirstName)
  const [pseudo, setPseudo] = useState(defaultPseudo)

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
  // Tracks exactly which channel sent the LAST code — prevents stale Firebase session from
  // intercepting a verification that should go through the backend (the root cause of OTP bugs)
  const [lastCodeVia, setLastCodeVia] = useState<'firebase' | 'backend' | null>(null)

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
    if (!city || city.length < 1) {
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
        toast.error(t('signup.errorSelectChannel'))
        return
      }
      const phoneValid = validatePhone(country.code, phone)
      otpLogger.phoneValidation(phoneValid, country.code)
      if (!phoneValid) {
        return toast.error(
          country.code === '+229'
            ? t('signup.errorBenin')
            : t('signup.errorPhone')
        )
      }
      const triggerOtpSend = async () => {
        if (currentChannel === 'sms') {
          try {
            setIsFirebaseSending(true)
            otpLogger.sendStart(fullPhone, 'sms')
            if (Capacitor.isNativePlatform()) {
              otpLogger.sendRequest('sms')
              const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
                otpLogger.sendSuccess('sms', `verificationId reçu: ${event.verificationId?.slice(0, 20)}...`)
                setNativeVerificationId(event.verificationId)
                setLastCodeVia('firebase')
              })
              await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone })
              setStep(2); setCountdown(59)
              setTimeout(() => otpRefs.current[0]?.focus(), 100)
              setTimeout(() => listener.remove(), 60000)
            } else {
              if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
              }
              otpLogger.sendRequest('sms')
              const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
              otpLogger.sendSuccess('sms', 'Confirmation Firebase Web reçue')
              setConfirmationResult(confirmation)
              setLastCodeVia('firebase')
              setStep(2); setCountdown(59)
              setTimeout(() => otpRefs.current[0]?.focus(), 100)
            }
          } catch (err: any) {
            otpLogger.sendError(err)
            toast.error(`[Firebase Error] ${err?.message || err}`)
            // CRITICAL: Clear ALL Firebase state before falling back to backend
            // Leaving stale nativeVerificationId or confirmationResult would cause
            // the verification step to use Firebase even though code came from backend
            setConfirmationResult(null)
            setNativeVerificationId('')
            setLastCodeVia('backend')
            // Fallback: envoyer via backend
            otpLogger.sendRequest('sms')
            sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
              onSuccess: () => {
                otpLogger.sendSuccess('sms', 'Fallback backend SMS envoyé avec succès')
                setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100)
              },
              onError: (e: any) => {
                otpLogger.sendError(e)
                if (e?.response?.status === 429) toast.error('Trop de tentatives.')
                else toast.error(e?.response?.data?.message || t('signup.errorResend'))
              },
            })
          } finally { setIsFirebaseSending(false) }
        } else {
          // WhatsApp OTP — always backend
          otpLogger.sendStart(fullPhone, 'whatsapp')
          otpLogger.sendRequest('whatsapp')
          setLastCodeVia('backend')
          sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
            onSuccess: () => {
              otpLogger.sendSuccess('whatsapp', 'OTP WhatsApp envoyé avec succès')
              setStep(2); setCountdown(59); setTimeout(() => otpRefs.current[0]?.focus(), 100)
            },
            onError: (e: any) => {
              otpLogger.sendError(e)
              if (e?.response?.status === 429) toast.error('Trop de tentatives.')
              else toast.error(e?.response?.data?.message || "Erreur d'envoi")
            },
          })
        }
      }

      checkTarget({ target: fullPhone }, {
        onSuccess: async ({ data }) => {
          if (data.exists) {
            toast.error('Numéro ou mot de passe incorrect. Veuillez vous connecter.')
          } else {
            triggerOtpSend()
          }
        },
        onError: () => {
          // If checkTarget fails (e.g. 404 Not Found), it means the user doesn't exist, which is good for signup!
          triggerOtpSend()
        },
      })
    } else if (step === 2) {
      const codeStr = otp.join('')
      if (codeStr.length < OTP_LENGTH) return
      otpLogger.verifyStart(fullPhone)
      // Use lastCodeVia to determine the EXACT path — prevents stale Firebase session
      // from hijacking a verification that should go to backend (the OTP bug root cause)
      const useFirebasePath = lastCodeVia === 'firebase' && (confirmationResult || nativeVerificationId)
      if (useFirebasePath) {
        setIsFirebaseVerifying(true)
        try {
          otpLogger.verifyRequest()
          if (Capacitor.isNativePlatform() && nativeVerificationId) {
            await FirebaseAuthentication.confirmVerificationCode({
              verificationId: nativeVerificationId,
              verificationCode: codeStr,
            })
            const tokenResult = await FirebaseAuthentication.getIdToken()
            if (tokenResult.token) setIdToken(tokenResult.token)
            otpLogger.verifySuccess()
            setStep(3)
          } else if (confirmationResult) {
            const result = await confirmationResult.confirm(codeStr)
            const token = await result.user.getIdToken()
            otpLogger.verifySuccess()
            setIdToken(token); setStep(3)
          }
        } catch (err: unknown) {
          otpLogger.verifyError(err)
          toast.error(t('signup.errorSmsOtp'))
        }
        finally { setIsFirebaseVerifying(false) }
      } else {
        // Vérification via backend (WhatsApp, fallback SMS, ou lastCodeVia=backend)
        otpLogger.verifyRequest()
        checkOtp({ target: fullPhone, code: codeStr }, {
          onSuccess: () => { otpLogger.verifySuccess(); setStep(3) },
          onError: (err: unknown) => { otpLogger.verifyError(err); toast.error(t('signup.errorOtp')) },
        })
      }
    } else if (step === 4) {
      if (!birthday) {
        toast.error(t('signup.errorBirthdate'))
        return
      }
      const birthDate = new Date(birthday)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const m = today.getMonth() - birthDate.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
      if (age < 18) {
        toast.error(t('signup.errorAge'))
        return
      }
      setStep((s) => s + 1)
    } else if (step === 6) {
      if (isGoogleMode) {
        setIsFirebaseVerifying(true)
        try {
          const profileData: any = { interests, displayName: `${firstName} ${pseudo}`.trim() }
          if (birthday) profileData.birthdate = birthday
          if (city) profileData.city = city
          await apiClient.patch('/users/me/profile', profileData)
          localStorage.setItem('letsout_onboarding_done', 'true')
          localStorage.removeItem('pending_google_signup')
          nav('/home')
        } catch (e: any) {
          toast.error(e?.response?.data?.error || t('signup.errorSaving'))
        } finally {
          setIsFirebaseVerifying(false)
        }
      } else {
        setStep((s) => s + 1)
      }
    } else if (step === 7) {
      if (!isGoogleMode) {
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
            if (msg.includes('exists') || msg.includes('USER_ALREADY_EXISTS')) toast.error(t('signup.errorExists'))
            else if (msg.includes('OTP') || msg.includes('code') || msg.includes('expiré')) { toast.error(t('signup.errorCodeExpired')); setStep(1) }
            else if (e.message === 'Network Error') toast.error(t('signup.errorNetwork'))
            else toast.error(t('signup.errorRegistration'))
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
      otpLogger.sendStart(fullPhone, 'sms')
      if (Capacitor.isNativePlatform()) {
        otpLogger.sendRequest('sms')
        const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
          otpLogger.sendSuccess('sms', `[Resend] verificationId: ${event.verificationId?.slice(0, 20)}...`)
          setNativeVerificationId(event.verificationId)
          setLastCodeVia('firebase')
        })
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone })
        setTimeout(() => listener.remove(), 60000)
        setCountdown(59)
        toast.success(t('signup.successResend'))
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
        }
        otpLogger.sendRequest('sms')
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
        otpLogger.sendSuccess('sms', '[Resend] Confirmation Firebase Web')
        setConfirmationResult(confirmation)
        setLastCodeVia('firebase')
        setCountdown(59)
        toast.success(t('signup.successResend'))
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      }
    } catch (err: unknown) {
      otpLogger.sendError(err)
      if (!Capacitor.isNativePlatform() && window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear() } catch {}
        window.recaptchaVerifier = undefined
      }
      // CRITICAL: Clear ALL Firebase state — same fix as triggerOtpSend fallback
      setConfirmationResult(null)
      setNativeVerificationId('')
      setLastCodeVia('backend')
      otpLogger.sendRequest('sms')
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => { otpLogger.sendSuccess('sms', '[Resend fallback] Backend SMS'); setCountdown(59); toast.success(t('signup.successResendAlt')); setTimeout(() => otpRefs.current[0]?.focus(), 100) },
        onError: (e: unknown) => { otpLogger.sendError(e); toast.error(t('signup.errorResend')) },
      })
    } finally { setIsFirebaseSending(false) }
  }

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    )
  }

  const pwdLength = password.length >= 6
  const hasLower = /[a-zà-ÿ]/.test(password)
  const hasUpper = /[A-ZÀ-Ÿ]/.test(password)
  const pwdNumber = /[0-9]/.test(password)
  const pwdMatch = password === confirmPassword && password.length > 0
  const isPwdValid = pwdLength && hasLower && hasUpper && pwdNumber && pwdMatch

  const isNextDisabled = () => {
    if (!isGoogleMode && step === 1) return !phone.trim() || !currentChannel || sendingOtp || checkingTarget || isFirebaseSending
    if (!isGoogleMode && step === 2) return otp.join('').length < OTP_LENGTH || isFirebaseVerifying || checkingOtp
    if (step === 3) return !isFieldValid(firstName)
    if (step === 4) {
      if (!birthday) return true
      const birthDate = new Date(birthday)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const m = today.getMonth() - birthDate.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
      return age < 18
    }
    if (step === 5) return false
    if (step === 6) return interests.length === 0
    if (step === 7) return !isPwdValid || !acceptedTerms || registering
    return false
  }

  const isLoading = sendingOtp || registering || checkingTarget || isFirebaseSending || checkingOtp || isFirebaseVerifying

  const buttonLabel = (isGoogleMode && step === 6) || step === 7 ? t('signup.buttonJoin') : t('signup.buttonNext')

  return (
    <div className="w-full h-full flex flex-col flex-1 bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden relative">
      <div id="recaptcha-container" />

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-0 shrink-0">
        {/* Titre "Inscription" centré avec flèche retour */}
        <div className="flex items-center justify-center relative mb-3">
          <BackButton
            onClick={handlePrev}
            aria-label="Retour"
            className="absolute left-0 shrink-0"
          />
          <span className="font-poppins text-[15px] font-semibold text-gray-900 dark:text-white">
            {t('signup.title')}
          </span>
        </div>

        {/* Barre de progression orange fine — sous le header */}
        <ProgressBar value={step} max={isGoogleMode ? 6 : 7} className="h-[3px] rounded-none" />
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div
        className="flex-1 px-5 pt-7 overflow-y-auto pb-4"
        style={{ scrollbarWidth: 'none' }}
      >

        {/* ── STEP 1: PHONE ── */}
        {!isGoogleMode && step === 1 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step1Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              {t('signup.step1Subtitle')}
            </p>

            <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
              {t('signup.step1PhoneLabel')}
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
              {t('signup.step1ChannelLabel')}
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
                    {/* Radio indicator */}
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
        {!isGoogleMode && step === 2 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step2Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              {t('signup.step2Subtitle', { length: OTP_LENGTH, channel: currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS' })}{' '}
              <strong className="text-gray-900 dark:text-white">
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
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {t('signup.resend')}
              </button>
              {countdown > 0 && (
                <span className="font-poppins text-[13px] text-gray-500 dark:text-gray-400">
                  {t('signup.resendIn')}{' '}
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step3Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              {t('signup.step3Subtitle')}
            </p>
            <div className="flex flex-col gap-4">
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('signup.step3NamePlaceholder')}
              />
              <Input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder={t('signup.step3PseudoPlaceholder')}
              />
            </div>
          </div>
        )}

        {/* ── STEP 4: BIRTHDAY ── */}
        {step === 4 && (
          <div>
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step4Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              {t('signup.step4Subtitle')}
            </p>

            <div className="relative">
              <Input
                type="text"
                value={birthdayText}
                onChange={(e) => {
                  let val = e.target.value
                  setBirthdayText(val)
                  const match = val.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})$/)
                  if (match) {
                    setBirthday(`${match[3]}-${match[2]}-${match[1]}`)
                  } else {
                    setBirthday('')
                  }
                }}
                placeholder={t('signup.step4DatePlaceholder')}
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step5Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              {t('signup.step5Subtitle')}
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
                placeholder={t('signup.step5CityPlaceholder')}
                leftIcon={
                  <Location01Icon size={18} strokeWidth={1.5} className="text-[var(--color-icon-secondary)]" />
                }
                icon={
                  city ? (
                    <button
                      type="button"
                      onClick={() => { setCity(''); setCitySuggestions([]); setShowCitySuggestions(false) }}
                      className="focus:outline-none text-[var(--color-icon-secondary)]"
                    >
                      <Cancel01Icon size={18} strokeWidth={1.5} />
                    </button>
                  ) : null
                }
              />

              {/* Dropdown suggestions */}
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-[16px] border border-gray-200 dark:border-white/10 shadow-lg z-50 overflow-hidden bg-white dark:bg-[#1A1A1A]">
                  {citySearching && (
                    <div className="px-4 py-3 font-poppins text-[13px] text-gray-500 dark:text-gray-400">
                      {t('signup.step5Searching')}
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
                      className="w-full flex items-center justify-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA] dark:hover:bg-[#222] active:bg-[#F2F2F2] dark:active:bg-[#2A2A2A]"
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
                      <span className="font-poppins text-[14px] text-gray-900 dark:text-white">
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step6Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8">
              {t('signup.step6Subtitle')}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS_LIST.map((interest) => (
                <CategoryChip
                  key={interest}
                  label={interest}
                  showIcon={false}
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
            <h1 className="font-poppins font-semibold text-[22px] leading-[28px] text-gray-900 dark:text-white mb-2">
              {t('signup.step7Title')}
            </h1>
            <p className="font-poppins text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mb-7">
              {t('signup.step7Subtitle')}
            </p>

            <div className="flex flex-col gap-5 mb-5">
              {/* Mot de passe */}
              <div>
                <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                  {t('signup.step7PasswordLabel')}
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
                  {t('signup.step7ConfirmLabel')}
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
                { ok: pwdLength, label: t('signup.step7Rule1') },
                { ok: hasLower && hasUpper, label: t('signup.step7Rule2') },
                { ok: pwdNumber, label: t('signup.step7Rule3') },
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

      {/* ── Bottom Area ─────────────────────────────────── */}
      <div 
        className="px-5 pt-3 mt-auto shrink-0 bg-white dark:bg-black"
        style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}
      >
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
                  : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A]'
              }`}
            >
              {acceptedTerms && (
                <Tick01Icon width={16} height={16} strokeWidth={3.5} className="text-white" />
              )}
            </div>
            <span className="font-poppins text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
              {t('signup.step7TermsCheck')}{' '}
              <span className="text-[var(--brand-orange-500)] font-semibold">
                {t('signup.step7TermsLink')}
              </span>{' '}
              {t('signup.step7TermsOf')}
            </span>
          </div>
        )}

        <PrimaryButton
          onClick={handleNext}
          disabled={isNextDisabled()}
          loading={isLoading}
        >
          {buttonLabel}
        </PrimaryButton>
      </div>
    </div>
  )
}
