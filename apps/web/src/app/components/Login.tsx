import { useState } from 'react'
import { ViewIcon, ViewOffSlashIcon } from 'hugeicons-react'
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
} from '@/lib/auth-ui'
import { PhoneInputField } from '@/components/shared/PhoneInputField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SocialButton } from '@/components/ui/social-button'
import { Divider } from '@/components/ui/divider'

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
    <div className={`${authShell} bg-white overflow-y-auto`}>
      <div className="flex flex-col min-h-full px-6 pt-6 pb-4">
        
        {/* Header (Logo + Titres) */}
        <div className="flex flex-col items-center mb-8 shrink-0">
          {/* Logo */}
          <img 
            src="/logoci.png" 
            alt="Let's Out" 
            className="w-[68px] h-[68px] object-contain mx-auto mb-4" 
          />

          {/* Titres */}
          <div className="flex flex-col items-center gap-[6px] w-full max-w-[320px] mx-auto">
            <h1 className="text-center text-[var(--color-text-primary)] font-poppins text-[22px] font-semibold leading-tight">
              Connectez-vous
            </h1>
            <p className="text-center text-[var(--color-text-secondary)] font-poppins text-[13px] leading-[20px]">
              Rejoignez des événements près de vous et vivez des expériences inoubliables.
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col gap-5 shrink-0 w-full mt-2">
          {/* Téléphone */}
          <div>
            <label className="mb-2 block font-poppins text-[14px] font-medium text-[var(--color-text-primary)]">Numéro de téléphone</label>
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
            <label className="mb-2 block font-poppins text-[14px] font-medium text-[var(--color-text-primary)]">Mot de passe</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder=""
              className="pr-12"
              icon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)] transition-colors focus:outline-none"
                >
                  {showPassword
                    ? <ViewIcon size={18} strokeWidth={1.5} />
                    : <ViewOffSlashIcon size={18} strokeWidth={1.5} />}
                </button>
              }
            />
            
            {/* Mot de passe oublié */}
            <div className="text-right mt-[10px]">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[var(--color-text-link)] text-[13px] font-medium hover:opacity-75 transition-opacity focus:outline-none"
              >
                Mot de passe oublié?
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 shrink-0">
          {/* Bouton Se connecter - rounded-full capsule déjà dans buttonVariants */}
          <Button
            type="button"
            onClick={handleLogin}
            disabled={!phone.trim() || !password || logging}
          >
            {logging ? 'Connexion...' : 'Se connecter'}
          </Button>
        </div>

        {/* Séparateur Ou */}
        <div className="my-5 shrink-0">
          <Divider label="Ou" />
        </div>

        {/* Bouton Google */}
        <div className="shrink-0">
          <SocialButton
            provider="google"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? 'Connexion avec Google...' : 'Se connecter avec Google'}
          </SocialButton>
        </div>

        <div className="flex-1 min-h-0" />

        {/* Bas de page */}
        <div className="flex flex-col items-center shrink-0 w-full pb-4">

          {/* "Vous êtes nouveau ?" */}
          <div className="flex items-center justify-center gap-[4px] w-full mb-6">
            <span className="font-poppins text-[13px] font-normal text-[var(--color-text-secondary)] whitespace-nowrap">
              Vous êtes nouveau sur Let's Out ?
            </span>
            <button
              onClick={onSignup}
              className="font-poppins text-[13px] font-normal text-[var(--color-text-link)] underline whitespace-nowrap focus:outline-none hover:opacity-75"
            >
              Inscrivez-vous
            </button>
          </div>

          {/* Mentions légales - variables exactes (Body/xsmall/regular - 10/16) */}
          <div className="w-[358px] max-w-full text-center">
            <span className="font-poppins text-[10px] font-normal leading-[16px] text-[var(--color-text-tertiary)]">
              En continuant, vous acceptez nos{' '}
            </span>
            <span
              onClick={() => nav('/terms')}
              className="font-poppins text-[10px] font-normal leading-[16px] text-[var(--color-text-link)] cursor-pointer hover:opacity-75"
            >
              Conditions d'Utilisation
            </span>
            <span className="font-poppins text-[10px] font-normal leading-[16px] text-[var(--color-text-tertiary)]">
              {' '}et notre{' '}
            </span>
            <span
              onClick={() => nav('/privacy')}
              className="font-poppins text-[10px] font-normal leading-[16px] text-[var(--color-text-link)] cursor-pointer hover:opacity-75"
            >
              Politique de Confidentialité
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

