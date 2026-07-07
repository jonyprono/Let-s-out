import { useState } from 'react'
import { motion } from 'motion/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WalletIcon, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, Phone, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

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
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)

  // Fetch Wallet Balance
  const { data: wallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WalletData }>('/wallet')
      return res.data.data
    },
  })

  // Fetch Transactions
  const { data: transactions, isLoading: isLoadingTx } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WalletTransaction[] }>('/wallet/transactions')
      return res.data.data
    },
  })

  // Payout Mutation
  const withdrawMutation = useMutation({
    mutationFn: async (payload: { amount: number; phone: string; network: string }) => {
      const res = await apiClient.post('/wallet/payout', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success('Demande de retrait initiée avec succès')
      setIsWithdrawModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors du retrait')
    },
  })

  const handleWithdraw = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const amount = Number(formData.get('amount'))
    const phone = formData.get('phone') as string
    const network = formData.get('network') as string

    if (!amount || amount < 500) {
      return toast.error('Le montant minimum est de 500 F CFA')
    }
    if (!phone) {
      return toast.error('Numéro de téléphone invalide')
    }
    if (wallet && amount > wallet.balance) {
      return toast.error('Solde insuffisant')
    }

    withdrawMutation.mutate({ amount, phone, network })
  }

  const navigate = useNavigate()

  return (
    <div className={`bg-[#F9FAFB] dark:bg-[#09090b] flex flex-col min-h-[100dvh] w-full overflow-y-auto`}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#F9FAFB]/80 dark:bg-[#09090b]/80 backdrop-blur-md px-4 h-14 flex items-center border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white mx-auto pr-8">Mon Portefeuille</h1>
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
            onClick={() => setIsWithdrawModalOpen(true)}
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
                  className="w-full bg-white dark:bg-[#18181b] rounded-2xl p-4 flex items-center justify-between border border-gray-100 dark:border-gray-800"
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
                      <span className="font-medium text-[15px] text-gray-900 dark:text-white line-clamp-1">{tx.description}</span>
                      <span className="text-[13px] text-gray-500 flex items-center gap-1">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {tx.status === 'PENDING' && <><AlertCircle size={12} className="text-yellow-500 ml-1"/> En cours</>}
                        {tx.status === 'FAILED' && <><AlertCircle size={12} className="text-red-500 ml-1"/> Échec</>}
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

      {/* Withdraw Modal */}
      <BottomSheet open={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)}>
        <div className="p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Retirer vers Mobile Money</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">L'argent sera transféré instantanément sur votre compte.</p>
          </div>
          
          <form onSubmit={handleWithdraw} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Réseau Mobile</label>
              <select name="network" defaultValue="mtn" className="h-12 w-full rounded-[14px] border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#18181b] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF991C]">
                <option value="mtn">MTN Mobile Money</option>
                <option value="moov">Moov Money</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Numéro de téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-gray-400" size={20} />
                <Input 
                  name="phone"
                  type="tel"
                  placeholder="Ex: 97000000"
                  className="pl-10 h-12 rounded-[14px]"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Montant à retirer (F CFA)</label>
              <div className="relative">
                <Landmark className="absolute left-3 top-3 text-gray-400" size={20} />
                <Input 
                  name="amount"
                  type="number"
                  min="500"
                  max={wallet?.balance || 0}
                  defaultValue={wallet?.balance || 0}
                  className="pl-10 h-12 rounded-[14px]"
                  required
                />
              </div>
              <span className="text-[12px] text-gray-500">
                Solde max: {wallet?.balance?.toLocaleString('fr-FR')} F CFA
              </span>
            </div>

            <div className="mt-4 pb-8">
              <Button 
                type="submit" 
                className="w-full h-12 rounded-[16px] bg-[#FF991C] hover:bg-[#e68a19] text-white font-semibold"
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? 'Traitement...' : 'Confirmer le retrait'}
              </Button>
            </div>
          </form>
        </div>
      </BottomSheet>
    </div>
  )
}
