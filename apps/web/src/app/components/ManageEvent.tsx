import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SafeImage } from '@/components/shared/SafeImage';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { UserAvatarIcon } from '@/components/shared/UserAvatarIcon';
import { toast } from 'sonner';
import { useUserProfile } from '@/features/users/UserProfileContext';
import { ShareModal } from '@/components/shared/ShareModal';
import { useFriends } from '@/features/users/api';
import { eventsApi } from '@/features/events/api';
import { ValidatorVoteForm } from './ValidatorVoteForm';

export function ManageEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'details' | 'participants' | 'cagnotte') || 'details';
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'cagnotte'>(initialTab);
  const [cagnotteStep, setCagnotteStep] = useState<'empty' | 'form' | 'summary' | 'success' | 'validator-vote'>('empty');

  const { data: event, isLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: attendeesData } = useQuery({
    queryKey: ['events', id, 'attendees'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}/attendees`);
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

  const hasPot = event.poolTarget && event.poolTarget > 0;
  
  // If we are in the cagnotte flow (form, summary, success) and it's not the active display, render fullscreen
  if (activeTab === 'cagnotte' && cagnotteStep === 'validator-vote') {
    return <ValidatorVoteForm event={event} attendees={Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []} onBack={() => setCagnotteStep('empty')} />;
  }

  if (activeTab === 'cagnotte' && cagnotteStep !== 'empty' && (!hasPot || cagnotteStep === 'success')) {
    return <TabCagnotteFullscreen event={event} step={cagnotteStep} setStep={setCagnotteStep} onBack={() => setCagnotteStep('empty')} />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      
      {/* Header Cover */}
      <div className="relative w-full h-[200px] shrink-0 bg-gray-200">
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(${event.coverUrl || '/Checker.png'})` }} 
        />
        <div className="absolute top-0 left-0 w-full p-4 pt-12 z-10 flex items-center gap-3">
          <BackButton 
            onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/account')} 
            className="bg-white/80 dark:bg-black/50 backdrop-blur shadow-sm" 
          />
          <span className="font-semibold text-gray-900 dark:text-white drop-shadow-md">Gestion événement</span>
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
        {activeTab === 'participants' && <TabParticipants event={event} attendees={Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []} />}
        {activeTab === 'cagnotte' && <TabCagnotteInline event={event} setStep={setCagnotteStep} attendees={Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: DETAILS
// ----------------------------------------------------------------------
function TabDetails({ event }: { event: any }) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const qc = useQueryClient();
  const { data: usersData, isLoading: isLoadingFriends } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      const res = await apiClient.get('/users/search', { params: { q: searchQuery || undefined, limit: 20 } })
      return res.data
    },
    enabled: showSearchModal
  });

  const filteredFriends = Array.isArray(usersData) ? usersData : (usersData?.data ?? []);

  const addCoHostMut = useMutation({
    mutationFn: async (userId: string) => {
      const newCoHostIds = [...(event.coHostIds || []), userId];
      await apiClient.patch(`/events/${event.id}`, { coHostIds: newCoHostIds });
    },
    onSuccess: () => {
      toast.success('Co-organisateur ajouté');
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      setShowSearchModal(false);
      setSearchQuery('');
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
        <p className="text-[13px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words break-all">{event.description}</p>
      </div>

      {/* Organisateurs */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
        <h3 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3">Organisateur(s)</h3>
        
        <div className="flex items-center gap-3 mb-3">
          <SafeImage src={event.creator?.profile?.avatarUrl} alt="Creator" className="w-10 h-10 rounded-full bg-gray-200" />
          <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{event.creator?.profile?.displayName || event.creator?.profile?.username}</span>
        </div>

        {event.coHosts?.map((coHost: any) => (
          <div key={coHost.id} className="flex items-center gap-3 mb-3">
            <SafeImage src={coHost.profile?.avatarUrl} alt="Co-organisateur" className="w-10 h-10 rounded-full bg-gray-200" />
            <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{coHost.profile?.displayName || coHost.profile?.username || coHost.username || 'Co-organisateur'}</span>
          </div>
        ))}

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
               <button onClick={() => { setShowSearchModal(false); setSearchQuery(''); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">✕</button>
             </div>
             <div className="p-4 overflow-y-auto flex-1">
                <p className="text-[13px] text-gray-500 mb-4">Recherchez un utilisateur pour l'ajouter comme co-organisateur.</p>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  {isLoadingFriends ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
                  ) : filteredFriends.length > 0 ? (
                    filteredFriends.map((friend: any) => (
                      <div key={friend.userId} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <SafeImage src={friend.avatarUrl} alt={friend.displayName} className="w-10 h-10 bg-gray-200 rounded-full" />
                          <span className="font-semibold text-[14px] dark:text-white">{friend.displayName}</span>
                        </div>
                        <button 
                          onClick={() => addCoHostMut.mutate(friend.userId)}
                          disabled={event.coHostIds?.includes(friend.userId) || addCoHostMut.isPending}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${event.coHostIds?.includes(friend.userId) ? 'bg-gray-100 text-gray-400' : 'bg-[#FFF9EC] text-[#FF7A00]'}`}
                        >
                          {event.coHostIds?.includes(friend.userId) ? 'Ajouté' : 'Ajouter'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-center text-gray-500 mt-4">Aucun utilisateur trouvé avec ce nom.</p>
                  )}
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
function TabParticipants({ event, attendees }: { event: any, attendees: any[] }) {
  const { openUserProfile } = useUserProfile();
  const [showInviteOptions, setShowInviteOptions] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const { data: friendsData } = useFriends();
  const inviteMut = useMutation({
    mutationFn: async (userId: string) => {
      await eventsApi.inviteFriends(event.id, [userId]);
    },
    onSuccess: () => toast.success('Invitation envoyée !'),
    onError: () => toast.error('Erreur lors de l\'invitation')
  });

  // Attendees endpoint already returns confirmed participants
  const participants = attendees.map(b => b.user || b);

  const isPastDeadline = event.registrationDeadline 
    ? new Date() > new Date(event.registrationDeadline) 
    : new Date() > new Date(event.startAt);

  return (
    <div className="flex flex-col h-full relative">
      {/* Count header */}
      <div className="bg-[#FFF9EC] rounded-xl p-3 flex items-center gap-3 mb-2">
        <UserAvatarIcon size={22} />
        <span className="text-[14px] font-semibold text-gray-700">{participants.length} Participants</span>
      </div>

      {/* List */}
      <div className="flex flex-col pb-24">
        {participants.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-10">Aucun participant pour le moment.</p>
        ) : (
          participants.map((user: any) => (
            <div
              key={user.id}
              onClick={() => openUserProfile(
                user.id,
                { displayName: user.profile?.displayName || user.profile?.username || 'Utilisateur', avatarUrl: user.profile?.avatarUrl },
                { title: event?.title || 'Événement', coverUrl: event?.coverUrl }
              )}
              className="flex items-center gap-3 px-1 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
            >
              {/* Avatar */}
              {user.profile?.avatarUrl ? (
                <SafeImage
                  src={user.profile.avatarUrl}
                  alt={user.profile?.displayName || ''}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <UserAvatarIcon size={32} className="shrink-0" />
              )}
              <span className="text-[14px] font-medium text-gray-900 dark:text-white">
                {user.profile?.displayName || user.profile?.username || 'Utilisateur'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Bottom invite button */}
      {!isPastDeadline && (
        <div className="fixed bottom-0 left-0 w-full px-4 py-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800">
          <button 
            onClick={() => setShowInviteOptions(true)}
            className="w-full py-3.5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[14px] font-semibold text-gray-900 dark:text-white active:scale-95 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#uai-clip-invite)">
                <rect width="32" height="32" rx="16" fill="none" />
                <circle cx="13" cy="10.6663" r="5.33333" fill="currentColor" opacity="0.4" />
                <circle cx="13" cy="32.6667" r="14.6667" fill="currentColor" opacity="0.4" />
              </g>
              <line x1="24" y1="10" x2="24" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="20" y1="14" x2="28" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <defs><clipPath id="uai-clip-invite"><rect width="26" height="32" rx="13" fill="white" /></clipPath></defs>
            </svg>
            Inviter des participants
          </button>
        </div>
      )}

      {/* Invite Options BottomSheet */}
      <BottomSheet open={showInviteOptions} onClose={() => setShowInviteOptions(false)}>
        <div className="w-full flex flex-col pt-2 pb-8 px-5 gap-3">
          <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-4 text-center">Inviter des participants</h3>
          <button 
            onClick={() => { setShowInviteOptions(false); setShowInviteFriends(true); }}
            className="w-full p-4 flex items-center justify-center gap-3 bg-white dark:bg-[#222222] border border-gray-200 dark:border-gray-800 rounded-xl text-[15px] font-semibold text-gray-900 dark:text-white"
          >
            Inviter des amis Let's Out
          </button>
          <button 
            onClick={() => { setShowInviteOptions(false); setShowShareModal(true); }}
            className="w-full p-4 flex items-center justify-center gap-3 bg-white dark:bg-[#222222] border border-gray-200 dark:border-gray-800 rounded-xl text-[15px] font-semibold text-gray-900 dark:text-white"
          >
            Partager via lien ou QR
          </button>
        </div>
      </BottomSheet>

      {/* Invite Friends BottomSheet */}
      <BottomSheet open={showInviteFriends} onClose={() => setShowInviteFriends(false)}>
        <div className="w-full flex flex-col pt-2 pb-8 px-5">
          <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-4 text-center">Vos amis</h3>
          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {!friendsData || friendsData.length === 0 ? (
              <p className="text-center text-[13px] text-gray-500 py-6">Vous n'avez pas encore d'amis à inviter.</p>
            ) : (
              friendsData.map(friend => (
                <div key={friend.userId} className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <SafeImage src={friend.avatarUrl} alt={friend.displayName} className="w-10 h-10 rounded-full bg-gray-200" />
                    <span className="font-semibold text-[14px] text-gray-900 dark:text-white">{friend.displayName}</span>
                  </div>
                  <button 
                    onClick={() => inviteMut.mutate(friend.userId)}
                    className="px-4 py-1.5 bg-[#FFF9EC] text-[#FF7A00] rounded-full text-[12px] font-semibold active:scale-95"
                  >
                    Inviter
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: CAGNOTTE INLINE
// ----------------------------------------------------------------------
function TabCagnotteInline({ event, setStep, attendees }: { event: any, setStep: (s: any) => void, attendees: any[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const hasPot = event.poolTarget && event.poolTarget > 0;
  const isCreator = user?.id === event.creatorId;

  const [amountToWithdraw, setAmountToWithdraw] = useState<string>('');
  const [expandedSection, setExpandedSection] = useState<'participations' | 'validators' | 'payouts' | 'payout-form' | null>(null);

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['events', event.id, 'payout-status'],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${event.id}/payout/status`);
      return res.data?.data;
    },
    enabled: hasPot,
  });

  const { data: auditData } = useQuery({
    queryKey: ['events', event.id, 'payout-audit'],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${event.id}/payout/audit`);
      return res.data?.data;
    },
    enabled: hasPot,
  });

  const payoutMut = useMutation({
    mutationFn: async (amount?: number) =>
      apiClient.post(`/events/${event.id}/payout/request`, amount ? { amount } : {}),
    onSuccess: () => {
      toast.success('Demande de déblocage envoyée avec succès');
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      refetchStatus();
      setAmountToWithdraw('');
      setExpandedSection(null);
    },
    onError: (err: any) => {
      if (err.response?.data?.details?.notifiedCount > 0) {
         toast.success(`${err.response.data.details.notifiedCount} participants ont été relancés.`);
         refetchStatus();
      } else {
         toast.error(err.response?.data?.error || 'Erreur lors du déblocage');
      }
    }
  });

  if (!hasPot) return null;

  const totalCollected = statusData?.totalCollected || 0;
  const totalWithdrawn = statusData?.totalWithdrawn || 0;
  const unlockedAmount = statusData?.unlockedAmount || 0;
  const poolClosedAt = statusData?.poolClosedAt;

  const maxAvailableNow = Math.min(Math.max(0, unlockedAmount - totalWithdrawn), Math.max(0, totalCollected - totalWithdrawn));
  const totalBlocked = Math.max(0, totalCollected - unlockedAmount);
  
  const isPastDeadline = event.registrationDeadline 
    ? new Date() > new Date(event.registrationDeadline) 
    : new Date() > new Date(event.startAt);

  const handlePayoutClick = () => {
    if (!isPastDeadline) return toast.error("La date limite doit être passée avant de débloquer.");
    const amt = parseFloat(amountToWithdraw);
    if (isNaN(amt) || amt <= 0 || amt > maxAvailableNow) {
      return toast.error("Montant invalide.");
    }
    payoutMut.mutate(amt);
  };

  const contributions = attendees.filter(a => a.totalPaid > 0);
  const validatorsMap = new Map();
  attendees.forEach(a => {
    if (a.delegatedToId && a.poolValidationStatus === 'DELEGATED') {
      const v = attendees.find(x => x.userId === a.delegatedToId);
      if (v) {
        if (!validatorsMap.has(v.userId)) validatorsMap.set(v.userId, { ...v, delegatedCount: 0 });
        validatorsMap.get(v.userId).delegatedCount += 1;
      }
    }
  });
  const validatorsList = Array.from(validatorsMap.values());
  const payoutsList = auditData?.filter((l: any) => l.action.includes('PAYOUT')) || [];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Carte solde principal ── */}
      <div className="rounded-[12px] p-4 shadow-sm border bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-gray-800">
        <p className="text-[14px] text-gray-500 mb-1">Total collecté</p>
        <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-tight">
          {totalCollected.toLocaleString('fr-FR')} F CFA
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
            <p className="text-[12px] text-green-700 dark:text-green-400">Total débloqué</p>
            <p className="text-[16px] font-bold text-green-700 dark:text-green-400">
              {unlockedAmount.toLocaleString('fr-FR')} F
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30">
            <p className="text-[12px] text-[#FF7A00]">Total bloqué</p>
            <p className="text-[16px] font-bold text-[#FF7A00]">
              {totalBlocked.toLocaleString('fr-FR')} F
            </p>
          </div>
        </div>
        
        {totalWithdrawn > 0 && (
          <p className="text-[12px] text-gray-500 mt-3 italic">
            Déjà retiré: {totalWithdrawn.toLocaleString('fr-FR')} F
          </p>
        )}
        
        {poolClosedAt && (
          <div className="mt-3 px-3 py-2 rounded-[8px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <span className="text-[14px] mt-0.5">🔒</span>
            <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">La cagnotte est fermée aux nouveaux versements.</p>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-[12px] p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <h4 className="text-[14px] font-semibold mb-3 text-gray-900 dark:text-white">Actions</h4>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(`/events/${event.id}/pay`)}
            className="w-full h-[44px] bg-[#FF7A00] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="13" r="2"/><path d="M12 13h4"/></svg>
            Déposer une contribution
          </button>

          {isCreator && (
            <>
              <button
                onClick={() => setStep('validator-vote')}
                className="w-full h-[44px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Lancer le vote des validateurs
              </button>
              
              <button
                onClick={() => setExpandedSection(expandedSection === 'payout-form' ? null : 'payout-form')}
                className="w-full h-[44px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Débloquer les fonds
              </button>

              <button
                onClick={() => {/* TODO close pot */}}
                className="w-full h-[44px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Clôturer la cagnotte
              </button>
            </>
          )}
        </div>

        {expandedSection === 'payout-form' && isCreator && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            {maxAvailableNow > 0 ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[12px] text-gray-500 mb-1 block">Montant à retirer (Max: {maxAvailableNow.toLocaleString('fr-FR')} F)</label>
                  <input 
                    type="number" 
                    value={amountToWithdraw}
                    onChange={(e) => setAmountToWithdraw(e.target.value)}
                    placeholder="Montant"
                    className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
                <button
                  onClick={handlePayoutClick}
                  disabled={payoutMut.isPending || !amountToWithdraw}
                  className="w-full h-[44px] bg-[#10B981] hover:bg-[#10B981]/90 text-white rounded-lg text-[14px] font-bold active:scale-95 transition-transform disabled:opacity-50"
                >
                  {payoutMut.isPending ? "Traitement..." : "Retirer les fonds"}
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-2">
                Aucun fond n'est disponible pour le retrait.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Sections dépliables ── */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-[12px] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
        {/* Participations */}
        <div 
          onClick={() => setExpandedSection(expandedSection === 'participations' ? null : 'participations')}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="font-semibold text-[15px]">Participations</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${expandedSection === 'participations' ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {expandedSection === 'participations' && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => navigate(`/events/${event.id}/pay`)} className="w-full h-9 mb-4 mt-4 border border-[#FF7A00] text-[#FF7A00] rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              Contribuer à nouveau
            </button>
            <div className="flex flex-col gap-3">
              {contributions.slice(0, 5).map(c => (
                <div key={c.userId} className="flex justify-between items-center text-[13px]">
                  <div className="flex items-center gap-2">
                    {c.user.profile?.avatarUrl ? (
                      <SafeImage src={c.user.profile.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <UserAvatarIcon size={24} className="shrink-0" />
                    )}
                    <span className="text-gray-800 dark:text-gray-200">{c.user.profile?.displayName || 'Anonyme'}</span>
                  </div>
                  <span className="font-semibold text-[#FF7A00]">{c.totalPaid.toLocaleString('fr-FR')} F</span>
                </div>
              ))}
              {contributions.length === 0 && <p className="text-[13px] text-gray-500 text-center py-2">Aucune participation.</p>}
              {contributions.length > 5 && (
                <button className="text-[13px] text-[#FF7A00] font-semibold mt-2">Voir tout ({contributions.length})</button>
              )}
            </div>
            {/* Mes validations (historique) */}
            <div className="mt-5 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800">
              <h5 className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-3">Mes validations</h5>
              {user && attendees.find(a => a.userId === user.id)?.poolValidationStatus === 'DELEGATED' ? (
                <div className="text-[13px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#222] p-3 rounded-lg">
                  Vous avez délégué votre part à {attendees.find(x => x.userId === attendees.find(a => a.userId === user.id)?.delegatedToId)?.user.profile?.displayName || 'un validateur'}
                </div>
              ) : (
                <p className="text-[13px] text-gray-500">Aucun historique de validation.</p>
              )}
            </div>
          </div>
        )}

        <div className="h-[1px] bg-gray-100 dark:bg-gray-800" />

        {/* Validateurs */}
        <div 
          onClick={() => setExpandedSection(expandedSection === 'validators' ? null : 'validators')}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span className="font-semibold text-[15px]">Validateurs</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${expandedSection === 'validators' ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {expandedSection === 'validators' && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex flex-col gap-3">
              {validatorsList.map(v => (
                <div key={v.userId} className="flex justify-between items-center text-[13px]">
                  <div className="flex items-center gap-2">
                    {v.user.profile?.avatarUrl ? (
                      <SafeImage src={v.user.profile.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <UserAvatarIcon size={24} className="shrink-0" />
                    )}
                    <span className="text-gray-800 dark:text-gray-200">{v.user.profile?.displayName}</span>
                  </div>
                  <span className="text-gray-500">{v.delegatedCount} délégation(s)</span>
                </div>
              ))}
              {validatorsList.length === 0 && <p className="text-[13px] text-gray-500 text-center py-2">Aucun validateur désigné.</p>}
            </div>
          </div>
        )}

        <div className="h-[1px] bg-gray-100 dark:bg-gray-800" />

        {/* Retraits */}
        <div 
          onClick={() => setExpandedSection(expandedSection === 'payouts' ? null : 'payouts')}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l2-9 5 18 3-9h6"/></svg>
            <span className="font-semibold text-[15px]">Retraits</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${expandedSection === 'payouts' ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {expandedSection === 'payouts' && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex flex-col gap-3">
              {payoutsList.map((l: any) => (
                <div key={l.id} className="text-[13px] flex flex-col gap-1 bg-gray-50 dark:bg-[#222] p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Demande de {l.amount?.toLocaleString('fr-FR')} F</span>
                    <span className="text-[#FF7A00] font-medium text-[11px] uppercase bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">{l.action.replace('PAYOUT_', '')}</span>
                  </div>
                  <span className="text-gray-500 text-[11px]">{format(new Date(l.createdAt), "dd MMM yyyy HH:mm")}</span>
                </div>
              ))}
              {payoutsList.length === 0 && <p className="text-[13px] text-gray-500 text-center py-2">Aucun retrait.</p>}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ----------------------------------------------------------------------
function TabCagnotteFullscreen({ event, step, setStep, onBack }: any) {
  const [potName, setPotName] = useState('');
  const [target, setTarget] = useState('');
  const [desc, setDesc] = useState('');
  const [poolMinAmount, setPoolMinAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showDeadlineInput, setShowDeadlineInput] = useState(false);
  const qc = useQueryClient();

  const submitMut = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/events/${event.id}`, {
        poolTarget: Number(target),
        poolMode: poolMinAmount ? 'minimum' : 'libre',
        poolMinAmount: poolMinAmount ? Number(poolMinAmount) : undefined,
        poolDescription: desc || potName,
        registrationDeadline: deadline ? new Date(deadline).toISOString() : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      setStep('success');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const fmtDate = (d: string) =>
    format(new Date(d), "EEEE d MMMM yyyy, HH'h'mm", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase());

  if (step === 'success') {
    return (
      <div className="w-full h-full flex flex-col bg-white dark:bg-[#0a0a0b]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#FFD439] to-[#4CAF50] flex items-center justify-center shadow-lg relative">
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div className="text-center">
            <h2 className="text-[24px] font-bold text-gray-900 dark:text-white mb-2">Votre cagnotte est créée !</h2>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-[280px]">Les participants ont été notifiés. Vous pouvez maintenant suivre les contributions.</p>
          </div>
          <div className="w-full mt-6">
            <PrimaryButton onClick={() => { setStep('empty'); qc.invalidateQueries({ queryKey: ['events', event.id] }); }}>
              Voir la cagnotte
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  const isValid = Number(target) > 0;

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="px-4 py-4 flex items-center sticky top-0 bg-[#F9F9F9] dark:bg-[#0a0a0b] z-10 pt-10">
        <BackButton onClick={onBack} className="mr-3 shrink-0" />
        <span className="text-[16px] font-bold text-gray-900 dark:text-white">Ajouter une cagnotte</span>
      </div>

      <div className="flex-1 px-4 pb-8 flex flex-col gap-6 mt-2">
        {/* Event recap */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-[16px] font-bold text-gray-900 dark:text-white">{event.title}</p>
          <p className="text-[13px] text-gray-500 flex items-center gap-1.5 mt-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fmtDate(event.startAt)}
          </p>
        </div>

        {/* Nom */}
        <div className="flex flex-col">
          <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nom</p>
          <input
            value={potName} onChange={e => setPotName(e.target.value)}
            placeholder="Nom de la cagnotte"
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[14px] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
          />
          <p className="text-[11px] text-gray-400 mt-1.5 ml-1">Optionnel</p>
        </div>

        {/* Montant cible */}
        <div className="flex flex-col">
          <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Montant cible</p>
          <div className="relative flex items-center">
            <input
              type="number" min={1} value={target} onChange={e => setTarget(e.target.value)}
              placeholder="0"
              className="w-full pl-4 pr-16 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[14px] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
            />
            <span className="absolute right-4 text-[13px] font-medium text-gray-500 pointer-events-none">F CFA</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 ml-1">Montant estimé des dépenses</p>
        </div>

        {/* Détails */}
        <div className="flex flex-col">
          <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Détails</p>
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Quelles sont les dépenses prévues ?"
            rows={4}
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[14px] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00] resize-none"
          />
        </div>

        {/* Participation minimale */}
        <div className="flex flex-col">
          <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Participation minimale</p>
          <div className="relative flex items-center">
            <input
              type="number" min={1} value={poolMinAmount} onChange={e => setPoolMinAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-4 pr-16 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[14px] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
            />
            <span className="absolute right-4 text-[13px] font-medium text-gray-500 pointer-events-none">F CFA</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 ml-1">Optionnel</p>
        </div>

        {/* Date limite */}
        {!showDeadlineInput ? (
          <button onClick={() => setShowDeadlineInput(true)} className="flex items-center gap-2 text-[13px] font-medium text-gray-400 mt-1 self-start">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Ajouter une date limite de contribution
          </button>
        ) : (
          <div className="flex flex-col">
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date et heure limite de contribution</p>
            <input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[14px] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white focus:outline-none focus:border-[#FF7A00]"
            />
          </div>
        )}

        <div className="mt-4 mb-4">
          <PrimaryButton disabled={!isValid} onClick={() => setStep('summary')}>
            Valider
          </PrimaryButton>
        </div>
      </div>

      <BottomSheet open={step === 'summary'} onClose={() => setStep('form')}>
        <div className="px-5 pt-2 pb-8 flex flex-col gap-4">
          <h3 className="text-center text-[16px] font-bold text-gray-900 dark:text-white mb-2">Résumé de la cagnotte</h3>
          
          <div>
            <p className="text-[17px] font-bold text-gray-900 dark:text-white">{event.title}</p>
            <p className="text-[14px] text-gray-500 mt-0.5">{fmtDate(event.startAt)}</p>
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-2" />

          <div className="flex flex-col gap-5 text-[15px]">
            {potName && (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] text-gray-500">Nom de la cagnotte</span>
                <span className="font-semibold text-gray-900 dark:text-white">{potName}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[14px] text-gray-500">Objectif</span>
              <span className="font-semibold text-gray-900 dark:text-white">{Number(target).toLocaleString('fr-FR')} F</span>
            </div>
            {poolMinAmount && (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] text-gray-500">Participation minimale</span>
                <span className="font-semibold text-gray-900 dark:text-white">{Number(poolMinAmount).toLocaleString('fr-FR')} F</span>
              </div>
            )}
            {deadline && (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] text-gray-500">Date limite</span>
                <span className="font-semibold text-gray-900 dark:text-white">{fmtDate(deadline)}</span>
              </div>
            )}
            {desc && (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] text-gray-500">Détails</span>
                <span className="font-semibold text-gray-900 dark:text-white leading-relaxed break-words break-all">{desc}</span>
              </div>
            )}
          </div>

          <div className="mt-6 w-full">
            <PrimaryButton onClick={() => submitMut.mutate()} loading={submitMut.isPending}>
              Confirmer
            </PrimaryButton>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
