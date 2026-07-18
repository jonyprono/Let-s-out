import { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, ChevronDown, Check,
  Settings, Lock, ChevronLeft, Calendar,
  History, Landmark
} from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useNavigate } from 'react-router'
import { WalletPinManager } from './WalletPinManager'
import { PhoneInputField } from '@/components/shared/PhoneInputField'
import { COUNTRIES, Country } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { useAuthStore } from '@/stores/auth.store'
import { SafeImage } from '@/components/shared/SafeImage'

const OPERATORS = [
  { id: 'mtn', label: 'MTN Momo', logo: '/logos/mtn.png', prefix: '97' },
  { id: 'moov', label: 'MOOV', logo: '/logos/moov.png', prefix: '96' },
  { id: 'celtis', label: 'CELTIS', logo: '/logos/celtiis.png', prefix: '95' },
]

interface WalletData {
  id: string
  balance: number
}

interface WalletStats {
  totalEarned: number
  totalWithdrawn: number
  activeEventsCount: number
  poolEvents: {
    id: string
    title: string
    startAt: string
    city: string
    coverUrl: string | null
    poolCollected: number
    netCredited: number
    alreadyWithdrawn: number
    available: number
    status: string
  }[]
}

interface WalletTransaction {
  id: string
  amount: number
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND'
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  description: string
  createdAt: string
}

export function Wallet() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  
  const [withdrawMode, setWithdrawMode] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<'form' | 'summary'>('form')
  const [withdrawData, setWithdrawData] = useState({ amount: '' })
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const { displayValue: phoneDisplay, rawValue: phoneNumber, handleChange: handlePhoneChange, reset: resetPhone } = usePhoneFormatter()
  const [selectedOperator, setSelectedOperator] = useState(OPERATORS[0])
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false)
  const operatorRef = useRef<HTMLDivElement>(null)
  
  const [pinToken, setPinToken] = useState<string | null>(null)
  const [showWalletPinModal, setShowWalletPinModal] = useState(false)
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showEventSelector, setShowEventSelector] = useState(false)
  const [selectedWithdrawEvent, setSelectedWithdrawEvent] = useState<{ id: string, title: string, amount: number } | null>(null)

  const [activeTab, setActiveTab] = useState<'overview' | 'events'>('overview')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (operatorRef.current && !operatorRef.current.contains(e.target as Node)) {
        setShowOperatorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch Wallet Balance
  const { data: wallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['wallet', pinToken],
    queryFn: async () => {
      if (!pinToken) return null
      const res = await apiClient.get<{ data: WalletData }>('/wallet', { headers: { 'x-wallet-pin-token': pinToken } })
      return res.data.data
    },
    enabled: !!pinToken,
  })

  // Fetch Wallet Stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['wallet-stats', pinToken],
    queryFn: async () => {
      if (!pinToken) return null
      const res = await apiClient.get<{ data: WalletStats }>('/wallet/stats', { headers: { 'x-wallet-pin-token': pinToken } })
      return res.data.data
    },
    enabled: !!pinToken,
  })

  // Fetch Transactions
  const { data: transactions, isLoading: isLoadingTx } = useQuery({
    queryKey: ['wallet-transactions', pinToken],
    queryFn: async () => {
      if (!pinToken) return null
      const res = await apiClient.get<{ data: WalletTransaction[] }>('/wallet/transactions', { headers: { 'x-wallet-pin-token': pinToken } })
      return res.data.data
    },
    enabled: !!pinToken,
  })

  const withdrawMutation = useMutation({
    mutationFn: async (payload: { amount: number; phone: string; network: string; eventTitle?: string; eventId?: string }) => {
      const res = await apiClient.post('/wallet/payout', payload, { headers: { 'x-wallet-pin-token': pinToken } })
      return res.data
    },
    onSuccess: () => {
      toast.success('Demande de retrait initiée avec succès')
      setWithdrawMode(false)
      setWithdrawStep('form')
      setWithdrawData({ amount: '' })
      resetPhone()
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-stats'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] })
    },
    onError: (err: any) => {
      const status = err.response?.status
      if (status === 403) {
        setPinToken(null)
        setWithdrawMode(false)
        setWithdrawStep('form')
        toast.error('Session expirée. Veuillez ressaisir votre code PIN.')
      } else {
        toast.error(err.response?.data?.error || 'Erreur lors du retrait')
      }
    },
  })

  if (user?.profile?.kycStatus !== 'verified') {
    return (
      <div className="bg-[#F8F9FA] dark:bg-[#09090b] flex flex-col h-[100dvh] w-full overflow-hidden">
        <div className="flex-none bg-[#F8F9FA]/90 dark:bg-[#09090b]/90 backdrop-blur-md px-4 pt-12 pb-2 flex items-center border-b border-gray-100 dark:border-gray-800 z-40">
          <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/account')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">Mon Portefeuille</h1>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Accès restreint</h2>
          <p className="text-gray-500">
            Votre profil n'est pas encore vérifié. Vous devez vérifier votre identité pour accéder au portefeuille.
          </p>
          <Button onClick={() => navigate('/verify-profile')} className="mt-4 bg-[#FF7A00] hover:bg-[#e66a00] text-white rounded-[16px] h-12 px-6 font-bold">
            Vérifier mon profil
          </Button>
        </div>
      </div>
    )
  }

  if (!pinToken) {
    return <WalletPinManager onVerified={setPinToken} />
  }

  if (withdrawMode) {
    return (
      <div className="bg-[#F8F9FA] dark:bg-[#09090b] flex flex-col h-[100dvh] w-full overflow-hidden">
        <div className="flex-none bg-[#F8F9FA]/90 dark:bg-[#09090b]/90 backdrop-blur-md px-4 pt-12 pb-2 flex items-center border-b border-gray-100 dark:border-gray-800 z-40">
          <button onClick={() => setWithdrawMode(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">Initier un retrait</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-6 gap-6 font-poppins pb-24">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-[20px] p-4 flex flex-col gap-2 shadow-sm border border-gray-100 dark:border-gray-800">
            <h2 className="text-[16px] font-bold text-gray-900 dark:text-white">
              {selectedWithdrawEvent ? `Retrait - ${selectedWithdrawEvent.title}` : 'Mon Portefeuille'}
            </h2>
            <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-1" />
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-gray-500">Solde disponible</span>
              <span className="text-[16px] font-bold text-[#FF7A00]">
                {selectedWithdrawEvent ? selectedWithdrawEvent.amount.toLocaleString('fr-FR') : (wallet?.balance?.toLocaleString('fr-FR') || 0)} F CFA
              </span>
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault()
            const amount = Number(withdrawData.amount)
            if (!amount || amount < 500) return toast.error('Le montant minimum est de 500 F CFA')
            if (!phoneNumber.trim()) return toast.error('Numéro de téléphone invalide')
            
            const cleanPhone = phoneNumber.replace(/\s+/g, '')
            if (country.code === '+229') {
              if (cleanPhone.length !== 10 || !cleanPhone.startsWith('01')) {
                return toast.error('Au Bénin, le numéro doit faire 10 chiffres et commencer par 01.')
              }
            }

            const maxAmount = selectedWithdrawEvent ? selectedWithdrawEvent.amount : (wallet?.balance || 0)
            if (amount > maxAmount) return toast.error('Solde insuffisant')
            setWithdrawStep('summary')
          }} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-gray-900 dark:text-white">Montant du retrait</label>
              <div className="flex items-center border border-[#E5E7EB] dark:border-gray-800 rounded-[14px] bg-white dark:bg-[#1A1A1A] overflow-hidden h-[56px] focus-within:border-2 focus-within:border-[#FF7A00] transition-all duration-150 shadow-sm">
                <input 
                  type="number"
                  min="500"
                  max={selectedWithdrawEvent ? selectedWithdrawEvent.amount : (wallet?.balance || 0)}
                  value={withdrawData.amount}
                  onChange={e => setWithdrawData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  className="flex-1 px-4 text-[16px] font-semibold text-gray-900 dark:text-white placeholder:text-[#C0C0C0] dark:placeholder:text-[#666] outline-none bg-transparent h-full"
                  required
                />
                <span className="pr-4 text-[14px] font-bold text-[#8D8D8D]">F CFA</span>
              </div>
              <span className="text-[12px] text-gray-400 mt-1 font-medium">Minimum 500 F</span>
            </div>

            <div className="flex flex-col gap-2" ref={operatorRef}>
              <label className="text-[14px] font-semibold text-gray-900 dark:text-white">Opérateur</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOperatorDropdown(!showOperatorDropdown)}
                  className="w-full flex flex-row items-center p-[12px] gap-[10px] h-[56px] bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-gray-800 rounded-[14px] active:bg-gray-50 dark:active:bg-[#222] transition-colors shadow-sm"
                >
                  <img src={selectedOperator.logo} alt={selectedOperator.label} className="w-8 h-8 object-contain shrink-0 rounded-md" />
                  <span className="flex-1 text-[15px] font-medium text-gray-900 dark:text-white text-left">{selectedOperator.label}</span>
                  <ChevronDown
                    className="w-5 h-5 text-[#8D8D8D] shrink-0 transition-transform duration-200"
                    style={{ transform: showOperatorDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {showOperatorDropdown && (
                  <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-30 bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-gray-800 rounded-[16px] shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {OPERATORS.map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setSelectedOperator(op)
                          setShowOperatorDropdown(false)
                        }}
                        className="w-full flex flex-row items-center p-[12px] gap-[10px] h-[56px] hover:bg-[#FFF8F0] dark:hover:bg-[#222] transition-colors border-b border-[#E5E7EB] dark:border-gray-800 last:border-0"
                      >
                        <img src={op.logo} alt={op.label} className="w-8 h-8 object-contain shrink-0 rounded-md" />
                        <span className="flex-1 text-[15px] font-medium text-gray-900 dark:text-white text-left">{op.label}</span>
                        {selectedOperator.id === op.id && (
                          <Check className="w-5 h-5 text-[#FF7A00] shrink-0" strokeWidth={3} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-gray-900 dark:text-white">Numéro de téléphone</label>
              <div className="w-full">
                <PhoneInputField
                  country={country}
                  onCountryChange={(c) => { setCountry(c); resetPhone() }}
                  phoneDisplay={phoneDisplay}
                  onPhoneChange={handlePhoneChange}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-[56px] rounded-[16px] bg-gradient-to-r from-[#FF7A00] to-[#FF991C] hover:opacity-90 text-white font-bold text-[16px] mt-4 shadow-[0_4px_14px_rgba(255,122,0,0.3)] transition-transform active:scale-[0.98]"
            >
              Continuer
            </Button>
          </form>
        </div>

        <BottomSheet open={withdrawStep === 'summary'} onClose={() => setWithdrawStep('form')}>
          <div className="px-6 pt-2 pb-8 flex flex-col gap-5 font-poppins">
            <h3 className="text-center text-[18px] font-bold text-gray-900 dark:text-white mb-2">Détails du retrait</h3>
            
            <div className="flex flex-col gap-1 items-center mb-2">
              <span className="text-[14px] text-gray-500 font-medium">Montant</span>
              <span className="text-[32px] font-bold text-gray-900 dark:text-white leading-none">{Number(withdrawData.amount).toLocaleString('fr-FR')} F</span>
            </div>

            <div className="bg-[#F8F9FA] dark:bg-[#1A1A1A] rounded-[16px] p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-gray-500">Depuis</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">Portefeuille principal</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-gray-500">Vers</span>
                <div className="flex items-center gap-2">
                  <img src={selectedOperator.logo} className="w-4 h-4" alt="" />
                  <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{selectedOperator.label}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-gray-500">Numéro</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{country.code} {phoneNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-gray-500">Frais</span>
                <span className="text-[14px] font-semibold text-green-600 dark:text-green-400">0 F (Gratuit)</span>
              </div>
            </div>

            <Button 
              onClick={() => withdrawMutation.mutate({ 
                amount: Number(withdrawData.amount), 
                phone: `${country.code}${phoneNumber.replace(/\s+/g, '')}`, 
                network: selectedOperator.id,
                ...(selectedWithdrawEvent ? { eventTitle: selectedWithdrawEvent.title, eventId: selectedWithdrawEvent.id } : {})
              })}
              disabled={withdrawMutation.isPending}
              className="w-full h-[56px] rounded-[16px] bg-gradient-to-r from-[#FF7A00] to-[#FF991C] hover:opacity-90 text-white font-bold text-[16px] mt-2 shadow-[0_4px_14px_rgba(255,122,0,0.3)] transition-transform active:scale-[0.98]"
            >
              {withdrawMutation.isPending ? 'Traitement en cours...' : 'Confirmer le retrait'}
            </Button>
          </div>
        </BottomSheet>
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] dark:bg-[#09090b] flex flex-col h-[100dvh] w-full font-poppins overflow-hidden">
      <div className="flex-none bg-[#F8F9FA]/90 dark:bg-[#09090b]/90 backdrop-blur-md px-4 pt-12 pb-2 flex flex-col border-b border-transparent z-40">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/account')} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={2.5} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight">Mon Portefeuille</h1>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Gérez vos fonds en toute simplicité</span>
          </div>
          <button onClick={() => setShowWalletPinModal(true)} className="p-2 -mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            <Lock className="w-5 h-5 text-gray-900 dark:text-white" strokeWidth={2} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto flex flex-col px-5 py-4 w-full max-w-[480px] mx-auto gap-6 pb-24">
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-[24px] bg-gradient-to-r from-[#FF7A00] via-[#FF9500] to-[#FFB340] shadow-[0_8px_24px_rgba(255,122,0,0.35)] p-5 relative overflow-hidden flex flex-row items-center justify-between min-h-[130px]"
        >
          {/* Decorative background circles */}
          <div className="absolute right-[60px] top-[-30px] w-[120px] h-[120px] rounded-full bg-white/10" />
          <div className="absolute right-[20px] top-[-50px] w-[160px] h-[160px] rounded-full bg-white/10" />
          <div className="absolute right-[-10px] bottom-[-60px] w-[130px] h-[130px] rounded-full bg-white/10" />

          {/* Left: text content */}
          <div className="relative z-10 flex flex-col gap-0.5 flex-1 pr-4">
            <div className="flex items-center gap-1.5 text-white/90">
              <span className="text-[13px] font-semibold">Solde disponible</span>
              <AlertCircle size={13} className="opacity-80" />
            </div>

            <div className="flex items-baseline gap-1 mt-1.5">
              {isLoadingWallet ? (
                <div className="h-[42px] w-36 bg-white/20 animate-pulse rounded-lg" />
              ) : (
                <>
                  <span className="text-[38px] font-extrabold text-white tracking-tight leading-none">
                    {wallet?.balance?.toLocaleString('fr-FR') || 0}
                  </span>
                  <span className="text-[17px] font-bold text-white/90 ml-1 mb-0.5">F CFA</span>
                </>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 bg-[#2E7D32]/80 px-3 py-1 rounded-full w-max mt-2.5">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
              <span className="text-[11px] font-bold text-white">Disponible pour retrait</span>
            </div>
          </div>

          {/* Right: 3D wallet icon */}
          <div className="relative z-10 shrink-0 w-[90px] h-[90px] flex items-center justify-center">
            {/* Main wallet body */}
            <svg width="80" height="72" viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Wallet body */}
              <rect x="4" y="20" width="72" height="48" rx="10" fill="white" fillOpacity="0.35"/>
              <rect x="4" y="20" width="72" height="48" rx="10" stroke="white" strokeOpacity="0.5" strokeWidth="1"/>
              {/* Wallet flap */}
              <path d="M4 30 Q4 20 14 20 H66 Q76 20 76 30" fill="white" fillOpacity="0.5"/>
              {/* Card slot / pocket */}
              <rect x="48" y="36" width="24" height="16" rx="5" fill="white" fillOpacity="0.5" stroke="white" strokeOpacity="0.6" strokeWidth="0.8"/>
              {/* Coin circle */}
              <circle cx="60" cy="44" r="5" fill="white" fillOpacity="0.8"/>
              {/* Strap lines */}
              <line x1="4" y1="30" x2="76" y2="30" stroke="white" strokeOpacity="0.4" strokeWidth="1"/>
            </svg>
            {/* Coins below */}
            <div className="absolute bottom-[-4px] right-[-4px] flex gap-0.5">
              <div className="w-6 h-6 rounded-full bg-yellow-300 shadow-[0_2px_6px_rgba(0,0,0,0.2)] border-2 border-yellow-100/50 flex items-center justify-center">
                <span className="text-[8px] font-black text-yellow-700">$</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-yellow-400 shadow-[0_2px_4px_rgba(0,0,0,0.15)] border-2 border-yellow-200/50 mt-1">
              </div>
            </div>
          </div>
        </motion.div>


        <div className="flex items-start justify-between gap-3">
          <button onClick={() => setShowEventSelector(true)} className="flex-1 flex flex-col items-center gap-2 px-1 py-3 bg-[#FFF3E6] dark:bg-[#FF7A00]/10 rounded-[16px] border border-[#FFE4C4] dark:border-[#FF7A00]/20 active:scale-95 transition-transform shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center shadow-md shadow-orange-500/20">
              <ArrowUpRight className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white text-center leading-tight">Retirer des<br/>fonds</span>
          </button>

          <button onClick={() => { setActiveTab('overview'); setTimeout(() => document.getElementById('tx-list')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="flex-1 flex flex-col items-center gap-2 px-1 py-3 bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 shadow-sm active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center border border-gray-200 dark:border-gray-700">
              <History className="w-5 h-5 text-gray-800 dark:text-gray-200" strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 text-center leading-tight">Historique</span>
          </button>

          <button onClick={() => setShowSettingsModal(true)} className="flex-1 flex flex-col items-center gap-2 px-1 py-3 bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 shadow-sm active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center border border-gray-200 dark:border-gray-700">
              <Settings className="w-5 h-5 text-gray-800 dark:text-gray-200" strokeWidth={2} />
            </div>
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 text-center leading-tight">Paramètres</span>
          </button>
        </div>

        <div id="wallet-tabs-content" className="flex border-b border-gray-200 dark:border-gray-800 mt-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-[14px] font-bold transition-all duration-200 border-b-2 ${
              activeTab === 'overview' 
                ? 'border-[#FF7A00] text-[#FF7A00]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-3 text-[14px] font-bold transition-all duration-200 border-b-2 ${
              activeTab === 'events' 
                ? 'border-[#FF7A00] text-[#FF7A00]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Par événement
          </button>
        </div>

        {activeTab === 'overview' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="flex justify-between bg-white dark:bg-[#1A1A1A] rounded-[16px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-gray-800">
              <div className="flex flex-col items-center gap-1.5 flex-1 relative">
                <div className="w-8 h-8 rounded-full flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-500">Total gagné</span>
                <span className="text-[13px] font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                  {isLoadingStats ? '...' : (stats?.totalEarned?.toLocaleString('fr-FR') || 0)} F CFA
                </span>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-10 bg-gray-100 dark:bg-gray-800" />
              </div>

              <div className="flex flex-col items-center gap-1.5 flex-1 relative">
                <div className="w-8 h-8 rounded-full flex items-center justify-center">
                  <ArrowUpRight className="w-6 h-6 text-[#4CAF50]" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-semibold text-gray-500">Total retiré</span>
                <span className="text-[13px] font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                  {isLoadingStats ? '...' : (stats?.totalWithdrawn?.toLocaleString('fr-FR') || 0)} F CFA
                </span>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-10 bg-gray-100 dark:bg-gray-800" />
              </div>

              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-[#9C27B0]" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 text-center leading-tight px-1">Événements actifs</span>
                <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">
                  {isLoadingStats ? '...' : (stats?.activeEventsCount || 0)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-[16px] text-gray-900 dark:text-white">Fonds par événement</h3>
                <button onClick={() => setActiveTab('events')} className="text-[13px] font-bold text-[#FF7A00]">Voir tout &gt;</button>
              </div>

              {isLoadingStats ? (
                Array(2).fill(0).map((_, i) => <div key={i} className="w-full h-[110px] bg-white dark:bg-[#1A1A1A] rounded-[20px] animate-pulse border border-gray-100 dark:border-gray-800" />)
              ) : !stats?.poolEvents || stats.poolEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                  <p className="text-gray-500 text-[13px] font-medium">Aucun événement avec cagnotte débloquée.</p>
                </div>
              ) : (
                stats.poolEvents.slice(0, 3).map((evt) => (
                  <div key={evt.id} className="w-full bg-white dark:bg-[#1A1A1A] rounded-[20px] p-3 flex flex-row items-center gap-3 border border-gray-100 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div className="w-[100px] h-[80px] rounded-[14px] bg-gray-200 dark:bg-gray-800 overflow-hidden relative shrink-0">
                      <SafeImage src={evt.coverUrl || undefined} alt={evt.title} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${new Date(evt.startAt) > new Date() ? 'bg-[#4CAF50]' : 'bg-gray-400'}`} />
                        <span className="text-[10px] font-bold text-white leading-none">
                          {new Date(evt.startAt) > new Date() ? 'En cours' : 'Terminé'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col flex-1 py-1">
                      <h4 className="font-bold text-[14px] text-gray-900 dark:text-white line-clamp-1">{evt.title}</h4>
                      <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">
                          {new Date(evt.startAt).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span className="text-[11px] font-medium line-clamp-1">{evt.city}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0 h-full justify-between py-1 border-l border-gray-100 dark:border-gray-800 pl-2">
                      <div className="flex items-start justify-between w-full">
                        <div className="flex flex-col items-end w-full">
                          <span className="text-[10px] font-semibold text-gray-500">Solde disponible</span>
                          <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">{evt.available.toLocaleString('fr-FR')} F</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedWithdrawEvent({ id: evt.id, title: evt.title, amount: evt.available });
                          setWithdrawMode(true);
                          setWithdrawData({ amount: evt.available.toString() });
                        }}
                        className="bg-[#FFF3E6] dark:bg-[#FF7A00]/10 text-[#FF7A00] text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <ArrowUpRight size={14} strokeWidth={3} />
                        Retirer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-3" id="tx-list">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-[16px] text-gray-900 dark:text-white">Transactions récentes</h3>
                <button onClick={() => { setActiveTab('events'); setTimeout(() => document.getElementById('tx-list')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="text-[13px] font-bold text-[#FF7A00]">Voir tout &gt;</button>
              </div>

              {isLoadingTx ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="w-full h-[76px] bg-white dark:bg-[#1A1A1A] rounded-[16px] animate-pulse border border-gray-100 dark:border-gray-800" />
                ))
              ) : !transactions || transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-[14px] font-medium">Aucune transaction pour le moment.</p>
                </div>
              ) : (
                transactions.slice(0, 10).map((tx) => (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={tx.id} 
                    onClick={() => setSelectedTx(tx)}
                    className="w-full bg-white dark:bg-[#1A1A1A] rounded-[16px] p-4 flex flex-row items-center gap-3 border border-gray-100 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shrink-0 border ${
                      tx.type === 'DEPOSIT' 
                        ? 'bg-[#E8F5E9] dark:bg-green-900/30 text-[#4CAF50] border-[#C8E6C9] dark:border-green-800'
                        : 'bg-[#FFF3E6] dark:bg-[#FF7A00]/10 text-[#FF7A00] border-[#FFE4C4] dark:border-[#FF7A00]/20'
                    }`}>
                      {tx.type === 'DEPOSIT' ? <ArrowDownLeft size={22} strokeWidth={2.5} /> : <ArrowUpRight size={22} strokeWidth={2.5} />}
                    </div>
                    
                    <div className="flex flex-col flex-1 justify-center">
                      <span className="font-bold text-[14px] text-gray-900 dark:text-white line-clamp-1">{tx.description}</span>
                      <span className="text-[12px] font-medium text-gray-500 flex items-center">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' •')}
                      </span>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className={`font-extrabold text-[15px] ${
                        tx.type === 'DEPOSIT' ? 'text-[#4CAF50]' : 'text-gray-900 dark:text-white'
                      }`}>
                        {tx.type === 'DEPOSIT' ? '+' : '- '} {tx.amount.toLocaleString('fr-FR')} F
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 mt-1 rounded-full ${
                        (tx.status || 'COMPLETED') === 'COMPLETED' ? 'bg-[#E8F5E9] text-[#4CAF50] dark:bg-green-900/30 dark:text-green-400' :
                        tx.status === 'PENDING' ? 'bg-[#FFF3E6] text-[#FF7A00] dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {(tx.status || 'COMPLETED') === 'COMPLETED' ? 'Réussi' : tx.status === 'PENDING' ? 'En cours' : 'Échec'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'events' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[16px] text-gray-900 dark:text-white">Tous les événements débloqués</h3>
            </div>

            {isLoadingStats ? (
               Array(2).fill(0).map((_, i) => (
                <div key={i} className="w-full h-[110px] bg-white dark:bg-[#1A1A1A] rounded-[20px] animate-pulse border border-gray-100 dark:border-gray-800" />
              ))
            ) : !stats?.poolEvents || stats.poolEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 text-[14px] font-medium">Aucun événement avec cagnotte débloquée.</p>
              </div>
            ) : (
              stats.poolEvents.map((evt) => (
                <div key={evt.id} className="w-full bg-white dark:bg-[#1A1A1A] rounded-[20px] p-3 flex flex-row items-center gap-3 border border-gray-100 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="w-[100px] h-[80px] rounded-[14px] bg-gray-200 dark:bg-gray-800 overflow-hidden relative shrink-0">
                    <SafeImage src={evt.coverUrl || undefined} alt={evt.title} className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${new Date(evt.startAt) > new Date() ? 'bg-[#4CAF50]' : 'bg-gray-400'}`} />
                      <span className="text-[10px] font-bold text-white leading-none">
                        {new Date(evt.startAt) > new Date() ? 'En cours' : 'Terminé'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 py-1">
                    <h4 className="font-bold text-[14px] text-gray-900 dark:text-white line-clamp-1">{evt.title}</h4>
                    <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">
                        {new Date(evt.startAt).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span className="text-[11px] font-medium line-clamp-1">{evt.city}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 h-full justify-between py-1 border-l border-gray-100 dark:border-gray-800 pl-2">
                    <div className="flex items-start justify-between w-full">
                      <div className="flex flex-col items-end w-full">
                        <span className="text-[10px] font-semibold text-gray-500">Solde disponible</span>
                        <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">{evt.available.toLocaleString('fr-FR')} F</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedWithdrawEvent({ id: evt.id, title: evt.title, amount: evt.available });
                        setWithdrawMode(true);
                        setWithdrawData({ amount: evt.available.toString() });
                      }}
                      className="bg-[#FFF3E6] dark:bg-[#FF7A00]/10 text-[#FF7A00] text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                    >
                      <ArrowUpRight size={14} strokeWidth={3} />
                      Retirer
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

      <BottomSheet open={!!selectedTx} onClose={() => setSelectedTx(null)}>
        {selectedTx && (
          <div className="p-6 flex flex-col gap-6 font-poppins">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                selectedTx.type === 'DEPOSIT' 
                  ? 'bg-[#E8F5E9] dark:bg-green-900/30 text-[#4CAF50]'
                  : 'bg-[#FFF3E6] dark:bg-[#FF7A00]/20 text-[#FF7A00]'
              }`}>
                {selectedTx.type === 'DEPOSIT' ? <ArrowDownLeft size={32} /> : <ArrowUpRight size={32} />}
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-2">
                {selectedTx.type === 'DEPOSIT' ? '+' : '-'} {selectedTx.amount.toLocaleString('fr-FR')} F CFA
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                (selectedTx.status || 'COMPLETED') === 'COMPLETED' ? 'bg-[#E8F5E9] dark:bg-green-900/30 text-[#4CAF50]' :
                selectedTx.status === 'PENDING' ? 'bg-[#FFF3E6] dark:bg-orange-900/30 text-[#FF7A00]' :
                'bg-red-50 dark:bg-red-900/30 text-red-500'
              }`}>
                {(selectedTx.status || 'COMPLETED') === 'COMPLETED' ? 'Terminé' : selectedTx.status === 'PENDING' ? 'En cours' : 'Échoué'}
              </span>
            </div>

            <div className="bg-[#F8F9FA] dark:bg-[#1A1A1A] rounded-2xl p-4 flex flex-col gap-4 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-medium text-gray-500">Type</span>
                <span className="text-[14px] font-bold text-gray-900 dark:text-white">
                  {selectedTx.type === 'DEPOSIT' ? 'Dépôt' : selectedTx.type === 'REFUND' ? 'Remboursement' : 'Retrait'}
                </span>
              </div>
              <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full" />
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-medium text-gray-500">Date</span>
                <span className="text-[14px] font-bold text-gray-900 dark:text-white">
                  {new Date(selectedTx.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full" />
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-medium text-gray-500">ID Transaction</span>
                <span className="text-[14px] font-bold font-mono text-gray-900 dark:text-white text-right max-w-[180px] truncate">
                  {selectedTx.id}
                </span>
              </div>
            </div>

            <div className="bg-[#F8F9FA] dark:bg-[#1A1A1A] rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <h3 className="text-[14px] font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-relaxed">
                {selectedTx.description}
              </p>
            </div>

            <Button onClick={() => setSelectedTx(null)} className="w-full mt-4 h-[56px] rounded-[16px] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 font-bold text-[16px]">
              Fermer
            </Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={showEventSelector} onClose={() => setShowEventSelector(false)}>
        <div className="px-4 pt-5 pb-8 flex flex-col gap-3 font-poppins max-h-[85vh]">
          <h3 className="text-[18px] font-bold text-gray-900 dark:text-white text-center">Choisir l'origine des fonds</h3>
          <p className="text-[13px] text-gray-500 text-center mb-1">Sélectionnez la cagnotte depuis laquelle vous souhaitez retirer de l'argent.</p>
          
          <div className="flex flex-col gap-3 overflow-y-auto pb-4 flex-1">
            {stats?.poolEvents?.map(evt => (
              <div 
                key={evt.id}
                className="w-full bg-white dark:bg-[#1A1A1A] rounded-[20px] p-3 flex flex-row items-center gap-3 border border-gray-100 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
              >
                <div className="w-[100px] h-[80px] rounded-[14px] bg-gray-200 dark:bg-gray-800 overflow-hidden relative shrink-0">
                  <SafeImage src={evt.coverUrl || undefined} alt={evt.title} className="w-full h-full object-cover" />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${new Date(evt.startAt) > new Date() ? 'bg-[#4CAF50]' : 'bg-gray-400'}`} />
                    <span className="text-[10px] font-bold text-white leading-none">
                      {new Date(evt.startAt) > new Date() ? 'En cours' : 'Terminé'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col flex-1 py-1">
                  <h4 className="font-bold text-[14px] text-gray-900 dark:text-white line-clamp-1">{evt.title}</h4>
                  <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">
                      {new Date(evt.startAt).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span className="text-[11px] font-medium line-clamp-1">{evt.city}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0 h-full justify-between py-1 border-l border-gray-100 dark:border-gray-800 pl-2">
                  <div className="flex items-start justify-between w-full">
                    <div className="flex flex-col items-end w-full">
                      <span className="text-[10px] font-semibold text-gray-500">Solde disponible</span>
                      <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">{evt.available.toLocaleString('fr-FR')} F</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedWithdrawEvent({ id: evt.id, title: evt.title, amount: evt.available });
                      setShowEventSelector(false);
                      setWithdrawMode(true);
                      setWithdrawData({ amount: evt.available.toString() });
                    }}
                    className="bg-[#FFF3E6] dark:bg-[#FF7A00]/10 text-[#FF7A00] text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    <ArrowUpRight size={14} strokeWidth={3} />
                    Retirer
                  </button>
                </div>
              </div>
            ))}
            
            {stats?.poolEvents?.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Aucune cagnotte débloquée disponible.</p>
            )}
            
            <button 
              onClick={() => { 
                setSelectedWithdrawEvent(null);
                setShowEventSelector(false);
                setWithdrawMode(true);
                setWithdrawData({ amount: wallet?.balance?.toString() || '' });
              }}
              className="flex flex-row items-center justify-between p-3 bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-transform text-left shadow-sm mt-2"
            >
              <div className="flex flex-col items-start flex-1 pr-3">
                <span className="font-bold text-[14px] text-gray-900 dark:text-white">Portefeuille global</span>
                <span className="text-[12px] text-gray-500 font-medium mt-0.5">Solde total: {wallet?.balance?.toLocaleString('fr-FR') || 0} F CFA</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 shrink-0">
                <Landmark size={16} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </div>
      </BottomSheet>

      {showWalletPinModal && (
        <div className="fixed inset-0 z-[100] bg-[#F8F9FA] dark:bg-[#09090b]">
          <WalletPinManager 
            isChangeMode={true}
            onClose={() => setShowWalletPinModal(false)} 
            onVerified={() => setShowWalletPinModal(false)} 
          />
        </div>
      )}

      <BottomSheet open={showSettingsModal} onClose={() => setShowSettingsModal(false)}>
        <div className="p-6 flex flex-col gap-6 font-poppins pb-8">
          <h3 className="text-[18px] font-bold text-gray-900 dark:text-white text-center">Paramètres du portefeuille</h3>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => { setShowSettingsModal(false); setShowWalletPinModal(true) }}
              className="flex items-center gap-4 p-4 bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#FF7A00] shrink-0">
                <Lock size={20} />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-[15px] text-gray-900 dark:text-white">Gérer mon code PIN</span>
                <span className="text-[12px] text-gray-500">Modifier votre code de sécurité</span>
              </div>
            </button>

            <button 
              onClick={() => { setShowSettingsModal(false); toast.info('Bientôt disponible') }}
              className="flex items-center gap-4 p-4 bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-[15px] text-gray-900 dark:text-white">Mes comptes bancaires</span>
                <span className="text-[12px] text-gray-500">Gérer vos moyens de retrait</span>
              </div>
            </button>
          </div>
          
          <Button onClick={() => setShowSettingsModal(false)} className="w-full h-[56px] rounded-[16px] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 font-bold text-[16px]">
            Fermer
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
