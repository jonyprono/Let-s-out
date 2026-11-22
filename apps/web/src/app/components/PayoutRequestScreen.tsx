import { useState } from 'react';
import { PayoutDelayNotice } from '@/components/shared/PayoutDelayNotice';
import { useNavigate, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

import { intlLocale } from '@/lib/locale';
export function PayoutRequestScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [amountToWithdraw, setAmountToWithdraw] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('Location de salle');
  const [customReason, setCustomReason] = useState<string>('');
  const [step, setStep] = useState<'form' | 'success'>('form');

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}`);
      return res.data?.data;
    }
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['events', id, 'payout-status'],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}/payout/status`);
      return res.data?.data;
    },
    enabled: !!event,
  });

  const payoutMut = useMutation({
    mutationFn: async (data: { amount: number; reason: string }) =>
      apiClient.post(`/events/${id}/payout/request`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      setStep('success');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('payout.toasts.requestError'));
    }
  });

  if (eventLoading || statusLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    );
  }

  if (!event || !statusData) return null;

  const unlockedAmount = statusData.unlockedAmount || 0;
  
  const maxAvailableNow = unlockedAmount;
  const numericAmount = parseFloat(amountToWithdraw) || 0;
  
  // Platform fee assumption dynamically fetched from backend
  const commissionRate = statusData.commissionRate ?? 0.10;
  const commission = numericAmount * commissionRate;
  const amountToReceive = numericAmount - commission;

  const finalReason = reasonCategory === 'Autre' ? customReason.trim() : reasonCategory;

  const handleConfirm = () => {
    if (numericAmount < 5000) {
      return toast.error(t('payout.toasts.minWithdrawal'));
    }
    if (numericAmount > maxAvailableNow) {
      return toast.error(t('payout.toasts.aboveBalance'));
    }
    if (reasonCategory === 'Autre' && !customReason.trim()) {
      return toast.error(t('payout.toasts.reasonRequired'));
    }
    payoutMut.mutate({ amount: numericAmount, reason: finalReason });
  };

  if (step === 'success') {
    return (
      <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2"><span>{t('payout.sentTitle')}</span></h2>
          <p className="text-[14px] text-gray-500 mb-4 max-w-[280px]">
            <span>{t('payout.sentDesc')}</span>
          </p>
          <PayoutDelayNotice className="mb-8 max-w-sm text-left" />
          <button
            onClick={() => navigate(`/events/${id}/manage?tab=cagnotte`)}
            className="w-full max-w-sm h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-semibold active:scale-95 transition-transform"
          >
            <span>{t('payout.backToPool')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
      <div className="flex items-center px-4 h-14 bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
        <BackButton />
        <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white ml-2"><span>{t('payout.title')}</span></h1>
      </div>

      <div className="flex-1 p-4 pb-24 overflow-y-auto">
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[12px] p-4 mb-6">
          <p className="text-[12px] text-amber-700 dark:text-amber-500 font-semibold mb-1"><span>{t('payout.availableBalance')}</span></p>
          <p className="text-[24px] font-bold text-amber-600 dark:text-amber-400">
            {maxAvailableNow.toLocaleString(intlLocale())} F CFA
          </p>
          <p className="text-[11px] text-amber-600/70 mt-1"><span>{t('payout.minAllowed')}</span></p>
        </div>

        <PayoutDelayNotice className="mb-6" />

        <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white text-[15px] mb-4"><span>{t('payout.howMuch')}</span></h3>
          
          {maxAvailableNow <= 0 ? (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 mb-6">
              <p className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center">
                <span>{t('payout.noFunds')}</span>
              </p>
            </div>
          ) : (
            <div className="relative mb-6">
              <input 
                type="number"
                value={amountToWithdraw}
                onChange={(e) => setAmountToWithdraw(e.target.value)}
                placeholder="0"
                disabled={maxAvailableNow <= 0}
                className="w-full bg-gray-50 dark:bg-[#222] border-0 rounded-xl px-4 py-4 text-[20px] font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF7A00] disabled:opacity-50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">F CFA</span>
            </div>
          )}

          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800 text-[13px]">
            <div className="flex justify-between">
              <span className="text-gray-500"><span>{t('payout.requestedAmount')}</span></span>
              <span className="text-gray-900 dark:text-white font-medium">{numericAmount.toLocaleString(intlLocale())} F</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Commission ({(commissionRate * 100).toFixed(0)}%)</span>
              <span className="text-red-500 font-medium">- {commission.toLocaleString(intlLocale())} F</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-900 dark:text-white"><span>{t('payout.totalToReceive')}</span></span>
              <span className="font-bold text-[#10B981]">{Math.max(0, amountToReceive).toLocaleString(intlLocale())} F</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white text-[15px] mb-4"><span>{t('payout.reason')}</span></h3>
          
          <select 
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            className="w-full bg-gray-50 dark:bg-[#222] border-0 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF7A00] mb-3"
          >
            <option value="Location de salle">{t('payout.reasons.venue')}</option>
            <option value="Frais traiteur">{t('payout.reasons.catering')}</option>
            <option value="Transport">{t('payout.reasons.transport')}</option>
            <option value="Décoration">{t('payout.reasons.decoration')}</option>
            <option value="Autre">{t('payout.reasons.other')}</option>
          </select>

          {reasonCategory === 'Autre' && (
            <input 
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={t('payout.reasonPlaceholder')}
              className="w-full bg-gray-50 dark:bg-[#222] border-0 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FF7A00]"
            />
          )}
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h4 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-4"><span>{t('createEvent.fields.details')}</span></h4>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-gray-500"><span>{t('common.event')}</span></span>
              <span className="text-gray-900 dark:text-white font-medium max-w-[150px] truncate">{event.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500"><span>{t('common.pool')}</span></span>
              <span className="text-gray-900 dark:text-white font-medium"><span>{event.poolDescription || t('payout.generalCosts')}</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500"><span>{t('common.date')}</span></span>
              <span className="text-gray-900 dark:text-white font-medium">{format(new Date(), 'dd/MM/yyyy')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800 fixed bottom-0 left-0 right-0 max-w-[768px] mx-auto z-10 pb-safe">
        <button 
          onClick={handleConfirm}
          disabled={!amountToWithdraw || numericAmount < 5000 || numericAmount > maxAvailableNow || payoutMut.isPending || (reasonCategory === 'Autre' && !customReason.trim()) || maxAvailableNow <= 0}
          className="w-full h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          {payoutMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{t('payout.confirmRequest')}</span>}
        </button>
      </div>
    </div>
  );
}
