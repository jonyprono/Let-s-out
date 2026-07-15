import { useState } from 'react'
import { motion } from 'motion/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WalletIcon, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useNavigate } from 'react-router'
import { ChevronLeft, Lock } from 'lucide-react'
import { WalletPinManager } from './WalletPinManager'
import { useAuthStore } from '@/stores/auth.store'

interface WalletData {
  id: string
  balance: number
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
  const [withdrawMode, setWithdrawMode] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<'form' | 'summary'>('form')
  const [withdrawData, setWithdrawData] = useState({ network: 'mtn', phone: '', amount: '' })
  const [pinToken, setPinToken] = useState<string | null>(null)
  const [showWalletPinModal, setShowWalletPinModal] = useState(false)
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null)

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

  // Payout Mutation
  const withdrawMutation = useMutation({
    mutationFn: async (payload: { amount: number; phone: string; network: string }) => {
      const res = await apiClient.post('/wallet/payout', payload, { headers: { 'x-wallet-pin-token': pinToken } })
      return res.data
    },
    onSuccess: () => {
      toast.success('Demande de retrait initiée avec succès')
      setWithdrawMode(false)
      setWithdrawStep('form')
      setWithdrawData({ network: 'mtn', phone: '', amount: '' })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors du retrait')
    },
  })


  const navigate = useNavigate()

  if (user?.profile?.kycStatus !== 'verified') {
    return (
      <div className={`bg-[#F9FAFB] dark:bg-[#09090b] flex flex-col min-h-[100dvh] w-full`}>
        <div className="sticky top-0 z-40 bg-[#F9FAFB]/80 dark:bg-[#09090b]/80 backdrop-blur-md px-4 pt-12 pb-2 flex items-center border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">Mon Portefeuille</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Accès restreint</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Votre profil n'est pas encore vérifié. Vous devez vérifier votre identité pour accéder au portefeuille.
          </p>
          <Button onClick={() => navigate('/settings')} className="mt-4 bg-[#FF991C] hover:bg-[#e68a19] text-white rounded-[16px] h-12 px-6">
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
      <div className="bg-[#F9FAFB] dark:bg-[#09090b] flex flex-col min-h-[100dvh] w-full">
        <div className="sticky top-0 z-40 bg-[#F9FAFB]/80 dark:bg-[#09090b]/80 backdrop-blur-md px-4 pt-12 pb-2 flex items-center border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => setWithdrawMode(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">Initier un retrait</h1>
        </div>
        
        <div className="flex-1 flex flex-col p-4 sm:p-6 gap-6">
          {/* Header Card */}
          <div className="bg-gray-100 dark:bg-[#18181b] rounded-2xl p-4 flex flex-col gap-2">
            <h2 className="text-[16px] font-bold text-gray-900 dark:text-white">Mon Portefeuille</h2>
            <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-1" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Solde disponible</span>
              <span className="text-[15px] font-bold text-blue-500">{wallet?.balance?.toLocaleString('fr-FR')} F</span>
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault()
            const amount = Number(withdrawData.amount)
            if (!amount || amount < 500) return toast.error('Le montant minimum est de 500 F CFA')
            if (!withdrawData.phone) return toast.error('Numéro de téléphone invalide')
            if (wallet && amount > wallet.balance) return toast.error('Solde insuffisant')
            setWithdrawStep('summary')
          }} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-500">Montant du retrait</label>
              <div className="relative flex items-center">
                <input 
                  type="number"
                  min="500"
                  max={wallet?.balance || 0}
                  value={withdrawData.amount}
                  onChange={e => setWithdrawData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full pl-4 pr-16 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[15px] bg-transparent text-gray-900 dark:text-white focus:outline-none focus:border-[#FF7A00]"
                  required
                />
                <span className="absolute right-4 text-[15px] font-medium text-gray-500 pointer-events-none">F CFA</span>
              </div>
              <span className="text-[12px] text-gray-400 mt-1">Minimum 500F</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-500">Réseau Mobile</label>
              <select 
                value={withdrawData.network}
                onChange={e => setWithdrawData(prev => ({ ...prev, network: e.target.value }))}
                className="h-[52px] w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 text-[15px] dark:text-white focus:outline-none focus:border-[#FF991C]"
              >
                <option value="mtn">MTN Mobile Money</option>
                <option value="moov">Moov Money</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-500">Numéro de téléphone</label>
              <div className="relative flex items-center">
                <input 
                  type="tel"
                  placeholder="Ex: 97000000"
                  value={withdrawData.phone}
                  onChange={e => setWithdrawData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-4 pr-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[15px] bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-[52px] rounded-full bg-[#FF7A00] hover:bg-[#e66a00] text-white font-bold text-[15px] mt-4"
            >
              Continuer
            </Button>
          </form>
        </div>

        {/* Summary BottomSheet */}
        <BottomSheet open={withdrawStep === 'summary'} onClose={() => setWithdrawStep('form')}>
          <div className="px-5 pt-2 pb-8 flex flex-col gap-4">
            <h3 className="text-center text-[16px] font-bold text-gray-900 dark:text-white mb-2">Détails du retrait</h3>
            
            <div>
              <p className="text-[17px] font-bold text-gray-900 dark:text-white">Mon Portefeuille</p>
            </div>

            <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-2" />

            <div className="flex flex-col gap-4 text-[14px]">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Cagnotte</span>
                <span className="font-semibold text-gray-900 dark:text-white">Portefeuille principal</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Montant</span>
                <span className="font-semibold text-gray-900 dark:text-white">{Number(withdrawData.amount).toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Commission</span>
                <span className="font-semibold text-gray-900 dark:text-white">0 F</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Méthode</span>
                <span className="font-semibold text-gray-900 dark:text-white">{withdrawData.network === 'mtn' ? 'MTN Mobile Money' : 'Moov Money'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Numéro</span>
                <span className="font-semibold text-gray-900 dark:text-white">{withdrawData.phone}</span>
              </div>

              <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-2" />

              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total à débiter</span>
                <span className="font-semibold text-gray-900 dark:text-white">{Number(withdrawData.amount).toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total à recevoir</span>
                <span className="font-semibold text-[#FF7A00] dark:text-[#FF7A00]">{Number(withdrawData.amount).toLocaleString('fr-FR')} F</span>
              </div>
            </div>

            <Button 
              onClick={() => withdrawMutation.mutate({ amount: Number(withdrawData.amount), phone: withdrawData.phone, network: withdrawData.network })}
              disabled={withdrawMutation.isPending}
              className="w-full h-[52px] rounded-full bg-[#FF7A00] hover:bg-[#e66a00] text-white font-bold text-[15px] mt-6"
            >
              {withdrawMutation.isPending ? 'Traitement...' : 'Confirmer'}
            </Button>
          </div>
        </BottomSheet>
      </div>
    )
  }

  return (
    <div className={`bg-[#F9FAFB] dark:bg-[#09090b] flex flex-col min-h-[100dvh] w-full overflow-y-auto`}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#F9FAFB]/80 dark:bg-[#09090b]/80 backdrop-blur-md px-4 pt-12 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white">Mon Portefeuille</h1>
        <button onClick={() => setShowWalletPinModal(true)} className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <Lock className="w-5 h-5 text-gray-900 dark:text-white" />
        </button>
      </div>
      
      <div className="flex flex-col flex-1 px-4 sm:px-6 py-6 w-full max-w-[430px] mx-auto gap-6">
        
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white dark:bg-[#18181b] rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col gap-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <WalletIcon size={80} />
          </div>
          
          <div className="flex flex-col gap-1 z-10">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Solde Disponible</span>
            <div className="flex items-baseline gap-2">
              {isLoadingWallet ? (
                <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg" />
              ) : (
                <>
                  <span className="text-[36px] font-bold text-gray-900 dark:text-white tracking-tight">
                    {wallet?.balance?.toLocaleString('fr-FR') || 0}
                  </span>
                  <span className="text-[18px] font-semibold text-gray-500 dark:text-gray-400">F CFA</span>
                </>
              )}
            </div>
          </div>

          <Button 
            className="w-full mt-2 h-12 rounded-[16px] bg-[#FF991C] hover:bg-[#e68a19] text-white font-semibold flex items-center justify-center gap-2 z-10"
            onClick={() => setWithdrawMode(true)}
            disabled={!wallet || wallet.balance <= 0 || isLoadingWallet}
          >
            <ArrowUpRight size={20} />
            Retirer mes fonds
          </Button>
        </motion.div>

        {/* Transactions List */}
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[18px] text-gray-900 dark:text-white">Historique</h3>
          </div>

          <div className="flex flex-col gap-3 pb-8">
            {isLoadingTx ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="w-full h-[72px] bg-white dark:bg-[#18181b] rounded-2xl animate-pulse" />
              ))
            ) : !transactions || transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-[15px]">Aucune transaction pour le moment.</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={tx.id} 
                  onClick={() => setSelectedTx(tx)}
                  className="w-full bg-white dark:bg-[#18181b] rounded-2xl p-4 flex items-center justify-between border border-gray-100 dark:border-gray-800 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'DEPOSIT' 
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {tx.type === 'DEPOSIT' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[15px] text-gray-900 dark:text-white line-clamp-1 text-left">{tx.description}</span>
                      <span className="text-[13px] text-gray-500 flex items-center gap-1 text-left">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {tx.status === 'PENDING' && <><AlertCircle size={12} className="text-yellow-500 ml-1"/> En cours</>}
                        {(tx.status || 'COMPLETED') === 'FAILED' && <><AlertCircle size={12} className="text-red-500 ml-1"/> Échec</>}
                      </span>
                    </div>
                  </div>
                  <div className={`font-semibold shrink-0 text-[15px] ${
                    tx.type === 'DEPOSIT' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount} F
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Transaction Details Modal */}
      <BottomSheet open={!!selectedTx} onClose={() => setSelectedTx(null)}>
        {selectedTx && (
          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                selectedTx.type === 'DEPOSIT' 
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
              }`}>
                {selectedTx.type === 'DEPOSIT' ? <ArrowDownLeft size={32} /> : <ArrowUpRight size={32} />}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {selectedTx.type === 'DEPOSIT' ? '+' : '-'}{selectedTx.amount} F CFA
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                (selectedTx.status || 'COMPLETED') === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                selectedTx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              }`}>
                {(selectedTx.status || 'COMPLETED') === 'COMPLETED' ? 'Terminé' : selectedTx.status === 'PENDING' ? 'En cours' : 'Échoué'}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-[#18181b] rounded-2xl p-4 flex flex-col gap-4 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Type</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedTx.type === 'DEPOSIT' ? 'Dépôt' : selectedTx.type === 'REFUND' ? 'Remboursement' : 'Retrait'}
                </span>
              </div>
              <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(selectedTx.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">ID Transaction</span>
                <span className="text-sm font-mono text-gray-900 dark:text-white text-right max-w-[180px] truncate">
                  {selectedTx.id}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-[#18181b] rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h3>
              <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                {selectedTx.description}
              </p>
            </div>

            <Button onClick={() => setSelectedTx(null)} className="w-full mt-4 h-12 rounded-[16px] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700">
              Fermer
            </Button>
          </div>
        )}
      </BottomSheet>



      {/* Modals */}
      {showWalletPinModal && (
        <div className="fixed inset-0 z-[100] bg-[#F9FAFB] dark:bg-[#09090b]">
          <WalletPinManager 
            isChangeMode={true}
            onClose={() => setShowWalletPinModal(false)} 
            onVerified={() => setShowWalletPinModal(false)} 
          />
        </div>
      )}
    </div>
  )
}
