import { useState } from 'react'
import { ViewIcon, ViewOffIcon } from 'hugeicons-react'
import { useDirectLogin, useGoogleSignIn } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { COUNTRIES, Country } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { useNavigate } from 'react-router'
import {
  authShell,
  authSubtitle,
  authLabel,
  authInput,
} from '@/lib/auth-ui'
import { PhoneInputField } from '@/components/shared/PhoneInputField'

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
  const nav = useNavigate()
  const [country, setCountry] = useState<Country>(COUNTRIES.find(c => c.code === '+229') || COUNTRIES[0])
  const { displayValue, rawValue: phone, handleChange: handlePhoneChange, reset: resetPhone } = usePhoneFormatter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { mutate: directLogin, isPending: logging } = useDirectLogin()
  const { mutate: googleSignIn } = useGoogleSignIn()

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
      let idToken = ''
      let email = ''

      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle()
        if (!result.user?.email) {
          toast.error('Connexion Google échouée. Veuillez réessayer.')
          return
        }
        const tokenResult = await FirebaseAuthentication.getIdToken()
        if (!tokenResult.token) {
          toast.error("Impossible de récupérer le token d'authentification.")
          return
        }
        idToken = tokenResult.token
        email = result.user.email
      } else {
        const provider = new GoogleAuthProvider()
        const result = await signInWithPopup(auth, provider)
        idToken = await result.user.getIdToken()
        email = result.user.email || ''
      }

      if (idToken && email) {
        googleSignIn({ idToken, email })
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
    <div className={`${authShell} bg-white`}>
      <div className="flex flex-col h-full px-6 pt-4 pb-4">
        
        {/* Header (Logo + Titres) */}
        <div className="flex flex-col items-center mt-6 mb-8 shrink-0">
          {/* Logo */}
          <img 
            src="/logo.png" 
            alt="Let's Out" 
            className="w-[96px] h-[96px] object-contain mx-auto mb-4" 
          />

          {/* Titres */}
          <h1 className="mx-auto w-[271px] h-[32px] text-center text-[#1B1818] text-[22px] font-medium leading-[32px] tracking-normal">
            Connectez-vous
          </h1>
          <p className={`${authSubtitle} !mt-1 text-center`}>
            Rejoignez des événements près de vous et vivez<br/>des expériences inoubliables.
          </p>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col gap-4 shrink-0">
          {/* Téléphone */}
          <div>
            <label className={`${authLabel} !mb-1 block`}>Numéro de téléphone</label>
            <PhoneInputField
              country={country}
              onCountryChange={c => { setCountry(c); resetPhone() }}
              phoneDisplay={displayValue}
              onPhoneChange={handlePhoneChange}
              onEnter={handleLogin}
            />
          </div>

          {/* Mot de passe */}
          <div>
            <label className={`${authLabel} !mb-1 block`}>Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder=""
                className={`${authInput} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-gray-400 hover:text-action-primary transition-colors"
              >
                {showPassword
                  ? <ViewIcon width={20} height={20} strokeWidth={1.2} />
                  : <ViewOffIcon width={20} height={20} strokeWidth={1.2} />}
              </button>
            </div>
            
            {/* Mot de passe oublié */}
            <div className="text-right mt-2">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-action-primary text-[12px] underline font-medium hover:text-action-primary-hover transition-colors"
              >
                Mot de passe oublié?
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 shrink-0">
          {/* Bouton Se connecter */}
          <button
            id="login-send-btn"
            type="button"
            onClick={handleLogin}
            disabled={!phone.trim() || !password || logging}
            className="w-full bg-[#FF7A00] hover:opacity-90 text-white rounded-full font-medium flex items-center justify-center disabled:opacity-50 active:scale-[0.98] transition-all shrink-0 h-[48px] text-[15px]"
          >
            {logging ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>

        {/* Séparateur Ou */}
        <div className="flex items-center gap-3 my-4 shrink-0">
          <div className="flex-1 h-[1px] bg-neutral-gray-200" />
          <span className="text-[12px] text-text-secondary">Ou</span>
          <div className="flex-1 h-[1px] bg-neutral-gray-200" />
        </div>

        {/* Bouton Google */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full bg-white border border-[#E2E8F0] text-[#1A1A1A] hover:bg-gray-50 rounded-full font-medium flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60 transition-all shrink-0 h-[48px]"
          >
            {googleLoading ? (
              <span className="text-[#718096] text-[14px]">Connexion avec Google...</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
                  <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8766 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7253 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
                  <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3633 11.0051 19.3825V13.2006H3.02419C-0.805404 20.7366 -0.805404 27.2466 3.02419 34.7825L11.0051 28.6006Z" fill="#FBBC05"/>
                  <path d="M24.48 9.49932C27.9016 9.42956 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00171733C15.4056 0.00171733 7.10718 5.11652 3.03296 13.2006L11.0139 19.3825C12.9099 13.7234 18.2275 9.49932 24.48 9.49932Z" fill="#EA4335"/>
                </svg>
                <span className="text-[#333333] font-medium text-[14px]">Se connecter avec Google</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0" />

        {/* Bas de page */}
        <div className="flex flex-col items-center gap-3 shrink-0 pt-2">
          <p className="text-[12px] text-[#A0AEC0]">
            Vous êtes nouveau sur Let's Out ?{' '}
            <span onClick={onSignup} className="text-[#FF7A00] underline font-medium cursor-pointer hover:opacity-80">
              Inscrivez-vous
            </span>
          </p>
          
          <div className="w-full h-[1px] bg-neutral-gray-200" />

          <p className="text-[#A0AEC0] leading-tight text-center px-1" style={{ fontSize: 10 }}>
            En continuant, vous acceptez nos{' '}
            <span onClick={() => nav('/terms')} className="text-[#FF7A00] font-normal cursor-pointer hover:opacity-80">Conditions d'Utilisation</span>
            {' '}et notre{' '}
            <span onClick={() => nav('/privacy')} className="text-[#FF7A00] font-normal cursor-pointer hover:opacity-80">Politique de Confidentialité</span>
          </p>
        </div>

      </div>
    </div>
  )
}

