import { useState } from 'react'
import { ViewIcon, ViewOffIcon } from 'hugeicons-react'
import { useDirectLogin, useLogin } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

interface LoginProps {
  onSignup: () => void
  onForgotPassword: () => void
}

function validatePhone(code: string, phone: string) {
  const cleanPhone = phone.replace(/\s+/g, '')
  if (code === '+229') return /^01\d{8}$/.test(cleanPhone)
  if (code === '+225' || code === '+234') return /^\d{10,11}$/.test(cleanPhone)
  if (code === '+228' || code === '+221') return /^\d{8,9}$/.test(cleanPhone)
  return /^\d{8,15}$/.test(cleanPhone)
}

export function Login({ onSignup, onForgotPassword }: LoginProps) {
  const [country, setCountry] = useState<Country>(COUNTRIES.find(c => c.code === '+229') || COUNTRIES[0])
  const { displayValue, rawValue: phone, handleChange: handlePhoneChange, reset: resetPhone } = usePhoneFormatter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { mutate: directLogin, isPending: logging } = useDirectLogin()
  const { mutate: loginWithToken } = useLogin()

  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`

  const handleLogin = () => {
    if (!phone.trim() || !password) return
    if (!validatePhone(country.code, phone)) {
      return toast.error(country.code === '+229'
        ? 'Au Bénin, le numéro doit faire 10 chiffres et commencer par 01.'
        : 'Le format de votre numéro de téléphone est incorrect.')
    }
    directLogin({ target: fullPhone, password })
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle()
        if (result.credential?.idToken && result.user?.email) {
          loginWithToken({ target: result.user.email, idToken: result.credential.idToken })
        }
      } else {
        const provider = new GoogleAuthProvider()
        const result = await signInWithPopup(auth, provider)
        const idToken = await result.user.getIdToken()
        const email = result.user.email || ''
        loginWithToken({ target: email, idToken })
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err)
      if (err?.code !== 'auth/popup-closed-by-user' && err?.message?.indexOf('canceled') === -1) {
        toast.error('Connexion Google échouée. Veuillez réessayer.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-flow w-full h-full flex flex-col bg-[#F8F9FA] text-foreground overflow-hidden">
      <div className="h-full px-6 py-10 flex flex-col w-full max-w-[420px] mx-auto overflow-y-auto scrollbar-hide bg-white shadow-sm sm:rounded-[40px] sm:my-auto sm:h-auto sm:max-h-[90vh]">
        
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="Let's Out" className="w-[110px] h-auto object-contain" />
        </div>

        <h1 className="text-[22px] font-extrabold text-[#1A1A1A] mb-2 text-center tracking-tight">Connectez-vous</h1>
        <p className="text-[14px] text-[#4A5568] mb-8 text-center leading-relaxed px-2">
          Rejoignez des événements près de vous et vivez des expériences inoubliables.
        </p>

        {/* Formulaire */}
        <div className="flex flex-col gap-4 mb-2">
          
          {/* Téléphone */}
          <div>
            <label className="block text-[13px] font-medium text-[#1A1A1A] mb-1.5">Numéro de téléphone</label>
            <div className="flex items-stretch h-[50px] border border-[#E2E8F0] rounded-[16px] bg-white focus-within:border-[#FF951A] focus-within:ring-1 focus-within:ring-[#FF951A] transition-all">
              <CountryPicker
                value={country}
                onChange={(c) => { setCountry(c); resetPhone() }}
                className="flex items-center gap-1.5 px-4 bg-transparent whitespace-nowrap border-r border-[#E2E8F0] text-[14px] text-[#1A1A1A] shrink-0 font-medium"
              />
              <input
                type="tel"
                inputMode="numeric"
                value={displayValue}
                onChange={handlePhoneChange}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="00 00 00 00 00"
                className="flex-1 min-w-0 px-4 text-[15px] bg-transparent text-[#1A1A1A] placeholder-[#A0AEC0] focus:outline-none"
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-[13px] font-medium text-[#1A1A1A] mb-1.5">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder=""
                className="w-full h-[50px] px-4 pr-12 border border-[#E2E8F0] rounded-[16px] text-[15px] focus:outline-none focus:border-[#FF951A] focus:ring-1 focus:ring-[#FF951A] transition-all text-[#1A1A1A]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A0AEC0] hover:text-[#FF951A] transition-colors"
              >
                {showPassword
                  ? <ViewIcon width={20} height={20} strokeWidth={1.5} />
                  : <ViewOffIcon width={20} height={20} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>

        <div className="text-right mb-6">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[13px] font-medium text-[#FF951A] hover:underline underline-offset-2 transition-all"
          >
            Mot de passe oublié?
          </button>
        </div>

        {/* Bouton Se connecter */}
        <button
          id="login-send-btn"
          type="button"
          onClick={handleLogin}
          disabled={!phone.trim() || !password || logging}
          className="w-full bg-[#FF951A] hover:bg-[#E68617] text-white h-[52px] rounded-full font-bold text-[15px] mb-6 flex items-center justify-center disabled:opacity-60 active:scale-[0.98] transition-all shadow-sm"
        >
          {logging ? 'Connexion...' : 'Se connecter'}
        </button>

        {/* Séparateur Ou */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-[1px] bg-[#E2E8F0]" />
          <span className="text-[#A0AEC0] text-[12px] font-medium uppercase tracking-wider">Ou</span>
          <div className="flex-1 h-[1px] bg-[#E2E8F0]" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full bg-white border border-[#E2E8F0] text-[#1A1A1A] hover:bg-gray-50 h-[52px] rounded-full font-semibold text-[14px] mb-8 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60 transition-all shadow-sm"
        >
          {googleLoading ? (
            <span className="text-[#718096]">Connexion avec Google...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
                <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8766 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7253 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
                <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3633 11.0051 19.3825V13.2006H3.02419C-0.805404 20.7366 -0.805404 27.2466 3.02419 34.7825L11.0051 28.6006Z" fill="#FBBC05"/>
                <path d="M24.48 9.49932C27.9016 9.42956 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00171733C15.4056 0.00171733 7.10718 5.11652 3.03296 13.2006L11.0139 19.3825C12.9099 13.7234 18.2275 9.49932 24.48 9.49932Z" fill="#EA4335"/>
              </svg>
              <span>Se connecter avec Google</span>
            </>
          )}
        </button>

        {/* Bas de page */}
        <div className="flex flex-col items-center gap-4 mt-auto pt-4">
          <p className="text-[14px] text-[#1A1A1A]">
            Vous êtes nouveau sur Let's Out ?{' '}
            <button onClick={onSignup} className="text-[#FF951A] font-bold hover:underline underline-offset-2 transition-all">
              Inscrivez-vous
            </button>
          </p>
          <div className="w-full h-[1px] bg-[#E2E8F0] my-1" />
          <p className="text-[11px] text-[#A0AEC0] leading-relaxed text-center">
            En continuant, vous acceptez nos{' '}
            <button className="text-[#FF951A] font-medium hover:underline inline-block">Conditions d'Utilisation</button>
            {' '}et notre{' '}
            <button className="text-[#FF951A] font-medium hover:underline inline-block">Politique de Confidentialité</button>
          </p>
        </div>

      </div>
    </div>
  )
}
