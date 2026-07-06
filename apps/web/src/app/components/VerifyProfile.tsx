import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Camera, Upload, CheckCircle2, Loader2, Shield, AlertCircle, Clock, BadgeCheck } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'

// ── Types ──────────────────────────────────────────────────────────────────────

type KycStep = 0 | 1 | 2 | 3 | 4
type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'
type KycStatus = 'pending' | 'verified' | 'rejected' | null

interface StepConfig {
  id: KycStep
  title: string
  subtitle: string
  instruction: string
  capture: 'environment' | 'user'
}

// ── KYC Status Screen ──────────────────────────────────────────────────────────

function KycPendingScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mb-6">
        <Clock className="w-12 h-12 text-amber-500" />
      </div>
      <h1 className="text-[22px] font-bold text-gray-900 dark:text-white mb-3">
        Vérification en cours
      </h1>
      <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mb-2">
        Votre dossier KYC a été soumis et est en cours d'examen par notre équipe.
      </p>
      <p className="text-[13px] text-gray-400 dark:text-gray-500 leading-relaxed max-w-xs">
        Vous recevrez une notification dès que votre identité sera validée (généralement sous 24–48 h).
      </p>
      <div className="flex items-center gap-2 mt-6 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20 max-w-xs w-full">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-[12px] text-amber-700 dark:text-amber-400 text-left font-medium">
          Aucune action requise de votre part.
        </p>
      </div>
      <button
        onClick={onBack}
        className="mt-8 px-8 py-3.5 rounded-2xl font-bold text-[15px] text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#2A2A2A] active:scale-[0.98] transition-transform"
      >
        Retour
      </button>
    </div>
  )
}

function KycVerifiedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mb-6">
        <BadgeCheck className="w-14 h-14 text-[#10B981]" />
      </div>
      <h1 className="text-[22px] font-bold text-gray-900 dark:text-white mb-3">
        Identité vérifiée ✓
      </h1>
      <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mb-2">
        Votre profil est officiellement vérifié. Le badge vérifié est actif sur votre compte.
      </p>
      <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-500/20 max-w-xs w-full">
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        <p className="text-[12px] text-green-700 dark:text-green-400 text-left font-medium">
          Votre badge vérifié est visible par les autres utilisateurs.
        </p>
      </div>
      <button
        onClick={onBack}
        className="mt-8 px-8 py-3.5 rounded-2xl font-bold text-[15px] text-white bg-[#10B981] active:scale-[0.98] transition-transform"
      >
        Retour
      </button>
    </div>
  )
}

// ── Illustration components ────────────────────────────────────────────────────

function IdFrontIllustration({ captured }: { captured: boolean }) {
  return (
    <div className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
      captured ? 'border-[#10B981] bg-green-50' : 'border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#222222]'
    }`}>
      {captured ? (
        <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
      ) : (
        <>
          <div className="w-20 h-14 rounded-lg border-2 border-gray-300 bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm">
            <div className="space-y-1.5 px-2 w-full">
              <div className="h-1.5 bg-gray-200 rounded-full w-3/4" />
              <div className="h-1.5 bg-gray-200 rounded-full w-1/2" />
              <div className="h-1.5 bg-gray-200 rounded-full w-2/3" />
            </div>
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500">Recto de votre pièce d'identité</p>
        </>
      )}
    </div>
  )
}

function IdBackIllustration({ captured }: { captured: boolean }) {
  return (
    <div className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
      captured ? 'border-[#10B981] bg-green-50' : 'border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#222222]'
    }`}>
      {captured ? (
        <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
      ) : (
        <>
          <div className="w-20 h-14 rounded-lg border-2 border-gray-300 bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm relative">
            <div className="absolute bottom-1 left-2 right-2 space-y-1">
              <div className="h-1 bg-gray-200 rounded-full" />
              <div className="h-1 bg-gray-200 rounded-full w-4/5" />
            </div>
            <div className="w-8 h-5 bg-gray-100 dark:bg-[#2A2A2A] rounded border border-gray-200 dark:border-[#333333] absolute top-1 left-1.5" />
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500">Verso de votre pièce d'identité</p>
        </>
      )}
    </div>
  )
}

function SelfieIllustration({ captured }: { captured: boolean }) {
  return (
    <div className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
      captured ? 'border-[#10B981] bg-green-50' : 'border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#222222]'
    }`}>
      {captured ? (
        <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
      ) : (
        <>
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-[#FFE8D6] flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-action-primary/30" />
            </div>
            <div className="w-20 h-8 bg-[#FFE8D6] rounded-t-full absolute -bottom-4 left-1/2 -translate-x-1/2" />
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-4">Votre visage bien éclairé</p>
        </>
      )}
    </div>
  )
}

function SelfieWithIdIllustration({ captured }: { captured: boolean }) {
  return (
    <div className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
      captured ? 'border-[#10B981] bg-green-50' : 'border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#222222]'
    }`}>
      {captured ? (
        <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-[#FFE8D6] flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-action-primary/30" />
              </div>
              <div className="w-18 h-7 bg-[#FFE8D6] rounded-t-full absolute -bottom-3 left-1/2 -translate-x-1/2" />
            </div>
            <div className="w-14 h-10 rounded-lg border-2 border-gray-300 bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm ml-1">
              <div className="space-y-1 px-1.5 w-full">
                <div className="h-1 bg-gray-200 rounded-full" />
                <div className="h-1 bg-gray-200 rounded-full w-3/4" />
              </div>
            </div>
          </div>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">Vous tenant votre pièce d'identité</p>
        </>
      )}
    </div>
  )
}

// ── Step configs ───────────────────────────────────────────────────────────────

const STEPS: StepConfig[] = [
  {
    id: 1,
    title: 'Pièce d\'identité — Recto',
    subtitle: 'Photographiez le recto de votre CNI, passeport ou permis de conduire.',
    instruction: 'Assurez-vous que tous les coins sont visibles et que le texte est lisible.',
    capture: 'environment',
  },
  {
    id: 2,
    title: 'Pièce d\'identité — Verso',
    subtitle: 'Photographiez maintenant le verso du même document.',
    instruction: 'Le document doit être posé sur une surface plane, sans reflet.',
    capture: 'environment',
  },
  {
    id: 3,
    title: 'Votre selfie',
    subtitle: 'Prenez une photo de votre visage face à la caméra avant.',
    instruction: 'Retirez lunettes et chapeau, et assurez-vous d\'être bien éclairé.',
    capture: 'user',
  },
  {
    id: 4,
    title: 'Selfie + Pièce d\'identité',
    subtitle: 'Tenez votre pièce d\'identité à côté de votre visage.',
    instruction: 'La pièce doit être lisible et votre visage clairement visible.',
    capture: 'user',
  },
]

// ── Main component ─────────────────────────────────────────────────────────────

export function VerifyProfile() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const refreshUser = useAuthStore(s => s.refreshUser)

  const [step, setStep] = useState<KycStep>(0)
  const [formData, setFormData] = useState({
    idNumber: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    city: ''
  })
  const [previews, setPreviews] = useState<Record<KycStep, string | null>>({ 0: null, 1: null, 2: null, 3: null, 4: null })
  const [files, setFiles] = useState<Record<KycStep, File | null>>({ 0: null, 1: null, 2: null, 3: null, 4: null })
  const [submitStatus, setSubmitStatus] = useState<UploadStatus>('idle')
  const [isComplete, setIsComplete] = useState(false)
  const [kycStatusChecked, setKycStatusChecked] = useState(false)
  const [kycStatus, setKycStatus] = useState<KycStatus>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Vérifier le statut KYC actuel via API ───────────────────────────────
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data } = await apiClient.get('/users/me/kyc-status')
        setKycStatus(data.kycStatus ?? null)
      } catch {
        // Si l'endpoint n'existe pas, fall back sur le profil local
        const localStatus = (user?.profile as any)?.kycStatus ?? null
        setKycStatus(localStatus)
      } finally {
        setKycStatusChecked(true)
      }
    }
    checkStatus()
  }, [user])

  const currentStep = STEPS[step - 1]
  const totalSteps = STEPS.length

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviews(prev => ({ ...prev, [step]: url }))
    setFiles(prev => ({ ...prev, [step]: file }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validateForm = () => {
    if (!formData.idNumber || !formData.firstName || !formData.lastName || !formData.birthDate || !formData.city) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return false
    }

    const kycFirstName = formData.firstName.trim().toLowerCase()
    const kycLastName = formData.lastName.trim().toLowerCase()
    const profileName = (user?.profile?.displayName || '').trim().toLowerCase()

    const nameMatches = kycFirstName.includes(profileName) || profileName.includes(kycFirstName) || kycLastName.includes(profileName) || profileName.includes(kycLastName)
    if (!nameMatches) {
      toast.error('Le prénom ou nom doit correspondre au nom sur votre profil')
      return false
    }

    if (user?.profile?.birthDate) {
      const kycDate = new Date(formData.birthDate).toISOString().split('T')[0]
      const profDate = new Date(user.profile.birthDate).toISOString().split('T')[0]
      if (kycDate !== profDate) {
        toast.error('La date de naissance doit correspondre à celle de votre profil')
        return false
      }
    }
    
    return true
  }

  const handleNext = () => {
    if (step === 0) {
      if (!validateForm()) return
      setStep(1)
      return
    }

    if (!previews[step as 1|2|3|4]) {
      toast.error('Veuillez d\'abord prendre ou importer une photo.')
      return
    }
    if (step < totalSteps) {
      setStep(s => (s + 1) as KycStep)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setSubmitStatus('uploading')
    try {
      const fd = new FormData()
      fd.append('idNumber', formData.idNumber)
      fd.append('firstName', formData.firstName)
      fd.append('lastName', formData.lastName)
      fd.append('birthDate', formData.birthDate)
      fd.append('city', formData.city)

      if (files[1]) fd.append('idFront', files[1])
      if (files[2]) fd.append('idBack', files[2])
      if (files[3]) fd.append('selfie', files[3])
      if (files[4]) fd.append('selfieWithId', files[4])

      await apiClient.post('/users/me/kyc', fd)
      await refreshUser().catch(() => {})
      setIsComplete(true)
    } catch {
      toast.error('Erreur lors de l\'envoi des documents. Réessayez.')
      setSubmitStatus('error')
      return
    } finally {
      setSubmitStatus('done')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!kycStatusChecked) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#1A1A1A]">
        <Loader2 className="w-8 h-8 animate-spin text-action-primary" />
      </div>
    )
  }

  // ── KYC déjà en attente ──────────────────────────────────────────────────
  if (kycStatus === 'pending' && !isComplete) {
    return <KycPendingScreen onBack={() => navigate(-1)} />
  }

  // ── KYC déjà vérifié ────────────────────────────────────────────────────
  if (kycStatus === 'verified') {
    return <KycVerifiedScreen onBack={() => navigate(-1)} />
  }

  // ── Success screen ───────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-14 h-14 text-[#10B981]" />
        </div>
        <h1 className="text-[24px] font-bold text-gray-900 dark:text-[#FFFFFF] mb-3">Documents envoyés !</h1>
        <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
          Votre demande de vérification est en cours de traitement. Vous recevrez une notification dès que votre profil sera validé (sous 24–48 h).
        </p>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-[#333333] flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-[0.8] py-4 rounded-full border border-gray-200 dark:border-[#333333] font-bold text-[15px] text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A]"
          >
            Retour
          </button>
          <button
            onClick={() => navigate('/home')}
            className="flex-[1.2] py-4 rounded-full font-bold text-[15px] text-white bg-action-primary"
          >
            Accueil
          </button>
        </div>
      </div>
    )
  }

  // ── KYC wizard ─────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col">

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={currentStep?.capture}
        className="hidden"
        onChange={handleCapture}
      />

      {/* Header */}
      <div className="px-5 pt-safe-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-center relative mb-4">
          <button
            onClick={() => step === 0 ? navigate(-1) : setStep(s => (s - 1) as KycStep)}
            className="absolute left-0 w-8 h-8 flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-white" />
          </button>
          <span className="text-[15px] font-semibold text-gray-900 dark:text-[#FFFFFF]">Vérification d'identité</span>
        </div>

        {/* Rejected banner */}
        {kycStatus === 'rejected' && (
          <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700 dark:text-red-400 font-medium leading-relaxed">
              Votre précédente vérification a été refusée. Veuillez soumettre un nouveau dossier.
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className="h-full bg-action-primary rounded-full transition-all duration-500"
            style={{ width: step === 0 ? '10%' : `${(step / totalSteps) * 100}%` }}
          />
        </div>
        {step > 0 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 text-right">Étape {step}/{totalSteps}</p>
        )}
      </div>

      {step === 0 ? (
        <div className="flex-1 overflow-y-auto px-5 pb-32">
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2">Vos informations</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Veuillez entrer les informations exactes figurant sur votre pièce d'identité.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Numéro de pièce</label>
              <input type="text" className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1A1A1A] text-[15px] outline-none focus:border-action-primary transition-colors" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} placeholder="Ex: 123456789" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Prénom</label>
                <input type="text" className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1A1A1A] text-[15px] outline-none focus:border-action-primary transition-colors" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                <input type="text" className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1A1A1A] text-[15px] outline-none focus:border-action-primary transition-colors" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Date de naissance</label>
              <input type="date" className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1A1A1A] text-[15px] outline-none focus:border-action-primary transition-colors" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">Ville de résidence</label>
              <input type="text" className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1A1A1A] text-[15px] outline-none focus:border-action-primary transition-colors" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-5 pb-32">

        {/* KYC badge */}
        <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
          <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-[12px] text-blue-600 dark:text-blue-400 font-medium">
            Vos données sont chiffrées et utilisées uniquement pour la vérification.
          </p>
        </div>

        <h2 className="text-[20px] font-bold text-gray-900 dark:text-[#FFFFFF] mb-1">{currentStep?.title}</h2>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">{currentStep?.subtitle}</p>

        {/* Photo preview or illustration */}
        {previews[step] ? (
          <div className="w-full h-44 rounded-2xl overflow-hidden border-2 border-[#10B981] relative mb-4">
            <img src={previews[step]!} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#10B981] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {step === 1 && <IdFrontIllustration captured={false} />}
            {step === 2 && <IdBackIllustration captured={false} />}
            {step === 3 && <SelfieIllustration captured={false} />}
            {step === 4 && <SelfieWithIdIllustration captured={false} />}
          </div>
        )}

        {/* Instruction tip */}
        <div className="flex items-start gap-2 mb-6 p-3 bg-[#FFF8F1] dark:bg-action-primary/5 rounded-xl border border-orange-100 dark:border-action-primary/20">
          <AlertCircle className="w-4 h-4 text-action-primary mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">{currentStep?.instruction}</p>
        </div>

        {/* Capture buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture')
                if (currentStep?.capture) fileInputRef.current.setAttribute('capture', currentStep.capture)
                fileInputRef.current.click()
              }
            }}
            className="flex-1 flex flex-col items-center gap-2 px-4 py-4 border border-gray-200 dark:border-[#333333] rounded-2xl bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[#FFF8F1] dark:bg-action-primary/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-action-primary" />
            </div>
            <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
              {step === 3 || step === 4 ? 'Caméra avant' : 'Photographier'}
            </span>
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture')
                fileInputRef.current.click()
              }
            }}
            className="flex-1 flex flex-col items-center gap-2 px-4 py-4 border border-gray-200 dark:border-[#333333] rounded-2xl bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#222222] flex items-center justify-center">
              <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Galerie</span>
          </button>
        </div>

        {/* Retake */}
        {previews[step] && (
          <button
            onClick={() => {
              setPreviews(prev => ({ ...prev, [step]: null }))
              setFiles(prev => ({ ...prev, [step]: null }))
            }}
            className="w-full mt-3 py-2.5 text-[13px] font-medium text-gray-500 dark:text-gray-400 text-center"
          >
            Reprendre la photo
          </button>
        )}
      </div>
      )}

      {/* Bottom CTA */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-[#333333] px-5 pt-4"
        style={{ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <button
          onClick={handleNext}
          disabled={(step > 0 && !previews[step as 1|2|3|4]) || submitStatus === 'uploading'}
          className={`w-full py-4 rounded-full font-bold text-[16px] text-white transition-all active:scale-95 flex items-center justify-center gap-2 ${
            (step === 0 || previews[step as 1|2|3|4]) && submitStatus !== 'uploading'
              ? 'bg-action-primary shadow-md shadow-orange-200'
              : 'bg-action-primary/30'
          }`}
        >
          {submitStatus === 'uploading' ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours...</>
          ) : step < totalSteps ? (
            'Étape suivante'
          ) : (
            'Soumettre ma vérification'
          )}
        </button>

        {/* Steps dots */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {STEPS.map(s => (
            <div
              key={s.id}
              className={`rounded-full transition-all ${
                s.id === step
                  ? 'w-6 h-2 bg-action-primary'
                  : previews[s.id as 1|2|3|4]
                  ? 'w-2 h-2 bg-[#10B981]'
                  : 'w-2 h-2 bg-gray-200 dark:bg-[#2A2A2A]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
