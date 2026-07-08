import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { PinPad } from './ui/PinPad'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

interface WalletPinManagerProps {
  onVerified?: (token: string) => void
  onClose?: () => void
  isChangeMode?: boolean
}

export function WalletPinManager({ onVerified, onClose, isChangeMode }: WalletPinManagerProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<'LOADING' | 'VERIFY' | 'SETUP_1' | 'SETUP_2'>('LOADING')
  const [pin, setPin] = useState('')
  const [tempPin, setTempPin] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      const res = await apiClient.post<{ success: boolean; token: string }>('/wallet/pin/verify', { pin: p })
      return { ...res.data, pin: p }
    },
    onSuccess: (data) => {
      if (isChangeMode) {
        setTempPin(data.pin) // Store old PIN temporarily in tempPin
        setPin('')
        setStep('SETUP_1')
        setError(null)
      } else {
        onVerified?.(data.token)
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Code PIN incorrect')
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
        toast.success('Code PIN modifié avec succès')
        onClose?.()
      } else {
        onVerified?.(data.token)
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Erreur lors de la création du code PIN'
      if (msg === 'Un code PIN existe déjà') {
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
        setError('Les codes PIN ne correspondent pas')
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
      <div className="sticky top-0 z-40 bg-[#F9FAFB]/80 dark:bg-[#09090b]/80 backdrop-blur-md px-4 pt-12 pb-2 flex items-center border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => onClose ? onClose() : navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">
          Sécurité du portefeuille
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-[400px] h-[500px]"
          >
            {step === 'VERIFY' && (
              <PinPad 
                pin={pin} 
                setPin={setPin} 
                onComplete={handlePinComplete}
                error={error}
                isLoading={verifyMutation.isPending}
                title="Saisir votre code PIN"
                subtitle="Accès sécurisé à votre portefeuille"
              />
            )}
            {step === 'SETUP_1' && (
              <PinPad 
                pin={pin} 
                setPin={setPin} 
                onComplete={handlePinComplete}
                error={error}
                isLoading={setupMutation.isPending}
                title="Créer un code PIN"
                subtitle="Ce code protégera votre portefeuille et vos retraits"
              />
            )}
            {step === 'SETUP_2' && (
              <PinPad 
                pin={pin} 
                setPin={setPin} 
                onComplete={handlePinComplete}
                error={error}
                isLoading={setupMutation.isPending}
                title="Confirmer le code PIN"
                subtitle="Saisissez à nouveau votre code PIN"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
