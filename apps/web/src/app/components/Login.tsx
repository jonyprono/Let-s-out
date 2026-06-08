import { useState } from 'react'
import { ViewIcon, ViewOffIcon } from 'hugeicons-react'
import { useDirectLogin } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import {
  authShell,
} from '@/lib/auth-ui'

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

  const { mutate: directLogin, isPending: logging } = useDirectLogin()

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

  return (
    <div className={authShell}>
      <div className="flex-1 px-6 pt-6 sm:pt-10 flex flex-col overflow-y-auto pb-4 max-w-[400px] mx-auto w-full">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Lets Out Logo" className="w-[80px] sm:w-[100px] h-auto object-contain" />
        </div>

        <h1 className="text-[24px] font-bold text-gray-900 mb-2 text-center tracking-tight">Connectez-vous</h1>
        <p className="text-[14px] text-gray-600 mb-8 text-center leading-relaxed max-w-[280px] mx-auto">
          Rejoignez des événements près de vous et vivez des expériences inoubliables.
        </p>

        <label className="block text-[13px] font-medium text-gray-800 mb-1.5">Numéro de téléphone</label>
        <div className="flex items-center h-[48px] border border-gray-300 rounded-[8px] bg-white overflow-hidden mb-5 focus-within:border-[#F58220] focus-within:ring-1 focus-within:ring-[#F58220] transition-all">
          <CountryPicker
            value={country}
            onChange={(c) => { setCountry(c); resetPhone() }}
            className="flex items-center gap-[6px] h-full px-3 bg-transparent whitespace-nowrap active:opacity-80 transition-colors"
          />
          <input
            type="tel"
            inputMode="numeric"
            value={displayValue}
            onChange={handlePhoneChange}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="00 00 00 00 00"
            className="flex-1 min-w-0 h-full text-[15px] bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        <label className="block text-[13px] font-medium text-gray-800 mb-1.5">Mot de passe</label>
        <div className="relative mb-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder=""
            className="w-full h-[48px] px-3 border border-gray-300 rounded-[8px] text-[15px] focus:outline-none focus:border-[#F58220] focus:ring-1 focus:ring-[#F58220] transition-all pr-12"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {showPassword
              ? <ViewIcon width={20} height={20} strokeWidth={1.5} />
              : <ViewOffIcon width={20} height={20} strokeWidth={1.5} />}
          </button>
        </div>

        <div className="text-right mb-8">
          <button type="button" onClick={onForgotPassword} className="text-[13px] text-[#F58220] font-medium underline underline-offset-2">
            Mot de passe oublié?
          </button>
        </div>

        <button
          id="login-send-btn"
          type="button"
          onClick={handleLogin}
          disabled={!phone.trim() || !password || logging}
          className="w-full bg-[#F58220] hover:bg-[#E6781D] text-white h-[48px] rounded-full font-semibold text-[15px] mb-6 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
        >
          {logging ? 'Connexion...' : 'Se connecter'}
        </button>

        {/* Separator */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-[1px] bg-gray-200" />
          <span className="text-gray-500 text-[13px]">Ou</span>
          <div className="flex-1 h-[1px] bg-gray-200" />
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={() => { /* TODO: implement Google Login */ }}
          className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 h-[48px] rounded-full font-semibold text-[15px] mb-8 flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
            <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8766 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7253 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
            <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3633 11.0051 19.3825V13.2006H3.02419C-0.805404 20.7366 -0.805404 27.2466 3.02419 34.7825L11.0051 28.6006Z" fill="#FBBC05"/>
            <path d="M24.48 9.49932C27.9016 9.42956 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00171733C15.4056 0.00171733 7.10718 5.11652 3.03296 13.2006L11.0139 19.3825C12.9099 13.7234 18.2275 9.49932 24.48 9.49932Z" fill="#EA4335"/>
          </svg>
          Se connecter avec Google
        </button>

        <div className="mt-auto flex flex-col items-center justify-center gap-4 text-center pb-2">
          <p className="text-[14px] text-gray-600">
            Vous êtes nouveau sur Let's Out ?{' '}
            <button onClick={onSignup} className="text-[#F58220] font-medium underline underline-offset-2">
              Inscrivez-vous
            </button>
          </p>
          <div className="w-[80%] h-[1px] bg-gray-200 my-1" />
          <p className="text-[10px] text-gray-400 max-w-[280px]">
            En continuant, vous acceptez nos <button className="text-[#F58220]">Conditions d'Utilisation</button> et notre <button className="text-[#F58220]">Politique de Confidentialité</button>
          </p>
        </div>
      </div>
    </div>
  )
}
