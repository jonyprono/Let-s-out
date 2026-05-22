import { useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useDirectLogin } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'

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
  const [phone, setPhone] = useState('')
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
    <div className="w-full h-full bg-white dark:bg-[#151515] flex flex-col transition-colors">

      <div className="flex-1 px-6 pt-10 flex flex-col overflow-y-auto pb-4">
        <h1 className="text-[22px] font-bold text-gray-900 dark:text-white mb-1">Connectez-vous</h1>
        <p className="text-[13px] text-[#888888] dark:text-gray-300 mb-8">Entrez vos identifiants pour vous connecter</p>

        <label className="text-[13px] text-[#666666] dark:text-gray-200 font-medium mb-1.5 block">Numéro de téléphone</label>
        <div className="flex gap-2 mb-5">
          <CountryPicker value={country} onChange={setCountry} />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="XX XX XX XX"
            className="flex-1 min-w-0 px-4 py-3.5 border border-[#E5E5E5] dark:border-white/20 rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white dark:bg-[#242424] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <label className="text-[13px] text-[#666666] dark:text-gray-200 font-medium mb-1.5 block">Mot de passe</label>
        <div className="relative mb-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            className="w-full px-4 py-3.5 border border-[#E5E5E5] dark:border-white/20 rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white dark:bg-[#242424] pr-12 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888888]">
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="text-right mb-8">
          <button type="button" onClick={onForgotPassword} className="text-[13px] text-[#FF9F1C] font-medium">
            Mot de passe oublié?
          </button>
        </div>

        <button
          id="login-send-btn"
          onClick={handleLogin}
          disabled={!phone.trim() || !password || logging}
          className="w-full bg-[#FF9F1C] text-white py-[17px] rounded-full font-semibold text-[15px] mb-6 flex items-center justify-center gap-2 disabled:bg-[#FFD99A] disabled:text-white active:opacity-90 transition-all"
        >
          {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>Se connecter</span>
        </button>

        <p className="text-center text-[13px] text-[#888888] dark:text-gray-300">
          Si vous n&apos;avez pas encore de compte{' '}
          <button type="button" onClick={onSignup} className="text-[#FF9F1C] font-semibold">
            Inscrivez-vous
          </button>
        </p>
      </div>

      <div className="h-6 flex items-center justify-center pb-1 shrink-0">
        <div className="w-32 h-[4px] bg-gray-900 dark:bg-white rounded-full" />
      </div>
    </div>
  )
}
