import { Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'
import i18n from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { SafeImage } from '@/components/shared/SafeImage'
import { useTranslation } from 'react-i18next'

interface JoinPendingScreenProps {
  event: any
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED'
  onCancel: () => void
  isCancelling?: boolean
  organizer: any
}

export function JoinPendingScreen({ status, onCancel, isCancelling, organizer }: JoinPendingScreenProps) {
  const { t } = useTranslation()
  const isPending = status === 'PENDING'
  const isConfirmed = status === 'CONFIRMED'
  const isRejected = status === 'CANCELLED' || status === 'REJECTED'

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in zoom-in duration-300">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg relative z-10 bg-gray-100">
          {organizer?.profile?.avatarUrl ? (
            <SafeImage src={organizer.profile.avatarUrl} alt={t('joinPendingScreen.organisateur')} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#FFF2E5] text-[#FF7A00] text-2xl font-bold">
              {organizer?.profile?.displayName?.[0]?.toUpperCase() || 'O'}
            </div>
          )}
        </div>
        
        {/* Status Badge */}
        <div className="absolute -bottom-2 -right-2 z-20 bg-white rounded-full p-1 shadow-sm">
          {isPending && <div className="bg-amber-100 text-amber-500 rounded-full p-1.5"><Clock className="w-5 h-5" /></div>}
          {isConfirmed && <div className="bg-green-100 text-green-500 rounded-full p-1.5"><CheckCircle2 className="w-5 h-5" /></div>}
          {isRejected && <div className="bg-red-100 text-red-500 rounded-full p-1.5"><XCircle className="w-5 h-5" /></div>}
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {isPending && t('joinPendingScreen.demandeEnAttente')}
        {isConfirmed && t('joinPendingScreen.demandeApprouvee')}
        {isRejected && t('joinPendingScreen.demandeRefusee')}
      </h3>
      
      <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-8 max-w-[280px]">
        {isPending && <span>{i18n.t('joinPendingScreen.pendingDesc', { name: organizer?.profile?.displayName || i18n.t('joinPendingScreen.theOrganizer') })}</span>}
        {isConfirmed && t('joinPendingScreen.lOrganisateurAAccepteVotre')}
        {isRejected && t('joinPendingScreen.malheureusementLOrganisateurNA')}
      </p>

      {isPending && (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 bg-gray-50 dark:bg-[#1A1A1A] py-3 px-4 rounded-xl mb-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#FF7A00]" />
            <span>{t('joinPendingScreen.nousVousNotifieronsDeSa')}</span>
          </div>
          
          <Button
            onClick={onCancel}
            disabled={isCancelling}
            variant="ghost"
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 h-12 rounded-xl font-semibold text-[15px]"
          >
            {isCancelling ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('joinPendingScreen.annulerMaDemande')}
          </Button>
        </div>
      )}
    </div>
  )
}
