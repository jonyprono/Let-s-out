import { useState } from 'react'
import { Loader2, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useDirectLogin } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'

interface LoginProps {
  onSignup: () => void
  onForgotPassword: () => void
}

import { COUNTRIES } from '@/lib/countries'

function validatePhone(code: string, phone: string) {
  const cleanPhone = phone.replace(/\s+/g, '')
  if (code === '+229') return /^01\d{8}$/.test(cleanPhone)
  if (code === '+225' || code === '+234') return /^\d{10,11}$/.test(cleanPhone)
  if (code === '+228' || code === '+221') return /^\d{8,9}$/.test(cleanPhone)
  return /^\d{8,15}$/.test(cleanPhone)
}

export function Login({ onSignup, onForgotPassword }: LoginProps) {
  const [country, setCountry] = useState(COUNTRIES[0])
  const [phone, setPhone] = useState('')
  const [showCountry, setShowCountry] = useState(false)
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
    <div className="w-full h-full bg-white flex flex-col">

      {/* Content */}
      <div className="flex-1 px-6 pt-10 flex flex-col overflow-y-auto pb-4">
        <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1">Connectez-vous</h1>
        <p className="text-[13px] text-[#888888] mb-8">Entrez vos identifiants pour vous connecter</p>

        {/* Phone */}
        <label className="text-[13px] text-[#666666] font-medium mb-1.5 block">Numéro de téléphone</label>
        <div className="flex gap-2 mb-5">
          <div className="relative shrink-0">
            <button
              onClick={() => setShowCountry(v => !v)}
              className="flex items-center gap-1 px-3 py-3.5 border border-[#E5E5E5] rounded-xl bg-white text-[15px] font-medium whitespace-nowrap"
            >
              <span>{country.flag}</span>
              <span className="text-[#1A1A1A] text-[13px]">({country.code.replace('+', '')})</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#888888] ml-0.5" />
            </button>
            {showCountry && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-10 w-48">
                {COUNTRIES.map(c => (
                  <button key={c.code} onClick={() => { setCountry(c); setShowCountry(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-left">
                    <span>{c.flag}</span>
                    <span className="text-[#1A1A1A]">{c.name}</span>
                    <span className="ml-auto text-[#888888]">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="XX XX XX XX"
            className="flex-1 min-w-0 px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A] placeholder-[#BBBBBB]"
          />
        </div>

        {/* Password */}
        <label className="text-[13px] text-[#666666] font-medium mb-1.5 block">Mot de passe</label>
        <div className="relative mb-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white pr-12 text-[#1A1A1A]"
          />
          <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888888]">
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="text-right mb-8">
          <button type="button" onClick={onForgotPassword} className="text-[13px] text-[#FF9F1C] font-medium">
            Mot de passe oublié?
          </button>
        </div>

        {/* Submit */}
        <button
          id="login-send-btn"
          onClick={handleLogin}
          disabled={!phone.trim() || !password || logging}
          className="w-full bg-[#FF9F1C] text-white py-[17px] rounded-full font-semibold text-[15px] mb-6 flex items-center justify-center gap-2 disabled:bg-[#FFD99A] disabled:text-white active:opacity-90 transition-all"
        >
          {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>Se connecter</span>
        </button>

        {/* Signup link */}
        <p className="text-center text-[13px] text-[#888888]">
          Si vous n'avez pas encore de compte{' '}
          <button onClick={onSignup} className="text-[#FF9F1C] font-semibold">Inscrivez-vous</button>
        </p>
      </div>

      {/* Home indicator */}
      <div className="h-6 flex items-center justify-center pb-1 shrink-0">
        <div className="w-32 h-[4px] bg-[#1A1A1A] rounded-full" />
      </div>
    </div>
  )
}
