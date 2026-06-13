import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Shield, Loader2 } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/app/components/ui/input-otp'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { COUNTRIES } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'

export function AdminLoginPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [country, setCountry] = useState(COUNTRIES[0])
  const { displayValue: formattedPhone, rawValue: phone, handleChange: handlePhoneChange } = usePhoneFormatter()
  
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  
  const navigate = useNavigate()
  
  const setAccessToken = useAuthStore(s => s.setAccessToken)
  const setRefreshToken = useAuthStore(s => s.setRefreshToken)
  const setUser = useAuthStore(s => s.setUser)
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.accessToken)

  // Redirect if already admin
  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      navigate('/admin', { replace: true })
    }
  }, [token, user, navigate])

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear()
      } catch (err) {
        console.warn('Unable to clear existing reCAPTCHA verifier:', err)
      }
      window.recaptchaVerifier = undefined
    }
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      })
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fullPhone = `${country.code}${phone}`

    try {
      // 1. Ask backend to send OTP via WhatsApp (or SMS) first
      await apiClient.post('/auth/admin-send-otp', { target: fullPhone })
      setStep(2)
      
      // 2. Also prepare Firebase SMS fallback invisibly
      setupRecaptcha()
      const confResult = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
      setConfirmationResult(confResult)
    } catch (err: any) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi du code. Ce numéro n'est peut-être pas autorisé.")
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear()
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6) return
    
    setError('')
    setLoading(true)

    const fullPhone = `${country.code}${phone}`
    let idToken: string | undefined
    let backendCode: string | undefined

    try {
      if (confirmationResult) {
        // Try Firebase first
        try {
          const result = await confirmationResult.confirm(otp)
          idToken = await result.user.getIdToken()
        } catch (firebaseErr) {
          // Fallback to backend validation (WhatsApp OTP)
          backendCode = otp
        }
      } else {
        // Fallback to backend validation
        backendCode = otp
      }

      const res = await apiClient.post('/auth/admin-login', { 
        target: fullPhone,
        idToken,
        code: backendCode
      })

      const { accessToken, refreshToken, user: authUser } = res.data
      setAccessToken(accessToken)
      setRefreshToken(refreshToken)
      setUser(authUser)
      navigate('/admin', { replace: true })

    } catch (err: any) {
      console.error(err)
      setError("Code invalide ou expiré.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden">
      <div id="recaptcha-container"></div>
      
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10 p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-500/20">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Accès Administrateur</h1>
          <p className="text-white/50 text-sm">
            {step === 1 ? 'Entrez votre numéro autorisé pour accéder au dashboard.' : 'Saisissez le code reçu par SMS / WhatsApp.'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4 mt-8">
            <div className="flex gap-2">
              <CountryPicker value={country} onChange={setCountry} />
              <input
                type="tel"
                value={formattedPhone}
                onChange={handlePhoneChange}
                placeholder="Numéro de téléphone"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors"
                autoFocus
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">{error}</p>}

            <button
              type="submit"
              disabled={loading || phone.length < 6}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Recevoir le code'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate(token ? '/home' : '/login')}
              className="w-full text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
            >
              Retour à l'application
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6 mt-8">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot 
                      key={i} 
                      index={i}
                      className="w-12 h-14 rounded-xl border-white/10 bg-white/5 text-lg font-bold text-white focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">{error}</p>}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vérifier et se connecter'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1)
                setOtp('')
                setError('')
              }}
              className="w-full text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
            >
              Modifier le numéro
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
