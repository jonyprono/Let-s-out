import { useState } from 'react'
import { ViewIcon, ViewOffIcon } from 'hugeicons-react'
import { useDirectLogin, useLogin } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase'

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
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
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
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()
      const email = result.user.email || ''
      loginWithToken({ target: email, idToken })
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error('Connexion Google échouée. Veuillez réessayer.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-flow w-full h-full flex flex-col bg-white text-foreground overflow-hidden">
      <div className="h-full px-5 py-6 flex flex-col w-full max-w-[420px] mx-auto overflow-y-auto scrollbar-hide">

        {/* Logo */}
        <div className="flex justify-center mb-3">
          <img src="/logo.png" alt="Let's Out" className="w-[80px] h-auto object-contain" />
        </div>

        <h1 className="text-[24px] font-bold text-[#1A1A1A] mb-1.5 text-center tracking-tight">Connectez-vous</h1>
        <p className="text-[13px] text-[#718096] mb-5 text-center leading-snug">
          Rejoignez des événements près de vous et vivez des expériences inoubliables.
        </p>

        {/* Téléphone */}
        <label className="block text-[13px] font-semibold text-[#1A1A1A] mb-1">Numéro de téléphone</label>
        <div className="flex items-stretch h-[48px] border border-[#D0D5DD] rounded-xl bg-white mb-3 focus-within:border-[#FF951A] focus-within:ring-1 focus-within:ring-[#FF951A] transition-all">
          <CountryPicker
            value={country}
            onChange={(c) => { setCountry(c); resetPhone() }}
            className="flex items-center gap-1.5 px-3 bg-transparent whitespace-nowrap border-r border-[#D0D5DD] text-[13px] text-[#1A1A1A] shrink-0"
          />
          <input
            type="tel"
            inputMode="numeric"
            value={displayValue}
            onChange={handlePhoneChange}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="00 00 00 00 00"
            className="flex-1 min-w-0 px-3 text-[14px] bg-transparent text-[#1A1A1A] placeholder-[#A0AEC0] focus:outline-none"
          />
        </div>

        {/* Mot de passe */}
        <label className="block text-[13px] font-semibold text-[#1A1A1A] mb-1">Mot de passe</label>
        <div className="relative mb-1">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder=""
            className="w-full h-[48px] px-4 pr-12 border border-[#D0D5DD] rounded-xl text-[14px] focus:outline-none focus:border-[#FF951A] focus:ring-1 focus:ring-[#FF951A] transition-all text-[#1A1A1A]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF951A] transition-colors"
          >
            {showPassword
              ? <ViewIcon width={18} height={18} strokeWidth={1.5} />
              : <ViewOffIcon width={18} height={18} strokeWidth={1.5} />}
          </button>
        </div>

        <div className="text-right mb-4">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[12px] font-semibold text-[#FF951A] hover:underline underline-offset-2 transition-all"
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
          className="w-full bg-[#FF951A] hover:bg-[#E68617] text-white min-h-[48px] h-auto py-3 rounded-xl font-bold text-[15px] mb-4 flex items-center justify-center disabled:opacity-60 active:scale-[0.98] transition-all text-center"
        >
          <span className="break-words max-w-full px-2">{logging ? 'Connexion...' : 'Se connecter'}</span>
        </button>

        {/* Séparateur Ou */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-[1px] bg-[#D0D5DD]" />
          <span className="text-[#718096] text-[12px]">Ou</span>
          <div className="flex-1 h-[1px] bg-[#D0D5DD]" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full bg-white border border-[#D0D5DD] text-[#1A1A1A] hover:bg-gray-50 min-h-[48px] h-auto py-3 rounded-xl font-semibold text-[14px] mb-5 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60 transition-all text-center"
        >
          {googleLoading ? (
            <span className="text-[13px] text-[#718096] break-words max-w-full">Connexion...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
                <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8766 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7253 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
                <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3633 11.0051 19.3825V13.2006H3.02419C-0.805404 20.7366 -0.805404 27.2466 3.02419 34.7825L11.0051 28.6006Z" fill="#FBBC05"/>
                <path d="M24.48 9.49932C27.9016 9.42956 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00171733C15.4056 0.00171733 7.10718 5.11652 3.03296 13.2006L11.0139 19.3825C12.9099 13.7234 18.2275 9.49932 24.48 9.49932Z" fill="#EA4335"/>
              </svg>
              <span className="break-words whitespace-normal text-left flex-1 max-w-[calc(100%-2rem)]">Se connecter avec Google</span>
            </>
          )}
        </button>

        {/* Bas de page */}
        <div className="flex flex-col items-center gap-3 text-center mt-auto">
          <p className="text-[13px] text-[#1A1A1A] max-w-full break-words">
            Vous êtes nouveau sur Let's Out ?{' '}
            <button onClick={onSignup} className="text-[#FF951A] font-bold hover:underline underline-offset-2 transition-all">
              Inscrivez-vous
            </button>
          </p>
          <p className="text-[10px] text-[#718096] leading-relaxed px-2 text-center max-w-full break-words whitespace-normal">
            En continuant, vous acceptez nos{' '}
            <button className="text-[#FF951A] font-semibold hover:underline inline-block mt-1">Conditions d'Utilisation</button>
            {' '}et notre{' '}
            <button className="text-[#FF951A] font-semibold hover:underline inline-block mt-1">Politique de Confidentialité</button>
          </p>
        </div>

      </div>
    </div>
  )
}
