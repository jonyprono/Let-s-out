import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft01Icon } from 'hugeicons-react';
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
import { useAuthStore } from '@/stores/auth.store';
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
  const me = useAuthStore((state: any) => state.user);
  const isKycVerified = me?.profile?.kycStatus === 'verified';

  const handleAddCagnotte = () => {
    if (!isKycVerified) {
      toast.error('Le profil doit être vérifié (KYC) pour ajouter une cagnotte.', {
        action: { label: 'Vérifier', onClick: () => navigate('/profile/kyc') }
      });
      return;
    }
    setStep('form');
  };
  const [showPayoutConfirm, setShowPayoutConfirm] = useState(false);
  const [showPayoutSuccess, setShowPayoutSuccess] = useState(false);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const hasPot = event.poolTarget && event.poolTarget > 0;

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

  const payoutMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${event.id}/payout/request`),
    onSuccess: () => {
      setShowPayoutConfirm(false);
      setTimeout(() => setShowPayoutSuccess(true), 350);
      qc.invalidateQueries({ queryKey: ['events', event.id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors du déblocage')
  });

  if (hasPot) {
    const isPastDeadline = event.registrationDeadline 
      ? new Date() > new Date(event.registrationDeadline) 
      : new Date() > new Date(event.startAt);

    const collected = event.poolCollected ?? 0;
    const pct = event.poolTarget ? Math.min(100, Math.round((collected / event.poolTarget) * 100)) : 0;
    const isFull = pct >= 100;
    const progressColorClass = isFull ? "bg-[#0CAF60]" : "bg-[#FF7A00]";
    const bgClass = isFull ? "bg-[#F0FDF4] dark:bg-[#102a1c] border-green-100 dark:border-green-900" : "bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-gray-800";

    const isVoteOpen = event.validatorVoteStatus === 'OPEN';
    const isVoteClosed = event.validatorVoteStatus === 'CLOSED';
    const hasPayoutRequest = !!event.payoutRequest;
    const isPayoutPending = event.payoutRequest?.status === 'PENDING';
    const isPayoutApproved = event.payoutRequest?.status === 'APPROVED';

    const allVotesCount = event.validatorVotes?.length || 0;
    const expectedVotes = event.expectedValidatorVotes || 0;
    const isAllVoted = expectedVotes > 0 && allVotesCount >= expectedVotes;

    const allCandidatesValidated = event.validatorCandidates?.length > 0 && event.validatorIds?.length === event.validatorCandidates?.length;
    const canCloseVote = isVoteOpen && (isAllVoted || isPastDeadline || allCandidatesValidated);
    
    const hasValidators = (event.validatorCandidates?.length > 0) || (event.validatorIds?.length > 0);
    const canPayout = collected > 0 && (hasValidators ? isVoteClosed : true);
    const canClosePool = collected === 0 || event.poolReleased;

    const commission = Math.round(collected * 0.10);
    const totalToReceive = collected - commission;

    const handlePayoutClick = () => {
      if (collected <= 0) return toast.error("La cagnotte est vide.");
      if (hasValidators && !isVoteClosed) {
        return toast.error(isVoteOpen ? "Vous devez clôturer le vote d'abord" : "Vous devez d'abord lancer le vote des validateurs");
      }
      if (isPayoutPending) return toast.error("Le déblocage est déjà en cours d'approbation");
      if (event.poolReleased || isPayoutApproved) return toast.error("Les fonds ont déjà été débloqués");
      setShowPayoutConfirm(true);
    };

    const closeVoteMut = useMutation({
      mutationFn: async () => apiClient.post(`/events/${event.id}/validators/close`),
      onSuccess: () => {
        toast.success("Vote clôturé avec succès");
        qc.invalidateQueries({ queryKey: ['events', event.id] });
      },
      onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors de la clôture")
    });

    const handleStartVoteClick = () => {
      if (isVoteOpen) {
        if (!canCloseVote) {
          return toast.error("Vous devez attendre que tous les participants aient voté ou que la date limite soit passée.");
        }
        closeVoteMut.mutate();
        return;
      }
      if (isVoteClosed) return toast.error("Le vote est terminé");
      if (hasPayoutRequest) return toast.error("Le déblocage a déjà été demandé");
      if (collected <= 0) return toast.error("La cagnotte est vide.");
      setStep('validator-vote');
    };

    const isContributionFrozen = isVoteOpen || isVoteClosed || hasPayoutRequest || event.poolReleased;
    const handleContributeClick = () => {
      if (isPastDeadline || isFull || isContributionFrozen) {
        return toast.error("Les contributions sont fermées.");
      }
      navigate(`/events/${event.id}/pay?type=contribution`);
    };

    const handleCloseClick = () => {
      if (!canClosePool) return toast.error("Les fonds doivent d'abord être débloqués");
      closeMut.mutate();
    };

    let voteText = "Lancer le vote des validateurs";
    if (isVoteOpen) voteText = closeVoteMut.isPending ? "Clôture en cours..." : "Clôturer le vote";
    else if (isVoteClosed) voteText = "Vote clôturé";

    // Group attendees by user ID to sum their paidAmount
    const groupedContributions = attendees.reduce((acc: any, booking: any) => {
      const userId = booking?.user?.id;
      if (!userId) return acc;
      const amt = Number(booking?.totalPaid || booking?.amount || booking?.paidAmount || 0);
      if (amt <= 0) return acc;
      if (!acc[userId]) {
        acc[userId] = { ...booking, totalAmount: 0 };
      }
      acc[userId].totalAmount += amt;
      return acc;
    }, {});
    const contributionsList = Object.values(groupedContributions).sort((a: any, b: any) => b.totalAmount - a.totalAmount);

    return (
      <div className="flex flex-col gap-3">
        <div className={`rounded-[12px] p-4 shadow-sm border ${bgClass}`}>
          <p className="text-[14px] text-gray-500 mb-1">
            {event.poolReleased ? "Fonds débloqués" : (isFull ? "Solde disponible" : "Cagnotte")}
          </p>
          <p className="text-[20px] font-bold text-gray-900 dark:text-white leading-tight">
            {collected.toLocaleString('fr-FR')} F CFA
          </p>
          {!event.poolReleased && !isFull && (
            <p className="text-[13px] text-gray-500 mt-0.5">
              sur {event.poolTarget?.toLocaleString('fr-FR')} F CFA
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
              <div className={`absolute top-0 left-0 h-full rounded-full transition-all ${progressColorClass}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-[10px] font-bold text-white rounded px-1.5 py-0.5 leading-none ${progressColorClass}`}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* 1. Contribuer */}
        <button
          onClick={handleContributeClick}
          className={`flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] transition-transform text-[14px] font-medium text-gray-900 dark:text-white ${isPastDeadline || isFull || isContributionFrozen ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.68091 11.666C3.51388 11.666 4.99981 13.1519 4.99981 14.9849" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.99981 3.34766C4.99981 5.18063 3.51388 6.66656 1.68091 6.66656" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 3.34766C15 5.16459 16.4742 6.64051 18.2853 6.66621" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.3333 10.834V8.33398C18.3333 5.97696 18.3333 4.79845 17.6011 4.06622C16.8688 3.33398 15.6903 3.33398 13.3333 3.33398H6.66666C4.30964 3.33398 3.13113 3.33398 2.3989 4.06622C1.66666 4.79845 1.66666 5.97696 1.66666 8.33398V10.0007C1.66666 12.3577 1.66666 13.5362 2.3989 14.2684C3.13113 15.0007 4.30964 15.0007 6.66666 15.0007H10.8333" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.5 9.16602C12.5 10.5468 11.3807 11.666 10 11.666C8.61925 11.666 7.5 10.5468 7.5 9.16602C7.5 7.78531 8.61925 6.66602 10 6.66602C11.3807 6.66602 12.5 7.78531 12.5 9.16602Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15.8333 11.666V16.666M13.3333 14.166H18.3333" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Déposer une contribution
        </button>

        {/* 2. Voter */}
        <button
          onClick={handleStartVoteClick}
          disabled={closeVoteMut.isPending || isVoteClosed || hasPayoutRequest || (isVoteOpen && !canCloseVote) || collected <= 0}
          className={`flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] transition-transform text-[14px] font-medium text-gray-900 dark:text-white ${isVoteClosed || hasPayoutRequest || (isVoteOpen && !canCloseVote) || collected <= 0 ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5902 3.65263C13.0977 3.65263 12.8514 3.65263 12.6271 3.56939C12.5959 3.55782 12.5652 3.54511 12.535 3.53125C12.3175 3.43147 12.1434 3.25734 11.7951 2.90907C10.9935 2.10749 10.5927 1.7067 10.0996 1.66974C10.0333 1.66477 9.96666 1.66477 9.90041 1.66974C9.40725 1.7067 9.00641 2.10749 8.20487 2.90907C7.85661 3.25734 7.68247 3.43147 7.46497 3.53125C7.43476 3.54511 7.40405 3.55782 7.37289 3.56939C7.14854 3.65263 6.90227 3.65263 6.40976 3.65263H6.31891C5.06231 3.65263 4.43402 3.65263 4.04366 4.04301C3.65328 4.43337 3.65328 5.06167 3.65328 6.31826V6.40911C3.65328 6.90162 3.65328 7.14789 3.57004 7.37224C3.55847 7.4034 3.54576 7.43412 3.5319 7.46432C3.43212 7.68182 3.25799 7.85596 2.90971 8.20422C2.10814 9.00577 1.70735 9.4066 1.67039 9.89977C1.66542 9.96602 1.66542 10.0327 1.67039 10.0989C1.70735 10.5921 2.10814 10.9928 2.90971 11.7944C3.25799 12.1428 3.43212 12.3168 3.5319 12.5343C3.54576 12.5646 3.55847 12.5953 3.57004 12.6264C3.65328 12.8508 3.65328 13.0971 3.65328 13.5896V13.6804C3.65328 14.937 3.65328 15.5653 4.04366 15.9557C4.43402 16.3461 5.06231 16.3461 6.31891 16.3461H6.40976C6.90227 16.3461 7.14854 16.3461 7.37289 16.4293C7.40405 16.4408 7.43476 16.4536 7.46497 16.4674C7.68247 16.5673 7.85661 16.7413 8.20487 17.0896C9.00641 17.8912 9.40725 18.292 9.90041 18.3289C9.96666 18.3339 10.0333 18.3339 10.0996 18.3289C10.5927 18.292 10.9935 17.8912 11.7951 17.0896C12.1434 16.7413 12.3175 16.5673 12.535 16.4674C12.5652 16.4536 12.5959 16.4408 12.6271 16.4293C12.8514 16.3461 13.0977 16.3461 13.5902 16.3461H13.6811C14.9377 16.3461 15.566 16.3461 15.9563 15.9557C16.3467 15.5653 16.3467 14.937 16.3467 13.6804V13.5896C16.3467 13.0971 16.3467 12.8508 16.4299 12.6264C16.4415 12.5953 16.4542 12.5646 16.4681 12.5343C16.5679 12.3168 16.742 12.1428 17.0902 11.7944C17.8918 10.9928 18.2927 10.5921 18.3296 10.0989C18.3346 10.0327 18.3346 9.96602 18.3296 9.89977C18.2927 9.4066 17.8918 9.00577 17.0902 8.20422C16.742 7.85596 16.5679 7.68182 16.4681 7.46432C16.4542 7.43412 16.4415 7.4034 16.4299 7.37224C16.3467 7.14789 16.3467 6.90162 16.3467 6.40911V6.31826C16.3467 5.06167 16.3467 4.43337 15.9563 4.04301C15.566 3.65263 14.9377 3.65263 13.6811 3.65263H13.5902Z" stroke="currentColor" strokeWidth="1.25"/>
            <path d="M7.08334 13.7493C7.66553 12.7429 8.75367 12.0658 10 12.0658C11.2463 12.0658 12.3345 12.7429 12.9167 13.7493M11.6667 8.33267C11.6667 9.25317 10.9205 9.99934 10 9.99934C9.07959 9.99934 8.33334 9.25317 8.33334 8.33267C8.33334 7.41221 9.07959 6.66602 10 6.66602C10.9205 6.66602 11.6667 7.41221 11.6667 8.33267Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
          {voteText}
        </button>

        {/* 3. Débloquer */}
        <button
          onClick={handlePayoutClick}
          disabled={!canPayout || payoutMut.isPending || isPayoutPending || event.poolReleased || isPayoutApproved}
          className={`flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] transition-transform text-[14px] font-medium text-gray-900 dark:text-white ${(!canPayout || isPayoutPending || event.poolReleased || isPayoutApproved) ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.68091 14.582C3.51388 14.582 4.99981 16.0679 4.99981 17.9009" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 17.9009V17.8243C15 16.0336 16.4517 14.582 18.2423 14.582" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.99981 6.26367C4.99981 8.09665 3.51388 9.58259 1.68091 9.58259" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 6.26367C15 8.08061 16.4742 9.55651 18.2853 9.58226" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.1667 6.25C15.9792 6.26008 16.9607 6.34046 17.6011 6.98078C18.3333 7.71302 18.3333 8.89152 18.3333 11.2485V12.9152C18.3333 15.2723 18.3333 16.4508 17.6011 17.183C16.8688 17.9152 15.6903 17.9152 13.3333 17.9152H6.66666C4.30964 17.9152 3.13113 17.9152 2.3989 17.183C1.66666 16.4508 1.66666 15.2723 1.66666 12.9152V11.2485C1.66666 8.89152 1.66666 7.71302 2.3989 6.98078C3.03921 6.34046 4.02081 6.26008 5.83333 6.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.5 12.082C12.5 13.4627 11.3807 14.582 10 14.582C8.61925 14.582 7.5 13.4627 7.5 12.082C7.5 10.7013 8.61925 9.58203 10 9.58203C11.3807 9.58203 12.5 10.7013 12.5 12.082Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.91666 4.16732C7.91666 4.16732 9.4165 2.08398 10 2.08398C10.5835 2.08398 12.0833 4.16732 12.0833 4.16732M10 6.66732V2.50065" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {payoutMut.isPending ? "Traitement..." : isPayoutPending ? "Déblocage en cours..." : (event.poolReleased || isPayoutApproved) ? "Fonds débloqués" : "Débloquer les fonds"}
        </button>

        {/* 3.1 Approuver (if co-host or validator) */}
        {!!me?.id && me.id !== event.creatorId && (event.validatorIds?.includes(me.id) || event.coHostIds?.includes(me.id)) && isPayoutPending && !event.payoutRequest?.approvals?.includes(me.id) && (
          <button
            onClick={() => navigate(`/events/${event.id}/approve-payout`)}
            className={`flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-[#10B981] text-white rounded-[8px] transition-transform text-[14px] font-bold active:scale-95`}
          >
            Examiner la demande de déblocage
          </button>
        )}

        {/* 4. Clôturer */}
        <button
          onClick={handleCloseClick}
          disabled={closeMut.isPending || !canClosePool}
          className={`flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] transition-transform text-[14px] font-medium text-gray-900 dark:text-white ${!canClosePool ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.7467 7.49935V5.41602C13.7467 3.34495 12.0678 1.66602 9.99674 1.66602C7.92568 1.66602 6.24674 3.34495 6.24674 5.41602V7.49935" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.2462 7.5H8.74674C6.80106 7.5 5.82822 7.5 5.09182 7.89364C4.51037 8.20446 4.03414 8.68075 3.72339 9.26217C3.32981 9.99867 3.3299 10.9715 3.33009 12.9172C3.33026 14.8625 3.33035 15.8352 3.72397 16.5715C4.03477 17.1529 4.51097 17.629 5.09237 17.9398C5.8287 18.3333 6.80139 18.3333 8.74674 18.3333H11.2462C13.1917 18.3333 14.1646 18.3333 14.9009 17.9398C15.4823 17.629 15.9586 17.1527 16.2693 16.5713C16.6629 15.8349 16.6629 14.8622 16.6629 12.9167C16.6629 10.9712 16.6629 9.99842 16.2693 9.262C15.9586 8.68058 15.4823 8.20438 14.9009 7.89359C14.1646 7.5 13.1917 7.5 11.2462 7.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            <path d="M9.99674 14.5833C10.9172 14.5833 11.6634 13.8371 11.6634 12.9167C11.6634 11.9962 10.9172 11.25 9.99674 11.25C9.07627 11.25 8.33008 11.9962 8.33008 12.9167C8.33008 13.8371 9.07627 14.5833 9.99674 14.5833Z" stroke="currentColor" strokeWidth="1.25"/>
          </svg>
          Clôturer la cagnotte
        </button>

        {/* Participations List */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">Participations ({contributionsList.length})</h3>
            <button className="text-[13px] font-medium text-gray-500 active:opacity-70 transition-opacity">Voir tout</button>
          </div>
          <div className="flex flex-col gap-0 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            {contributionsList.slice(0, 10).map((booking: any) => {
              const avatar = booking?.user?.profile?.avatarUrl;
              const name = booking?.user?.profile?.displayName || '?';
              const amount = booking?.totalAmount;
              const date = booking?.createdAt ? format(new Date(booking.createdAt), "dd/MM/yyyy") : "";
              return (
                <div key={booking.user.id} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                      <SafeImage src={avatar} alt={name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[13px] font-medium text-gray-900 dark:text-white">{name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white">{amount.toLocaleString('fr-FR')} F</span>
                    {date && <span className="text-[10px] text-gray-400 mt-0.5">{date}</span>}
                  </div>
                </div>
              );
            })}
            {contributionsList.length === 0 && (
              <div className="p-4 text-center text-[13px] text-gray-500">Aucune participation.</div>
            )}
          </div>
        </div>

        {/* Validateurs Section */}
        {event.validatorCandidates?.length > 0 && (
          <div className="mt-4 mb-8">
            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white mb-3">Validateurs</h3>
            {isVoteOpen ? (
              <div className="flex items-center justify-center gap-2 bg-white dark:bg-[#1A1A1A] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-gray-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-slow">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.26l5.57 5.57"/>
                </svg>
                <span className="text-[14px] font-medium">Vote en cours</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                {event.validatorIds?.map((vid: string) => {
                  const attendee = attendees?.find((a: any) => a.user.id === vid);
                  if (!attendee) return null;
                  const name = attendee.user.profile?.displayName || 'Validateur';
                  const avatar = attendee.user.profile?.avatarUrl;
                  const hasApproved = event.payoutRequest?.approvals?.includes(vid);
                  return (
                    <div key={vid} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                          <SafeImage src={avatar} alt={name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[13px] font-medium text-gray-900 dark:text-white">{name}</span>
                      </div>
                      {hasApproved && (
                        <div className="w-5 h-5 rounded-full bg-[#10B981] flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Payout Confirm Bottom Sheet */}
        <BottomSheet open={showPayoutConfirm} onClose={() => setShowPayoutConfirm(false)}>
          <div className="flex flex-col w-full bg-white dark:bg-[#1A1A1A]">
            <h2 className="text-center text-[17px] font-bold text-gray-900 dark:text-white mb-6">Détails du retrait</h2>
            
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">{event.title}</h3>
            
            <div className="flex flex-col gap-3 border-t border-b border-gray-100 dark:border-gray-800 border-dashed py-4 mb-4">
              <div className="flex justify-between">
                <span className="text-[14px] text-gray-500">Cagnotte</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">Frais généraux</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[14px] text-gray-500">Montant brut</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{collected.toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[14px] text-gray-500">Commission</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{commission.toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[14px] text-gray-500">Méthode</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">Mobile Money</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[14px] text-gray-500">Numéro</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{me?.profile?.phone || "Non défini"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              <div className="flex justify-between">
                <span className="text-[14px] text-gray-500">Total à recevoir</span>
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{totalToReceive.toLocaleString('fr-FR')} F</span>
              </div>
            </div>

            <PrimaryButton 
              onClick={() => payoutMut.mutate()} 
              loading={payoutMut.isPending}
              className="w-full"
            >
              Confirmer
            </PrimaryButton>
          </div>
        </BottomSheet>

        {/* Payout Success Bottom Sheet */}
        <BottomSheet open={showPayoutSuccess} onClose={() => setShowPayoutSuccess(false)}>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#4DEF8E] to-[#FFEB3A] flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13L9 17L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-[20px] font-bold text-center text-gray-900 dark:text-white mb-2 leading-tight">
              Demande de retrait<br/>envoyée !
            </h2>
            <p className="text-[14px] text-gray-500 text-center mb-8 px-4">
              Votre demande de retrait a été bien envoyée.<br/>
              Vous recevrez les sous dès l'approbation des validateurs.
            </p>
            <PrimaryButton 
              onClick={() => setShowPayoutSuccess(false)} 
              className="w-full"
            >
              Retour à la cagnotte
            </PrimaryButton>
          </div>
        </BottomSheet>

      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <svg width="128" height="165" viewBox="0 0 128 165" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
        <path d="M68.9433 44.4843C67.945 46.9101 62.0679 46.743 55.9108 44.2042C49.7537 41.6655 45.5661 37.6406 46.5645 35.2148C46.7994 34.6546 47.4679 32.5541 48.1365 32.2649C50.4313 31.2937 54.7996 33.4756 59.5292 35.4271C63.9336 37.234 68.9704 38.413 69.7519 40.8027C70.2217 42.2573 69.2279 43.7932 68.9433 44.4843Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M69.7519 40.8028C70.1269 42.7046 69.3002 43.6171 68.9433 44.4844C68.5865 45.3517 67.543 45.9209 66.0839 46.1197C65.9014 46.1507 65.7175 46.1718 65.5327 46.1829C64.4139 46.2487 63.2912 46.1896 62.1854 46.0067C62.0273 46.0067 61.8692 45.957 61.7066 45.9299C60.4085 45.6969 59.1296 45.3678 57.8804 44.9452L57.4287 44.7916C56.9272 44.6154 56.4123 44.4212 55.8973 44.2088C55.3823 43.9965 54.8944 43.7571 54.4111 43.5448L53.9955 43.346C52.8567 42.7829 51.7593 42.1398 50.7114 41.4216L50.341 41.1596C49.4262 40.5131 48.5881 39.7644 47.8429 38.9281C47.73 38.8016 47.6261 38.6796 47.5267 38.5532C46.5555 37.3244 46.1715 36.1499 46.5555 35.2148C46.8084 34.614 47.3505 32.5587 48.1275 32.2605C49.0831 31.9913 50.0946 31.9913 51.0502 32.2605L51.5019 32.3689C53.7606 32.9471 56.6065 34.2346 59.5112 35.4317C62.9353 36.8456 66.9873 38.3137 68.9749 40.0077C69.0932 40.1073 69.2063 40.2128 69.3137 40.3239C69.4723 40.4716 69.6189 40.6317 69.7519 40.8028Z" fill="black"/>
        <g opacity="0.2">
        <path d="M51.7278 31.9805L51.52 32.36L47.8519 38.9236C47.739 38.7971 47.6351 38.6752 47.5357 38.5487L51.0592 32.2515L51.3348 31.7637L51.7278 31.9805Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M54.5014 34.659L50.7204 41.435L50.35 41.173L54.1084 34.4512L54.5014 34.659Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M61.4537 38.5441L57.8805 44.9452L57.4287 44.7916L61.0426 38.3047L61.4537 38.5441Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M58.2191 36.7375L54.4201 43.5451L54.0045 43.3463L57.8261 36.498L58.2191 36.7375Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M65.6682 39.7815L62.1853 46.0064C62.0272 46.0064 61.8691 45.9567 61.7065 45.9296L65.2706 39.5557L65.6682 39.7815Z" fill="black"/>
        </g>
        <path d="M69.7248 42.3703C68.7264 44.7961 62.9217 44.7012 56.7601 42.158C50.5984 39.6147 46.4154 35.5943 47.4182 33.1685C48.4211 30.7427 54.2213 30.8421 60.3829 33.3808C66.5446 35.9196 70.7231 39.9309 69.7248 42.3703Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M67.6287 41.4896C66.924 43.2017 62.3977 42.9623 57.5235 40.9521C52.6493 38.9418 49.2703 35.9197 49.975 34.2077C50.6797 32.4956 55.2061 32.735 60.0848 34.7452C64.9635 36.7555 68.338 39.7776 67.6287 41.4896Z" fill="white"/>
        <path d="M100.077 22.5573C101.685 24.6308 98.6221 29.6495 93.3504 33.7286C88.0787 37.8078 82.5088 39.434 80.9051 37.3425C80.5347 36.8637 79.035 35.26 79.1253 34.5101C79.428 32.0392 83.489 29.3378 87.5366 26.2028C91.304 23.2846 94.823 19.4991 97.285 20.0095C98.7802 20.3393 99.6204 21.97 100.077 22.5573Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M97.285 20.0283C99.1236 20.6517 99.503 21.8353 100.077 22.558C100.65 23.2808 100.628 24.4869 100.077 25.8557C100.013 26.0228 99.9367 26.19 99.8554 26.3616C99.3604 27.3659 98.7543 28.3114 98.0484 29.1804C97.9536 29.3069 97.8497 29.4289 97.7458 29.5554C96.8962 30.5686 95.9721 31.5168 94.9812 32.3922L94.6333 32.6949C94.2313 33.0427 93.8067 33.3906 93.3685 33.7294C92.9303 34.0682 92.4921 34.3889 92.0494 34.6916C91.9275 34.7819 91.7965 34.8677 91.6745 34.9536C90.619 35.6616 89.5139 36.2926 88.3678 36.8418C88.2278 36.9141 88.0922 36.9728 87.9612 37.0361C86.9428 37.5071 85.8745 37.8617 84.7765 38.0931C84.6139 38.1292 84.4558 38.1564 84.2977 38.1789C82.7482 38.4093 81.5376 38.1789 80.9187 37.3613C80.5212 36.8463 79.0079 35.3511 79.1389 34.5335C79.3752 33.5669 79.8775 32.6859 80.589 31.9902C80.6883 31.8773 80.7968 31.7643 80.9097 31.6469C82.5404 29.9574 85.0656 28.146 87.5502 26.2261C90.4819 23.9674 93.7705 21.1712 96.2234 20.2948C96.3715 20.2405 96.5223 20.1937 96.6752 20.1548C96.8751 20.0978 97.0789 20.0555 97.285 20.0283Z" fill="black"/>
        <g opacity="0.2">
        <path d="M80.6702 31.2754L80.8961 31.6458L84.7629 38.092C84.6003 38.1282 84.4422 38.1553 84.2841 38.1779L80.5754 31.9801L80.2863 31.5284L80.6702 31.2754Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M84.37 30.2012L88.3543 36.8416C88.2142 36.9139 88.0787 36.9726 87.9477 37.0359L83.9815 30.4316L84.37 30.2012Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M91.1957 26.1084L94.9677 32.3965L94.6198 32.6992L90.8072 26.3388L91.1957 26.1084Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M88.0245 28.0098L92.0359 34.6909C91.9139 34.7812 91.783 34.8671 91.661 34.9529L87.6315 28.2402L88.0245 28.0098Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M94.3667 23.0586L98.0348 29.1796C97.9399 29.3061 97.836 29.428 97.7321 29.5545L93.9782 23.2935L94.3667 23.0586Z" fill="black"/>
        </g>
        <path d="M91.9828 31.9553C97.2511 27.8747 100.22 22.8863 98.6145 20.8133C97.0089 18.7403 91.4365 20.3678 86.1683 24.4484C80.9 28.529 77.9309 33.5174 79.5366 35.5904C81.1422 37.6633 86.7146 36.0359 91.9828 31.9553Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M91.3294 30.6985C95.4991 27.4688 97.959 23.6627 96.8239 22.1972C95.6888 20.7317 91.3885 22.1619 87.2189 25.3915C83.0492 28.6211 80.5893 32.4273 81.7244 33.8927C82.8595 35.3582 87.1598 33.9281 91.3294 30.6985Z" fill="white"/>
        <path d="M78.2716 12.845C77.7566 15.8174 71.089 17.0732 63.536 15.718C55.9831 14.3628 50.2867 10.8709 50.8152 7.89853C50.9372 7.20738 51.1495 4.69123 51.8587 4.18981C54.2032 2.53647 59.6511 3.91877 65.4514 4.94872C70.8722 5.91091 76.8034 5.9877 78.2716 8.48578C79.1615 10.0217 78.4206 11.9957 78.2716 12.845Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M78.2716 8.49079C79.1751 10.5417 78.4568 11.7659 78.2716 12.8319C78.0864 13.898 77.0519 14.7879 75.4618 15.3752C75.2676 15.452 75.0643 15.5152 74.8565 15.5785C73.6128 15.9281 72.3341 16.1386 71.0439 16.2064C70.8587 16.2064 70.678 16.2064 70.4883 16.238C68.9684 16.2939 67.4465 16.238 65.9348 16.0709L65.4063 16.0031C64.7964 15.9263 64.1685 15.836 63.5406 15.723C62.9127 15.6101 62.3029 15.4836 61.7021 15.3436C61.5304 15.3074 61.3588 15.2623 61.1871 15.2216C59.7678 14.8712 58.3759 14.4182 57.0221 13.8664C56.855 13.8032 56.6969 13.7309 56.5388 13.6677C55.3506 13.1619 54.2232 12.524 53.1779 11.7659C53.0198 11.6529 52.8752 11.54 52.7261 11.4225C51.3258 10.2797 50.6075 9.05094 50.8108 7.90806C50.9463 7.16722 51.0547 4.74593 51.8498 4.19933C52.6448 3.65274 53.7832 3.48108 55.1384 3.47656H55.6805C58.3909 3.56691 61.8828 4.3213 65.4469 4.95373C69.648 5.7036 74.5674 6.35862 77.2146 7.77706C77.3698 7.85935 77.5206 7.94982 77.6663 8.0481C77.8793 8.17967 78.0817 8.32769 78.2716 8.49079Z" fill="black"/>
        <g opacity="0.2">
        <path d="M55.8296 3.01528L55.6851 3.4896L53.1734 11.7744C53.0153 11.6614 52.8708 11.5485 52.7217 11.4311L55.134 3.48508L55.3237 2.86621L55.8296 3.01528Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M59.606 5.32803L57.0176 13.8613C56.8504 13.798 56.6923 13.7257 56.5342 13.6625L59.1091 5.16992L59.606 5.32803Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M68.3833 8.0032L65.9304 16.0847L65.4019 16.0169L67.8819 7.84961L68.3833 8.0032Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M64.3042 6.76516L61.6977 15.3481C61.526 15.3119 61.3544 15.2668 61.1827 15.2261L63.8027 6.60254L64.3042 6.76516Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M73.4291 8.35512L71.0395 16.2198C70.8543 16.2198 70.6736 16.2198 70.4838 16.2514L72.9277 8.20605L73.4291 8.35512Z" fill="black"/>
        </g>
        <path d="M78.6234 10.25C79.1523 7.27795 73.4561 3.77869 65.9006 2.43422C58.3452 1.08975 51.7915 2.40918 51.2626 5.38127C50.7338 8.35335 56.4299 11.8526 63.9854 13.1971C71.5409 14.5416 78.0945 13.2221 78.6234 10.25Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M76.0521 9.79611C76.4258 7.696 71.8822 5.1311 65.9037 4.06723C59.9251 3.00337 54.7756 3.84341 54.4019 5.94351C54.0282 8.04362 58.5718 10.6085 64.5504 11.6724C70.5289 12.7363 75.6784 11.8962 76.0521 9.79611Z" fill="white"/>
        <path d="M117.708 88.7323L71.2202 91.4427C69.578 91.5394 67.9667 91.9312 66.4634 92.5992L15.9687 115.186C15.0828 115.575 14.3572 116.257 13.9133 117.117C13.4693 117.977 13.3338 118.963 13.5294 119.911L21.8729 159.37C22.0139 160.005 22.2984 160.6 22.7046 161.109C23.1107 161.617 23.6278 162.026 24.2163 162.304C24.8048 162.582 25.449 162.722 26.0999 162.713C26.7507 162.704 27.3908 162.546 27.9713 162.252L77.8109 137.37L123.833 135.83C124.4 135.815 124.956 135.679 125.466 135.432C125.976 135.185 126.427 134.832 126.79 134.397C127.153 133.962 127.419 133.455 127.571 132.909C127.722 132.363 127.755 131.791 127.669 131.231L121.512 93.4484C121.191 91.497 119.709 88.6736 117.708 88.7323Z" fill="#FF7A00"/>
        <path opacity="0.1" d="M117.708 88.7323L71.2202 91.4427C69.578 91.5394 67.9667 91.9312 66.4634 92.5992L15.9687 115.186C15.0828 115.575 14.3572 116.257 13.9133 117.117C13.4693 117.977 13.3338 118.963 13.5294 119.911L21.8729 159.37C22.0139 160.005 22.2984 160.6 22.7046 161.109C23.1107 161.617 23.6278 162.026 24.2163 162.304C24.8048 162.582 25.449 162.722 26.0999 162.713C26.7507 162.704 27.3908 162.546 27.9713 162.252L77.8109 137.37L123.833 135.83C124.4 135.815 124.956 135.679 125.466 135.432C125.976 135.185 126.427 134.832 126.79 134.397C127.153 133.962 127.419 133.455 127.571 132.909C127.722 132.363 127.755 131.791 127.669 131.231L121.512 93.4484C121.191 91.497 119.709 88.6736 117.708 88.7323Z" fill="black"/>
        <path d="M24.3976 63.0399L0.00154114 85.5283L43.7812 133.022L68.1773 110.533L24.3976 63.0399Z" fill="#FF7A00"/>
        <path opacity="0.5" d="M68.171 110.538L43.7729 133.025L0 85.5347L16.0094 70.7766L24.3981 63.043L25.7939 64.5608L68.171 110.538Z" fill="#FAFAFA"/>
        <path d="M24.5542 65.9431L3.02791 85.7861L43.9786 130.211L65.5049 110.367L24.5542 65.9431Z" stroke="#FF7A00" strokeWidth="0.451733" strokeMiterlimit="10"/>
        <path d="M39.1101 103.336C41.5792 101.06 41.2669 96.705 38.4126 93.6086C35.5583 90.5121 31.2428 89.847 28.7737 92.1231C26.3046 94.3991 26.6169 98.7543 29.4712 101.851C32.3255 104.947 36.641 105.612 39.1101 103.336Z" fill="#FF7A00"/>
        <path opacity="0.1" d="M43.5154 113.75L34.8466 116.745L16.0094 70.7766L24.3981 63.043L25.7939 64.5608L43.5154 113.75Z" fill="black"/>
        <path d="M45.2044 44.4331L14.0118 55.7432L36.0298 116.468L67.2224 105.158L45.2044 44.4331Z" fill="#FF7A00"/>
        <path opacity="0.5" d="M45.2044 44.4331L14.0118 55.7432L36.0298 116.468L67.2224 105.158L45.2044 44.4331Z" fill="#FAFAFA"/>
        <path d="M44.2239 47.1717L16.7005 57.1514L37.2958 113.952L64.8192 103.972L44.2239 47.1717Z" stroke="#FF7A00" strokeWidth="0.451733" strokeMiterlimit="10"/>
        <path d="M43.1996 87.2811C46.3566 86.1365 47.7521 81.999 46.3166 78.04C44.881 74.0809 41.1581 71.7993 38.0012 72.944C34.8442 74.0887 33.4487 78.2261 34.8842 82.1852C36.3197 86.1443 40.0427 88.4258 43.1996 87.2811Z" fill="#FF7A00"/>
        <path d="M118.011 90.3357L72.1597 92.9196C70.5344 93.0087 68.9397 93.3994 67.4572 94.0716L17.7034 116.532C16.827 116.928 16.112 117.611 15.6767 118.469C15.2414 119.326 15.1117 120.307 15.3092 121.248L23.6527 160.725C23.7871 161.356 24.0644 161.948 24.4635 162.456C24.8625 162.964 25.3726 163.373 25.9546 163.653C26.5365 163.932 27.1748 164.075 27.8204 164.069C28.466 164.064 29.1018 163.91 29.6788 163.62L78.7821 138.879L124.172 137.442C124.734 137.425 125.286 137.287 125.79 137.039C126.295 136.791 126.741 136.439 127.098 136.005C127.456 135.571 127.716 135.066 127.863 134.523C128.01 133.98 128.039 133.412 127.949 132.857L121.774 95.0789C121.453 93.1094 119.989 90.2815 118.011 90.3357Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M74.0255 99.8315L113.367 97.4102" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
        <path opacity="0.2" d="M69.3138 100.848L76.5009 133.86" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
        <path opacity="0.2" d="M21.3941 130.653L26.4625 156.045C26.4625 156.045 30.3474 145.972 21.3941 130.653Z" fill="#FAFAFA"/>
        <path opacity="0.2" d="M22.0581 130.951C22.2343 131.403 67.0778 112.159 67.0778 112.159C67.1993 116.522 66.1085 120.833 63.9266 124.613C61.7446 128.393 58.5571 131.494 54.7184 133.571C41.2206 141.138 22.0581 130.951 22.0581 130.951Z" fill="#FAFAFA"/>
        <path d="M51.8453 131.701C52.9181 131.701 53.7878 130.832 53.7878 129.759C53.7878 128.686 52.9181 127.816 51.8453 127.816C50.7726 127.816 49.9029 128.686 49.9029 129.759C49.9029 130.832 50.7726 131.701 51.8453 131.701Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M67.1004 112.159C67.1004 112.159 72.6612 120.53 71.3151 134.786L67.1004 112.159Z" fill="black"/>
        <g opacity="0.2">
        <path d="M19.2484 120.678L20.2829 120.222" stroke="#FAFAFA" strokeWidth="0.451733" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22.4286 119.274L64.3043 100.762" stroke="#FAFAFA" strokeWidth="0.451733" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.35 2.35"/>
        <path d="M65.3794 100.287L66.4094 99.8311" stroke="#FAFAFA" strokeWidth="0.451733" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <path opacity="0.2" d="M75.3445 107.254L114.686 104.828" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
        <path opacity="0.2" d="M77.1153 116.51L116.457 114.084" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Aucune cagnotte ajoutée</h3>
      <p className="text-[14px] text-gray-500 text-center mb-6 max-w-[250px]">Ajoutez une cagnotte à l'événement pour mutualiser les frais.</p>

      <button 
        onClick={handleAddCagnotte}
        className="flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] active:scale-95 transition-transform text-[14px] font-medium text-gray-900 dark:text-white"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.6667 2.5H4.16667C3.24619 2.5 2.5 3.24619 2.5 4.16667C2.5 5.08714 3.24619 5.83333 4.16667 5.83333H15C15 5.05836 15 4.67087 14.9148 4.35295C14.6837 3.49022 14.0097 2.81635 13.1471 2.58518C12.8292 2.5 12.4417 2.5 11.6667 2.5Z" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 17.5003H12.5C14.857 17.5003 16.0355 17.5003 16.7677 16.7681C17.5 16.0358 17.5 14.8573 17.5 12.5003V10.8337C17.5 8.47666 17.5 7.29813 16.7677 6.56589C16.0355 5.83366 14.857 5.83366 12.5 5.83366H5.83333M2.5 10.0003V4.16699" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17.5 10H15.8333C15.4458 10 15.2521 10 15.0932 10.0426C14.6617 10.1582 14.3248 10.4951 14.2092 10.9265C14.1667 11.0854 14.1667 11.2792 14.1667 11.6667C14.1667 12.0542 14.1667 12.2479 14.2092 12.4068C14.3248 12.8382 14.6617 13.1752 15.0932 13.2908C15.2521 13.3333 15.4458 13.3333 15.8333 13.3333H17.5" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.33333 14.5837H5.41667M5.41667 14.5837H2.5M5.41667 14.5837V11.667M5.41667 14.5837V17.5003" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Ajouter une cagnotte
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: CAGNOTTE FULLSCREEN FORM
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
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center mr-3 active:scale-95 transition-transform">
          <ArrowLeft01Icon className="w-6 h-6 text-gray-500" />
        </button>
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
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date limite de contribution</p>
            <input
              type="date"
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
