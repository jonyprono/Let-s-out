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
    <div className={`${authShell} bg-white overflow-y-auto min-h-[100dvh] w-full flex flex-col`}>
      <div className="flex flex-col flex-1 px-4 sm:px-6 py-4 justify-between w-full max-w-[390px] mx-auto">
        
        <div className="flex flex-col justify-center w-full pb-2">
          
          {/* Header (Logo + Titres) */}
          <div className="flex flex-col items-center w-full gap-1 mb-4">
          {/* Logo */}
          <img 
            src="/logoci.png" 
            alt="Let's Out" 
            className="w-[80px] h-[80px] sm:w-[96px] sm:h-[96px] object-contain mx-auto" 
          />

          {/* Titres */}
          <div className="flex flex-col items-center gap-[4px] w-full">
            <h1 className="text-center text-[#1B1818] font-poppins text-[22px] sm:text-[24px] font-medium leading-tight sm:leading-[32px]">
              Connectez-vous
            </h1>
            <p className="text-center text-[#56514F] font-inter text-[16px] font-normal leading-[24px]">
              Rejoignez des événements près de vous et vivez des expériences inoubliables.
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col gap-3 w-full">
          {/* Téléphone */}
          <div className="flex flex-col gap-1">
            <label className="block font-poppins text-[14px] font-normal leading-[20px] text-[#1B1818]">Numéro de téléphone</label>
            <PhoneInputField
              country={country}
              onCountryChange={c => { setCountry(c); resetPhone() }}
              phoneDisplay={displayValue}
              onPhoneChange={handlePhoneChange}
              onEnter={handleLogin}
            />
          </div>

          {/* Mot de passe */}
          <div className="flex flex-col gap-1">
            <label className="block font-poppins text-[14px] font-normal leading-[20px] text-[#1B1818]">Mot de passe</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder=""
              className="pr-12 border-[#E0E0E0] focus-visible:ring-[#FF991C]"
              icon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  {showPassword
                    ? <ViewIcon size={20} strokeWidth={1.5} />
                    : <ViewOffSlashIcon size={20} strokeWidth={1.5} />}
                </button>
              }
            />
            
            {/* Mot de passe oublié */}
            <div className="text-right mt-1">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[#FF991C] font-inter text-[14px] font-medium leading-[20px] underline hover:opacity-75 transition-opacity focus:outline-none"
              >
                Mot de passe oublié?
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 w-full">
          {/* Bouton Se connecter - rounded-full capsule déjà dans buttonVariants */}
          <Button
            type="button"
            onClick={handleLogin}
            disabled={!phone.trim() || !password || logging}
            className="w-full h-[40px] bg-[#FF991C] hover:bg-[#e68a19] text-white font-poppins text-[14px] font-medium leading-[20px] rounded-full"
          >
            {logging ? 'Connexion...' : 'Se connecter'}
          </Button>
        </div>

        {/* Séparateur Ou */}
        <div className="my-3 w-full">
          <Divider label="Ou" className="text-[#404040] font-inter text-[12px] font-normal leading-[16px]" />
        </div>

        {/* Bouton Google */}
        <div className="w-full">
          <SocialButton
            provider="google"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full h-[40px] rounded-full font-inter text-[14px]"
          >
            {googleLoading ? 'Connexion avec Google...' : 'Se connecter avec Google'}
          </SocialButton>
        </div>
        
        </div>

        {/* Bas de page */}
        <div className="flex flex-col justify-end w-full mt-auto gap-2 pt-4">

          <div className="w-full h-px bg-[#D4D4D4] mt-2 mb-2 hidden" />

          {/* "Vous êtes nouveau ?" */}
          <div className="flex items-center justify-center gap-[4px] sm:gap-[8px] w-full mt-2 text-center whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="font-inter text-[13px] font-normal text-[#56514F] leading-[20px]">
              Vous êtes nouveau sur Let's Out ?
            </span>
            <button
              onClick={onSignup}
              className="font-inter text-[13px] font-medium leading-[20px] text-[#FF991C] underline focus:outline-none hover:opacity-75"
            >
              Inscrivez-vous
            </button>
          </div>

          <div className="w-full h-[1px] bg-[#D4D4D4] mb-2" />

          {/* Mentions légales */}
          <div className="w-full text-center flex flex-wrap justify-center gap-x-[3px]">
            <span className="font-inter text-[11px] font-normal leading-[16px] text-[#766F6E]">
              En continuant, vous acceptez nos
            </span>
            <span
              onClick={() => nav('/terms')}
              className="font-inter text-[11px] font-normal leading-[16px] text-[#FF991C] cursor-pointer hover:opacity-75"
            >
              Conditions d'Utilisation
            </span>
            <span className="font-inter text-[11px] font-normal leading-[16px] text-[#766F6E]">
              et notre
            </span>
            <span
              onClick={() => nav('/privacy')}
              className="font-inter text-[11px] font-normal leading-[16px] text-[#FF991C] cursor-pointer hover:opacity-75"
            >
              Politique de Confidentialité
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

