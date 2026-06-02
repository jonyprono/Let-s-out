import { useState } from 'react'
import { Eye, EyeClosed, Refresh } from 'iconoir-react'
import { useDirectLogin } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'
import { COUNTRIES, Country } from '@/lib/countries'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import {
  authShell,
  authTitle,
  authSubtitle,
  authLabel,
  authPhoneInputFlex,
  authInput,
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

      <div className="flex-1 px-6 pt-10 flex flex-col overflow-y-auto pb-4">
        <h1 className={`${authTitle} mb-1`}>Connectez-vous</h1>
        <p className={`${authSubtitle} mb-8`}>Entrez vos identifiants pour vous connecter</p>

        <label className={`${authLabel} mb-1.5 block`}>Numéro de téléphone</label>
        <div className="flex gap-2 mb-5">
          <CountryPicker value={country} onChange={(c) => { setCountry(c); resetPhone() }} />
          <input
            type="tel"
            inputMode="numeric"
            value={displayValue}
            onChange={handlePhoneChange}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="01 00 00 00 00"
            className={`auth-phone-input ${authPhoneInputFlex}`}
          />
        </div>

        <label className={`${authLabel} mb-1.5 block`}>Mot de passe</label>
        <div className="relative mb-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            className={`${authInput} pr-12`}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-gray-500">
            {showPassword
              ? <Eye width={20} height={20} strokeWidth={1.2} />
              : <EyeClosed width={20} height={20} strokeWidth={1.2} />}
          </button>
        </div>

        <div className="text-right mb-8">
          <button type="button" onClick={onForgotPassword} className="text-[13px] text-action-primary hover:text-action-primary-hover font-medium underline underline-offset-2">
            Mot de passe oublié?
          </button>
        </div>

        <button
          id="login-send-btn"
          type="button"
          onClick={handleLogin}
          disabled={!phone.trim() || !password || logging}
          className="auth-primary-btn w-full bg-action-primary hover:bg-action-primary-hover text-text-inverse py-[17px] rounded-full font-semibold text-[15px] mb-6 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {logging ? <Refresh width={16} height={16} strokeWidth={1.4} className="animate-spin" /> : null}
          <span>Se connecter</span>
        </button>
      </div>

      <div className="shrink-0 bg-background pb-5 mt-auto">
        <div className="mx-6 border-t border-neutral-gray-200 pt-5">
          <p className="text-center text-[13px] text-text-secondary">
            Si vous n&apos;avez pas encore de compte<br />
            <button type="button" onClick={onSignup} className="text-action-primary hover:text-action-primary-hover font-semibold underline underline-offset-2 mt-1">
              Inscrivez-vous
            </button>
          </p>
        </div>
      </div>

    </div>
  )
}
