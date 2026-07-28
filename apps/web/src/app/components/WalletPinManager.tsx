import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { PinPad } from './ui/PinPad'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { auth } from '@/lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from 'react-i18next'

interface WalletPinManagerProps {
  onVerified?: (token: string) => void
  onClose?: () => void
  isChangeMode?: boolean
}

export function WalletPinManager({ onVerified, onClose, isChangeMode }: WalletPinManagerProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<'LOADING' | 'VERIFY' | 'SETUP_1' | 'SETUP_2' | 'RESET_AUTH' | 'RESET_OTP'>('LOADING')
  const [pin, setPin] = useState('')
  const [tempPin, setTempPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const user = useAuthStore(s => s.user)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [nativeVerificationId, setNativeVerificationId] = useState<string>('')
  const [isFirebaseSending, setIsFirebaseSending] = useState(false)
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false)

  const queryClient = useQueryClient()

  // Vérifier le statut du PIN (configuré ou non)
  const { data: status, isLoading } = useQuery({
    queryKey: ['wallet-pin-status'],
    queryFn: async () => {
      const res = await apiClient.get<{ isConfigured: boolean }>('/wallet/pin/status')
      return res.data
    }
  })

  useEffect(() => {
    if (!isLoading && status) {
      if (isChangeMode) {
        setStep(status.isConfigured ? 'VERIFY' : 'SETUP_1')
      } else {
        setStep(status.isConfigured ? 'VERIFY' : 'SETUP_1')
      }
    }
  }, [isLoading, status, isChangeMode])

  const verifyMutation = useMutation({
    mutationFn: async (p: string) => {
      // Utilise l'endpoint atomique : 1 seule requête au lieu de 4
      const res = await apiClient.post<{
        token: string
        wallet: { id: string; balance: number }
        stats: { totalEarned: number; totalWithdrawn: number; activeEventsCount: number; poolEvents: any[] }
        recentTransactions: any[]
      }>('/wallet/pin/verify-with-data', { pin: p })
      return { ...res.data, pin: p }
    },
    onSuccess: (data) => {
      if (isChangeMode) {
        setTempPin(data.pin) // Store old PIN temporarily in tempPin
        setPin('')
        setStep('SETUP_1')
        setError(null)
      } else {
        // Pré-remplir le cache React Query AVANT d'appeler onVerified
        // → Wallet.tsx s'affiche immédiatement sans skeleton (données déjà présentes)
        const token = data.token
        queryClient.setQueryData(['wallet', token], data.wallet)
        queryClient.setQueryData(['wallet-stats', token], data.stats)
        queryClient.setQueryData(['wallet-transactions', token], data.recentTransactions)
        onVerified?.(token)
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || t('wallet.pin.pinIncorrect'))
      setPin('')
    }
  })

  const setupMutation = useMutation({
    mutationFn: async (p: string) => {
      if (isChangeMode) {
        const res = await apiClient.post<{ success: boolean; token: string }>('/wallet/pin/change', { oldPin: tempPin, newPin: p })
        return res.data
      } else {
        const res = await apiClient.post<{ success: boolean; token: string }>('/wallet/pin/setup', { pin: p })
        return res.data
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-pin-status'] })
      if (isChangeMode) {
        toast.success(t('wallet.pin.pinChangedSuccess'))
        onClose?.()
      } else {
        onVerified?.(data.token)
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || t('wallet.pin.pinCreateError')
      if (msg === 'Un code PIN existe déjà' || msg === t('wallet.pin.pinAlreadyExists')) {
        queryClient.invalidateQueries({ queryKey: ['wallet-pin-status'] })
        setStep('VERIFY')
        setError(null)
      } else {
        setError(msg)
        setPin('')
        if (!isChangeMode) setTempPin('')
        setStep('SETUP_1')
      }
    }
  })

  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp'>('whatsapp')

  const requestOtpMutation = useMutation({
    mutationFn: async ({ pwd, channel }: { pwd: string; channel: 'sms' | 'whatsapp' }) => {
      const res = await apiClient.post<{ success: boolean; message: string }>('/wallet/pin/reset/request-otp', { password: pwd, channel })
      return res.data
    },
    onSuccess: async (data, variables) => {
      if (variables.channel === 'whatsapp') {
        toast.success(data.message || 'Code envoyé')
        setStep('RESET_OTP')
        setError(null)
      } else {
        if (!user?.phone) {
          toast.error(t('wallet.pin.phoneNotFound'))
          return
        }
        try {
          setIsFirebaseSending(true)
          if (window.recaptchaVerifier) {
            try { window.recaptchaVerifier.clear() } catch {}
            window.recaptchaVerifier = undefined
          }

          if (Capacitor.isNativePlatform()) {
            const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
              setNativeVerificationId(event.verificationId)
            })
            await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: user.phone })
            setStep('RESET_OTP')
            setError(null)
            setTimeout(() => listener.remove(), 60000)
          } else {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-wallet', { size: 'invisible' })
            const confirmation = await signInWithPhoneNumber(auth, user.phone, window.recaptchaVerifier)
            setConfirmationResult(confirmation)
            setStep('RESET_OTP')
            setError(null)
          }
        } catch (err: any) {
          console.error('Firebase sending error:', err)
          toast.error(err.message || t('wallet.pin.smsSendError'))
          if (window.recaptchaVerifier) {
            try { window.recaptchaVerifier.clear() } catch {}
            window.recaptchaVerifier = undefined
          }
        } finally {
          setIsFirebaseSending(false)
        }
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.response?.data?.error || t('common.error'))
    }
  })

  const verifyOtpMutation = useMutation({
    mutationFn: async (payload: { otp?: string; idToken?: string }) => {
      const res = await apiClient.post<{ success: boolean }>('/wallet/pin/reset/verify', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-pin-status'] })
      toast.success(t('wallet.pin.pinResetSuccess'))
      setPin('')
      setTempPin('')
      setStep('SETUP_1')
      setError(null)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || t('wallet.pin.incorrectCode'))
    }
  })

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return
    
    if (currentChannel === 'sms' && (confirmationResult || nativeVerificationId)) {
      setIsFirebaseVerifying(true)
      try {
        if (Capacitor.isNativePlatform() && nativeVerificationId) {
          await FirebaseAuthentication.confirmVerificationCode({
            verificationId: nativeVerificationId,
            verificationCode: otp,
          })
          const tokenResult = await FirebaseAuthentication.getIdToken()
          if (tokenResult.token) {
            verifyOtpMutation.mutate({ idToken: tokenResult.token })
          }
        } else if (confirmationResult) {
          const result = await confirmationResult.confirm(otp)
          const token = await result.user.getIdToken()
          verifyOtpMutation.mutate({ idToken: token })
        }
      } catch (err: any) {
        toast.error(t('wallet.pin.incorrectCode'))
      } finally {
        setIsFirebaseVerifying(false)
      }
    } else {
      verifyOtpMutation.mutate({ otp })
    }
  }

  const [newPinTemp, setNewPinTemp] = useState('')

  const handlePinComplete = (completedPin: string) => {
    setError(null)
    
    if (step === 'VERIFY') {
      verifyMutation.mutate(completedPin)
    } else if (step === 'SETUP_1') {
      if (!isChangeMode) {
        setTempPin(completedPin)
      } else {
        setNewPinTemp(completedPin)
      }
      setPin('')
      setStep('SETUP_2')
    } else if (step === 'SETUP_2') {
      const pinToCompare = isChangeMode ? newPinTemp : tempPin
      if (completedPin === pinToCompare) {
        setupMutation.mutate(completedPin)
      } else {
        setError(t('wallet.pin.pinsMismatch'))
        setPin('')
        if (isChangeMode) setNewPinTemp('')
        else setTempPin('')
        setStep('SETUP_1')
      }
    }
  }

  if (step === 'LOADING') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh] bg-[#F9FAFB] dark:bg-[#09090b]">
        <div className="w-8 h-8 rounded-full border-2 border-[#FF991C] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-[#F9FAFB] dark:bg-[#09090b]">
      <div id="recaptcha-container-wallet" />
      <div className="sticky top-0 z-40 bg-[#F9FAFB]/80 dark:bg-[#09090b]/80 backdrop-blur-md px-4 pt-12 pb-2 flex items-center border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => onClose ? onClose() : (window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/wallet'))} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">
          {t('wallet.pin.securityTitle')}
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-[400px] flex flex-col flex-1"
          >
            {step === 'VERIFY' && (
              <PinPad 
                pin={pin} 
                setPin={setPin} 
                onComplete={handlePinComplete}
                error={error}
                isLoading={verifyMutation.isPending}
                title={t('wallet.pin.enterPinTitle')}
                subtitle={t('wallet.pin.enterPinSub')}
                footer={
                  <button 
                    onClick={() => {
                      setStep('RESET_AUTH')
                      setError(null)
                    }} 
                    className="text-sm font-semibold text-[#FF991C] hover:underline"
                  >
                    {t('wallet.pin.forgotPin')}
                  </button>
                }
              />
            )}
            {step === 'RESET_AUTH' && (
              <div className="flex flex-col items-center justify-center w-full h-full pb-8 pt-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('wallet.pin.resetTitle')}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center px-4">
                  {t('wallet.pin.resetSub')}
                </p>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('wallet.pin.passwordPlaceholder')}
                  className="w-[80%] px-4 py-3 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-[16px] outline-none focus:border-[#FF991C]"
                />
                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                
                <div className="flex gap-3 w-[80%] mt-4">
                  <button
                    onClick={() => setCurrentChannel('sms')}
                    className={`flex-1 py-3 rounded-[12px] border transition-colors flex items-center justify-center font-medium ${
                      currentChannel === 'sms'
                        ? 'border-[#FF991C] bg-[#FFF8F1] text-[#FF991C]'
                        : 'border-gray-200 dark:border-gray-800 text-gray-500'
                    }`}
                  >
                    SMS
                  </button>
                </div>

                <button
                  onClick={() => requestOtpMutation.mutate({ pwd: password, channel: currentChannel })}
                  disabled={!password || requestOtpMutation.isPending || isFirebaseSending}
                  className="w-[80%] mt-8 h-12 bg-[#FF991C] hover:bg-[#e68a19] text-white rounded-[16px] font-semibold disabled:opacity-50 flex items-center justify-center"
                >
                  {(requestOtpMutation.isPending || isFirebaseSending) ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('wallet.continue')}
                </button>
                <button onClick={() => { setStep('VERIFY'); setError(null) }} className="mt-4 text-sm text-gray-500 hover:underline">{t('wallet.pin.cancel')}</button>
              </div>
            )}
            {step === 'RESET_OTP' && (
              <div className="flex flex-col items-center justify-center w-full h-full pb-8 pt-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('wallet.pin.validationCodeTitle')}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center px-4">
                  {t('wallet.pin.validationCodeSub', { channel: currentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS' })}
                </p>
                <input 
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-[80%] text-center text-2xl tracking-widest px-4 py-3 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-[16px] outline-none focus:border-[#FF991C]"
                />
                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                
                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.length < 6 || verifyOtpMutation.isPending || isFirebaseVerifying}
                  className="w-[80%] mt-8 h-12 bg-[#FF991C] hover:bg-[#e68a19] text-white rounded-[16px] font-semibold disabled:opacity-50 flex items-center justify-center"
                >
                  {(verifyOtpMutation.isPending || isFirebaseVerifying) ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('wallet.pin.verify')}
                </button>
                <button onClick={() => { setStep('VERIFY'); setError(null) }} className="mt-4 text-sm text-gray-500 hover:underline">{t('wallet.pin.cancel')}</button>
              </div>
            )}
            {step === 'SETUP_1' && (
              <PinPad 
                pin={pin} 
                setPin={setPin} 
                onComplete={handlePinComplete}
                error={error}
                isLoading={setupMutation.isPending}
                title={t('wallet.pin.createPinTitle')}
                subtitle={t('wallet.pin.createPinSub')}
              />
            )}
            {step === 'SETUP_2' && (
              <PinPad 
                pin={pin} 
                setPin={setPin} 
                onComplete={handlePinComplete}
                error={error}
                isLoading={setupMutation.isPending}
                title={t('wallet.pin.confirmPinTitle')}
                subtitle={t('wallet.pin.confirmPinSub')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
