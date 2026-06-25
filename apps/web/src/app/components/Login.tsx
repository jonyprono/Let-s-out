import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
          <h1 className="mx-auto w-[271px] h-[32px] text-center text-[var(--color-text-primary)] font-poppins text-[var(--font-size-title-large)] font-semibold leading-[32px] tracking-normal">
            Connectez-vous
          </h1>
          <p className="mt-[var(--spacing-050)] text-center text-[var(--color-text-secondary)] font-poppins text-[var(--font-size-body-medium)] max-w-[280px]">
            Rejoignez des événements près de vous et vivez<br/>des expériences inoubliables.
          </p>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col gap-[var(--spacing-150)] shrink-0">
          {/* Téléphone */}
          <div>
            <label className="mb-[var(--spacing-050)] block font-poppins text-[var(--font-size-body-small)] font-medium text-[var(--color-text-secondary)]">Numéro de téléphone</label>
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
            <label className="mb-[var(--spacing-050)] block font-poppins text-[var(--font-size-body-small)] font-medium text-[var(--color-text-secondary)]">Mot de passe</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder=""
              className="pr-12"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)] transition-colors focus:outline-none"
                >
                  {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              }
            />
            
            {/* Mot de passe oublié */}
            <div className="text-right mt-[var(--spacing-100)]">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[var(--color-text-brand-primary)] text-[var(--font-size-body-small)] underline font-medium hover:text-[var(--color-text-brand-primary)] transition-colors focus:outline-none"
              >
                Mot de passe oublié?
              </button>
            </div>
          </div>
        </div>

        <div className="mt-[var(--spacing-150)] shrink-0">
          {/* Bouton Se connecter */}
          <Button
            type="button"
            onClick={handleLogin}
            disabled={!phone.trim() || !password || logging}
            size="lg"
            className="w-full rounded-full"
          >
            {logging ? 'Connexion...' : 'Se connecter'}
          </Button>
        </div>

        {/* Séparateur Ou */}
        <div className="my-[var(--spacing-150)] shrink-0">
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
        <div className="flex flex-col items-center gap-[var(--spacing-150)] shrink-0 pt-2">
          <p className="font-poppins text-[var(--font-size-body-small)] text-[var(--color-text-secondary)]">
            Vous êtes nouveau sur Let's Out ?{' '}
            <button onClick={onSignup} className="text-[var(--color-text-brand-primary)] underline font-medium focus:outline-none hover:opacity-80">
              Inscrivez-vous
            </button>
          </p>
          
          <div className="w-full h-[1px] bg-[var(--border-secondary)]" />

          <p className="font-poppins text-[10px] leading-tight text-center px-1 text-[var(--color-text-secondary)]">
            En continuant, vous acceptez nos{' '}
            <button onClick={() => nav('/terms')} className="text-[var(--color-text-brand-primary)] font-normal focus:outline-none hover:opacity-80">Conditions d'Utilisation</button>
            {' '}et notre{' '}
            <button onClick={() => nav('/privacy')} className="text-[var(--color-text-brand-primary)] font-normal focus:outline-none hover:opacity-80">Politique de Confidentialité</button>
          </p>
        </div>

      </div>
    </div>
  )
}

