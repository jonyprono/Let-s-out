import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft01Icon, UserIcon } from 'hugeicons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SafeImage } from '@/components/shared/SafeImage';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { toast } from 'sonner';

export function ManageEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'cagnotte'>('details');

  const { data: event, isLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: bookings } = useQuery({
    queryKey: ['events', id, 'bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}/bookings`);
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]"><div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" /></div>;
  }

  if (!event) {
    return <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">Événement introuvable</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      
      {/* Header Cover */}
      <div className="relative w-full h-[200px] shrink-0 bg-gray-200">
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(${event.coverUrl || '/Checker.png'})` }} 
        />
        <div className="absolute top-0 left-0 w-full p-4 pt-12 z-10 flex items-center">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg shadow-sm">
            <ArrowLeft01Icon className="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
          <span className="ml-3 font-semibold text-gray-900 dark:text-white drop-shadow-md">Gestion événement</span>
        </div>
      </div>

      {/* Event Title & Date */}
      <div className="px-4 py-4 shrink-0 bg-white dark:bg-[#1A1A1A]">
        <h1 className="text-[20px] font-bold text-gray-900 dark:text-white mb-1">{event.title}</h1>
        <p className="text-[13px] text-gray-500">
          {format(new Date(event.startAt), "EEEE d MMMM yyyy, HH'h'mm", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase())}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex w-full border-b border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-[#1A1A1A]">
        {(['details', 'participants', 'cagnotte'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[13px] font-semibold text-center relative ${activeTab === tab ? 'text-[#FF7A00]' : 'text-gray-500'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF7A00]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        {activeTab === 'details' && <TabDetails event={event} />}
        {activeTab === 'participants' && <TabParticipants event={event} bookings={bookings?.data || []} />}
        {activeTab === 'cagnotte' && <TabCagnotte event={event} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: DETAILS
// ----------------------------------------------------------------------
function TabDetails({ event }: { event: any }) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const qc = useQueryClient();

  const addCoHostMut = useMutation({
    mutationFn: async (userId: string) => {
      const newCoHostIds = [...(event.coHostIds || []), userId];
      await apiClient.patch(`/events/${event.id}`, { coHostIds: newCoHostIds });
    },
    onSuccess: () => {
      toast.success('Co-organisateur ajouté');
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      setShowSearchModal(false);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Informations */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3">Informations</h3>
        <div className="flex flex-col gap-2 text-[13px]">
          <div className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
            <span className="text-gray-500">Catégorie</span>
            <span className="text-gray-900 dark:text-white font-medium">{event.category}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50 dark:border-gray-800 py-2">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-900 dark:text-white font-medium">{format(new Date(event.startAt), 'EEEE d MMMM yyyy', { locale: fr }).replace(/^\w/, (c) => c.toUpperCase())}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50 dark:border-gray-800 py-2">
            <span className="text-gray-500">Lieu</span>
            <span className="text-gray-900 dark:text-white font-medium text-right max-w-[60%]">{event.address || event.city || 'En ligne'}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-gray-500">Heure</span>
            <span className="text-gray-900 dark:text-white font-medium">{format(new Date(event.startAt), 'HH:mm')}</span>
          </div>
        </div>
      </div>

      {/* A propos */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-2">À propos</h3>
        <p className="text-[13px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{event.description}</p>
      </div>

      {/* Organisateurs */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
        <h3 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3">Organisateur(s)</h3>
        
        <div className="flex items-center gap-3 mb-3">
          <SafeImage src={event.creator?.profile?.avatarUrl} alt="Creator" className="w-10 h-10 rounded-full bg-gray-200" />
          <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{event.creator?.profile?.displayName || event.creator?.profile?.username}</span>
        </div>

        {event.coHostIds?.length > 0 && (
           <p className="text-[12px] text-gray-500 mb-3">{event.coHostIds.length} co-organisateur(s) ajouté(s)</p>
        )}

        <button 
          onClick={() => setShowSearchModal(true)}
          className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-[13px] font-semibold text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
        >
          Ajouter
        </button>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-md h-[80vh] rounded-t-3xl flex flex-col relative">
             <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
               <h3 className="font-bold">Ajouter un co-organisateur</h3>
               <button onClick={() => setShowSearchModal(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">✕</button>
             </div>
             <div className="p-4 overflow-y-auto flex-1">
                <p className="text-[13px] text-gray-500 mb-4">Recherchez un ami pour l'ajouter comme co-organisateur.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <span className="font-semibold text-[14px]">Utilisateur Test</span>
                    </div>
                    <button onClick={() => addCoHostMut.mutate('test-user-id')} className="px-3 py-1.5 bg-[#FFF9EC] text-[#FF7A00] rounded-lg text-[12px] font-semibold">Ajouter</button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: PARTICIPANTS
// ----------------------------------------------------------------------
function TabParticipants({ bookings }: { event: any, bookings: any[] }) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const participants = bookings.filter(b => b.status === 'CONFIRMED').map(b => b.user);

  return (
    <div className="flex flex-col h-full relative">
      <div className="bg-[#FFF9EC] rounded-xl p-3 flex items-center gap-3 mb-4">
        <UserIcon className="w-5 h-5 text-gray-600" />
        <span className="text-[14px] font-semibold text-gray-700">{participants.length} Participants</span>
      </div>

      <div className="flex flex-col gap-1 pb-20">
        {participants.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-10">Aucun participant pour le moment.</p>
        ) : (
          participants.map(user => (
            <div 
              key={user.id} 
              onClick={() => setSelectedUser(user)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer active:scale-95 transition-all"
            >
              <SafeImage src={user.profile?.avatarUrl} alt="User Avatar" className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <span className="text-[14px] font-medium text-gray-900 dark:text-white">
                {user.profile?.displayName || user.profile?.username}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800">
        <button className="w-full py-3.5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[14px] font-semibold text-gray-900 dark:text-white active:scale-95 transition-transform">
          <UserIcon className="w-4 h-4" />
          Inviter des participants
        </button>
      </div>

      <BottomSheet open={!!selectedUser} onClose={() => setSelectedUser(null)}>
        {selectedUser && (
          <div className="w-full flex flex-col items-center pt-2 pb-6 px-4">
            <SafeImage src={selectedUser.profile?.avatarUrl} alt="Selected User" className="w-20 h-20 rounded-full border-4 border-white shadow-sm bg-gray-200 mb-3" />
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">{selectedUser.profile?.displayName || selectedUser.profile?.username}</h3>
              <UserIcon className="w-5 h-5 text-[#FF7A00]" />
            </div>
            <button 
              onClick={() => { /* Navigate to full profile */ }}
              className="w-full max-w-[200px] py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-6"
            >
              Voir le profil
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: CAGNOTTE — multi-step flow matching Figma
// ----------------------------------------------------------------------
function TabCagnotte({ event }: { event: any }) {
  const [step, setStep] = useState<'empty' | 'form' | 'summary' | 'success'>('empty');
  const [potName, setPotName] = useState('');
  const [target, setTarget] = useState('');
  const [desc, setDesc] = useState('');
  const [poolMinAmount, setPoolMinAmount] = useState('');
  const qc = useQueryClient();

  const hasPot = event.poolTarget && event.poolTarget > 0;

  const submitMut = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/events/${event.id}`, {
        poolTarget: Number(target),
        poolMode: poolMinAmount ? 'minimum' : 'libre',
        poolMinAmount: poolMinAmount ? Number(poolMinAmount) : undefined,
        poolDescription: desc || potName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      setStep('success');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/events/${event.id}`, { poolReleased: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      toast.success('Cagnotte clôturée');
    },
    onError: () => toast.error('Erreur'),
  });

  const fmtDate = (d: string) =>
    format(new Date(d), "EEEE d MMMM yyyy, HH'h'mm", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase());

  // ── VIEW: existing pot ────────────────────────────────────────────────────
  if (hasPot) {
    const collected = event.poolCollected ?? 0;
    const pct = event.poolTarget ? Math.min(100, Math.round((collected / event.poolTarget) * 100)) : 0;
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-[24px] font-extrabold text-gray-900 dark:text-white leading-tight">
            {collected.toLocaleString('fr-FR')} F
          </p>
          <p className="text-[13px] text-gray-500 mt-0.5">
            sur {event.poolTarget?.toLocaleString('fr-FR')} F CFA
          </p>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-[#FF7A00] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-[11px] font-semibold text-white bg-[#FF7A00] rounded-full px-2 py-0.5">{pct}%</span>
          </div>
        </div>

        <button className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] text-[14px] font-semibold text-gray-900 dark:text-white flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          Déposer une contribution
        </button>

        {!event.poolReleased && (
          <button
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending}
            className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] text-[14px] font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Clôturer la cagnotte
          </button>
        )}
      </div>
    );
  }

  // ── VIEW: SUCCESS ──────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FFD439] to-[#4CAF50] flex items-center justify-center shadow-lg">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div className="text-center">
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-white mb-2">Votre cagnotte est créée !</h2>
          <p className="text-[14px] text-gray-500 leading-relaxed">Les participants ont été notifiés. Vous pouvez maintenant suivre les contributions.</p>
        </div>
        <PrimaryButton onClick={() => { qc.invalidateQueries({ queryKey: ['events', event.id] }); setStep('empty'); }}>
          Voir la cagnotte
        </PrimaryButton>
      </div>
    );
  }

  // ── VIEW: SUMMARY ──────────────────────────────────────────────────────────
  if (step === 'summary') {
    return (
      <div className="flex flex-col gap-5">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-1">Résumé de la cagnotte</h3>
          <div className="h-px bg-gray-100 dark:bg-gray-800 my-3" />
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{event.title}</p>
          <p className="text-[13px] text-gray-500 flex items-center gap-1.5 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fmtDate(event.startAt)}
          </p>
          <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />
          <div className="flex flex-col gap-3 text-[13px]">
            {potName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Nom de la cagnotte</span>
                <span className="font-semibold text-gray-900 dark:text-white">{potName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Objectif</span>
              <span className="font-semibold text-gray-900 dark:text-white">{Number(target).toLocaleString('fr-FR')} F</span>
            </div>
            {poolMinAmount && (
              <div className="flex justify-between">
                <span className="text-gray-500">Participation minimale</span>
                <span className="font-semibold text-gray-900 dark:text-white">{Number(poolMinAmount).toLocaleString('fr-FR')} F</span>
              </div>
            )}
            {desc && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Détails</span>
                <span className="font-semibold text-gray-900 dark:text-white">{desc}</span>
              </div>
            )}
          </div>
        </div>
        <PrimaryButton onClick={() => submitMut.mutate()} loading={submitMut.isPending}>
          Confirmer
        </PrimaryButton>
        <button onClick={() => setStep('form')} className="w-full text-center text-[13px] text-gray-500 py-2">
          Modifier
        </button>
      </div>
    );
  }

  // ── VIEW: FORM ─────────────────────────────────────────────────────────────
  if (step === 'form') {
    const isValid = Number(target) > 0;
    return (
      <div className="flex flex-col gap-4">
        {/* Event recap */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{event.title}</p>
          <p className="text-[12px] text-gray-500 flex items-center gap-1.5 mt-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fmtDate(event.startAt)}
          </p>
        </div>

        {/* Nom */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Nom</p>
          <input
            value={potName} onChange={e => setPotName(e.target.value)}
            placeholder="Nom de la cagnotte"
            className="w-full px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] bg-[var(--color-background-primary)]"
          />
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 ml-1">Optionnel</p>
        </div>

        {/* Montant cible */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Montant cible</p>
          <div className="relative flex items-center">
            <input
              type="number" min={1} value={target} onChange={e => setTarget(e.target.value)}
              placeholder="0"
              className="w-full pl-4 pr-16 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] bg-[var(--color-background-primary)]"
            />
            <span className="absolute right-4 text-[13px] font-semibold text-[var(--color-text-secondary)] pointer-events-none">F CFA</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 ml-1">Montant estimé des dépenses</p>
        </div>

        {/* Détails */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Détails</p>
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Quels sont les dépenses prévues ?"
            rows={4}
            className="w-full px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] bg-[var(--color-background-primary)] resize-none"
          />
        </div>

        {/* Participation minimale */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Participation minimale</p>
          <div className="relative flex items-center">
            <input
              type="number" min={1} value={poolMinAmount} onChange={e => setPoolMinAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-4 pr-16 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] bg-[var(--color-background-primary)]"
            />
            <span className="absolute right-4 text-[13px] font-semibold text-[var(--color-text-secondary)] pointer-events-none">F CFA</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 ml-1">Optionnel</p>
        </div>

        {/* Date limite */}
        <button className="flex items-center gap-2 text-[13px] text-gray-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Ajouter une date limite de contribution
        </button>

        <PrimaryButton disabled={!isValid} onClick={() => setStep('summary')}>
          Valider
        </PrimaryButton>
      </div>
    );
  }

  // ── VIEW: EMPTY (default) ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <svg width="128" height="165" viewBox="0 0 128 165" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
        <path d="M68.9432 44.4843C67.9449 46.9101 62.0678 46.743 55.9107 44.2042C49.7536 41.6655 45.5661 37.6406 46.5644 35.2148C46.7993 34.6546 47.4678 32.5541 48.1364 32.2649C50.4312 31.2937 54.7995 33.4756 59.5291 35.4271C63.9335 37.234 68.9703 38.413 69.7518 40.8027C70.2216 42.2573 69.2278 43.7932 68.9432 44.4843Z" fill="#FF7A00"/>
        <path d="M69.7248 42.3703C68.7265 44.7961 62.9217 44.7012 56.7601 42.158C50.5985 39.6147 46.4154 35.5943 47.4183 33.1685C48.4211 30.7427 54.2214 30.8421 60.383 33.3808C66.5446 35.9196 70.7232 39.9309 69.7248 42.3703Z" fill="#FF7A00"/>
        <path d="M100.077 22.5573C101.685 24.6308 98.622 29.6495 93.3503 33.7286C88.0786 37.8078 82.5087 39.434 80.9051 37.3425C80.5347 36.8637 79.0349 35.26 79.1253 34.5101C79.4279 32.0392 83.489 29.3378 87.5365 26.2028C91.304 23.2846 94.823 19.4991 97.2849 20.0095C98.7801 20.3393 99.6204 21.97 100.077 22.5573Z" fill="#FF7A00"/>
        <path d="M91.9827 31.9553C97.251 27.8747 100.22 22.8863 98.6144 20.8133C97.0088 18.7403 91.4364 20.3678 86.1681 24.4484C80.8999 28.529 77.9308 33.5174 79.5364 35.5904C81.1421 37.6633 86.7145 36.0359 91.9827 31.9553Z" fill="#FF7A00"/>
        <path d="M78.2716 12.845C77.7566 15.8174 71.089 17.0732 63.536 15.718C55.9831 14.3628 50.2867 10.8709 50.8152 7.89853C50.9372 7.20738 51.1495 4.69123 51.8587 4.18981C54.2032 2.53647 59.6511 3.91877 65.4514 4.94872C70.8722 5.91091 76.8034 5.9877 78.2716 8.48578C79.1615 10.0217 78.4206 11.9957 78.2716 12.845Z" fill="#FF7A00"/>
        <path d="M78.6233 10.25C79.1522 7.27795 73.456 3.77869 65.9005 2.43422C58.3451 1.08975 51.7914 2.40918 51.2625 5.38127C50.7337 8.35335 56.4298 11.8526 63.9853 13.1971C71.5408 14.5416 78.0944 13.2221 78.6233 10.25Z" fill="#FF7A00"/>
        <path d="M117.708 88.7323L71.2202 91.4427C69.578 91.5394 67.9667 91.9312 66.4634 92.5992L15.9687 115.186C15.0828 115.575 14.3572 116.257 13.9133 117.117C13.4693 117.977 13.3338 118.963 13.5294 119.911L21.8729 159.37C22.0139 160.005 22.2984 160.6 22.7046 161.109C23.1107 161.617 23.6278 162.026 24.2163 162.304C24.8048 162.582 25.449 162.722 26.0999 162.713C26.7507 162.704 27.3908 162.546 27.9713 162.252L77.8109 137.37L123.833 135.83C124.4 135.815 124.956 135.679 125.466 135.432C125.976 135.185 126.427 134.832 126.79 134.397C127.153 133.962 127.419 133.455 127.571 132.909C127.722 132.363 127.755 131.791 127.669 131.231L121.512 93.4484C121.191 91.497 119.709 88.6736 117.708 88.7323Z" fill="#FF7A00"/>
        <path d="M24.3975 63.0399L0.00146484 85.5283L43.7811 133.022L68.1772 110.533L24.3975 63.0399Z" fill="#FF7A00"/>
        <path d="M45.2043 44.4331L14.0117 55.7432L36.0297 116.468L67.2224 105.158L45.2043 44.4331Z" fill="#FF7A00"/>
      </svg>

      <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-2">Aucune cagnotte ajoutée</h3>
      <p className="text-[13px] text-gray-500 text-center mb-6">Ajoutez une cagnotte à l'événement pour mutualiser les frais.</p>

      <button
        onClick={() => setStep('form')}
        className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] text-[14px] font-semibold text-gray-900 dark:text-white flex items-center justify-center gap-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
        Ajouter une cagnotte
      </button>
    </div>
  );
}
