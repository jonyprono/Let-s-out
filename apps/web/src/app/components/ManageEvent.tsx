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
  const { user } = useAuthStore();
  const initialTab = (searchParams.get('tab') as 'details' | 'participants' | 'cagnotte') || 'details';
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'cagnotte'>(initialTab);
  const [cagnotteStep, setCagnotteStep] = useState<'empty' | 'form' | 'summary' | 'success' | 'validator-vote'>('empty');

  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 5_000,
    initialData: () => {
      // First try the ['events', id] cache (injected optimistically by handlePublish)
      const cached = qc.getQueryData<any>(['events', id]);
      if (cached && !Array.isArray(cached)) return cached;

      // Then try ['my-events'] list
      const myEvents = qc.getQueryData<any>(['my-events']);
      if (myEvents?.data?.createdEvents) {
        const found = myEvents.data.createdEvents.find((e: any) => e.id === id);
        if (found) return found;
      }
      return undefined;
    },
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

  const hasPot = Boolean(event.poolTarget && event.poolTarget > 0);
  
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
          <span className="font-semibold text-gray-900 dark:text-white drop-shadow-md">
            {(user?.id === event.creatorId || (event.coHostIds || []).includes(user?.id)) ? "Gestion événement" : "Détails événement"}
          </span>
        </div>
      </div>

      {/* Event Title & Date */}
      <div className="px-4 py-4 shrink-0 bg-white dark:bg-[#1A1A1A]">
        <h1 className="text-[20px] font-bold text-gray-900 dark:text-white mb-1">{event.title}</h1>
        <p className="text-[13px] text-gray-500">
          {(() => {
            try {
              const d = event.startAt ? new Date(event.startAt) : new Date();
              if (isNaN(d.getTime())) return 'Date non précisée';
              return format(d, "EEEE d MMMM yyyy, HH'h'mm", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase());
            } catch (e) {
              return 'Date non précisée';
            }
          })()}
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
        {activeTab === 'details' && <TabDetails event={event} isCreator={user?.id === event.creatorId || (event.coHostIds || []).includes(user?.id)} />}
        {activeTab === 'participants' && <TabParticipants event={event} attendees={Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []} />}
        {activeTab === 'cagnotte' && <TabCagnotteInline event={event} attendees={Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []} setCagnotteStep={setCagnotteStep} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB: DETAILS
// ----------------------------------------------------------------------
function TabDetails({ event, isCreator }: { event: any, isCreator?: boolean }) {
  const navigate = useNavigate();
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
            <span className="text-gray-900 dark:text-white font-medium">
              {(() => {
                try {
                  const d = event.startAt ? new Date(event.startAt) : new Date();
                  if (isNaN(d.getTime())) return 'Date non précisée';
                  return format(d, 'EEEE d MMMM yyyy', { locale: fr }).replace(/^\w/, (c) => c.toUpperCase());
                } catch(e) { return 'Date non précisée'; }
              })()}
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-50 dark:border-gray-800 py-2">
            <span className="text-gray-500">Lieu</span>
            <span className="text-gray-900 dark:text-white font-medium text-right max-w-[60%]">{event.address || event.city || 'En ligne'}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-gray-500">Heure</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {(() => {
                try {
                  const d = event.startAt ? new Date(event.startAt) : new Date();
                  if (isNaN(d.getTime())) return '--:--';
                  return format(d, 'HH:mm');
                } catch(e) { return '--:--'; }
              })()}
            </span>
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

        {isCreator && (
          <button 
            onClick={() => setShowSearchModal(true)}
            className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-[13px] font-semibold text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
          >
            Ajouter
          </button>
        )}
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

      {/* Modifier l'événement — organisateur uniquement */}
      {isCreator && (
        <button
          onClick={() => navigate('/events/create', { state: { editEventId: event.id, eventData: event } })}
          className="w-full py-3.5 mb-6 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[14px] font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Modifier l'événement
        </button>
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
function TabCagnotteInline({ event, attendees, setCagnotteStep }: { event: any, attendees: any[], setCagnotteStep: (s: any) => void }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const hasPot = Boolean(event.poolTarget && event.poolTarget > 0);
  const isCreator = user?.id === event.creatorId;
  const isCoHost = (event.coHostIds || []).includes(user?.id);

  const [expandedSection, setExpandedSection] = useState<'participations' | 'validators' | 'payouts' | 'payout-form' | null>(null);

  const { data: statusData } = useQuery({
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

  // payout mutation kept for future inline use

  if (!hasPot) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-100 dark:border-gray-800 mt-4">
        <div className="mb-6 flex justify-center">
          {/* Custom empty state illustration matching design */}
          <svg width="128" height="165" viewBox="0 0 128 165" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        </div>
        <h2 className="text-[18px] font-bold text-[#1B1818] dark:text-white mb-2 text-center">Aucune cagnotte ajoutée</h2>
        <p className="text-[14px] text-[#737373] text-center mb-8 max-w-[280px] leading-relaxed">
          Ajoutez une cagnotte à l'événement pour mutualiser les frais.
        </p>
        {(isCreator || isCoHost) && (
          <button
            onClick={() => setCagnotteStep('setup')}
            className="w-full py-3.5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[14px] font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
          >
            <svg width="20" height="20" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.833 19.3359C19.833 20.7166 18.7137 21.8359 17.333 21.8359C15.9522 21.8359 14.833 20.7166 14.833 19.3359C14.833 17.9552 15.9522 16.8359 17.333 16.8359C18.7137 16.8359 19.833 17.9552 19.833 19.3359Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.3333 13.2247C12.2139 13.2194 10.893 13.0933 9.21123 12.7596C8.25404 12.5696 7.33325 13.2813 7.33325 14.2571V24.2742C7.33325 24.9625 7.8059 25.567 8.47805 25.7152C15.4429 27.2511 16.5824 25.4454 21.3333 25.4454C22.844 25.4454 24.0694 25.588 25.0095 25.7655C26.1052 25.9725 27.3333 25.1334 27.3333 24.0183V14.2435C27.3333 13.6753 27.0089 13.161 26.4662 12.9928C25.6561 12.7417 24.2785 12.4226 22.3333 12.3379" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.33325 16.336C9.28458 16.336 11.0381 14.741 11.2623 13.0901M23.8338 12.8359C23.8338 14.8756 25.5988 16.805 27.3333 16.805M27.3333 22.336C25.4342 22.336 23.5934 23.6462 23.4353 25.4343M11.3337 25.8321C11.3337 23.6229 9.54288 21.8321 7.33374 21.8321" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.8333 10.8359C14.8333 10.8359 16.6331 8.33594 17.3333 8.33594M17.3333 8.33594C18.0335 8.33594 19.8333 10.8359 19.8333 10.8359M17.3333 8.33594V13.8359" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ajouter une cagnotte
          </button>
        )}
      </div>
    );
  }

  const totalCollected = statusData?.totalCollected || 0;
  const totalWithdrawn = statusData?.totalWithdrawn || 0;
  const unlockedAmount = statusData?.unlockedAmount || 0;
  const poolClosedAt = statusData?.poolClosedAt;

  const maxAvailableNow = Math.min(Math.max(0, unlockedAmount - totalWithdrawn), Math.max(0, totalCollected - totalWithdrawn));

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

  const progressPercent = event.poolTarget ? Math.min(100, Math.round((totalCollected / event.poolTarget) * 100)) : 0;
  const isGoalReached = event.poolTarget && totalCollected >= event.poolTarget;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Carte solde principal ── */}
      <div className={`rounded-[12px] p-4 shadow-sm border ${isGoalReached ? 'bg-[#F4F9F7] dark:bg-[#101F18] border-green-50 dark:border-green-900/30' : 'bg-[#FFF9EC] dark:bg-[#2A1F13] border-[#FFE8B3] dark:border-[#FF7A00]/30'}`}>
        <p className="text-[13px] text-gray-600 dark:text-gray-400 font-medium mb-2">Cagnotte</p>
        <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-tight">
          {totalCollected.toLocaleString('fr-FR')} F CFA
        </p>
        {event.poolTarget ? (
          <p className="text-[12px] text-gray-500 mb-4 mt-1">sur {event.poolTarget.toLocaleString('fr-FR')} F CFA</p>
        ) : (
          <p className="text-[12px] text-gray-500 mb-4 mt-1">Objectif non défini</p>
        )}

        <div className="flex items-center gap-3">
          <div className={`flex-1 rounded-full h-2 flex overflow-hidden ${isGoalReached ? 'bg-green-100 dark:bg-green-900/40' : 'bg-white dark:bg-[#1A1A1A]'}`}>
            <div className={`h-2 rounded-full transition-all ${isGoalReached ? 'bg-[#10B981]' : 'bg-[#FF7A00]'}`} style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded ${isGoalReached ? 'bg-[#10B981]' : 'bg-[#FF7A00]'}`}>{progressPercent}%</span>
        </div>

        <div className={`mt-4 pt-4 border-t flex justify-between ${isGoalReached ? 'border-green-200/50 dark:border-green-800/30' : 'border-[#FFE8B3]/50 dark:border-[#FF7A00]/20'}`}>
          <div className="flex flex-col">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">Collecté</span>
            <span className="font-semibold text-gray-900 dark:text-white">{totalCollected.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">Débloqué</span>
            <span className={`font-semibold ${isGoalReached ? 'text-green-600' : 'text-[#FF7A00]'}`}>{unlockedAmount.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">Disponible</span>
            <span className="font-semibold text-[#FF7A00]">{maxAvailableNow.toLocaleString('fr-FR')} F</span>
          </div>
        </div>
        
        {poolClosedAt && (
          <div className="mt-4 px-3 py-2 rounded-[8px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <span className="text-[14px] mt-0.5">🔒</span>
            <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">La cagnotte est fermée aux nouveaux versements.</p>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col gap-2 mt-4">
        {/* Déposer une contribution */}
        <button
          onClick={() => navigate(`/events/${event.id}/pay?type=contribution`)}
          className="w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.833 19.3359C19.833 20.7166 18.7137 21.8359 17.333 21.8359C15.9522 21.8359 14.833 20.7166 14.833 19.3359C14.833 17.9552 15.9522 16.8359 17.333 16.8359C18.7137 16.8359 19.833 17.9552 19.833 19.3359Z" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.3333 13.2247C12.2139 13.2194 10.893 13.0933 9.21123 12.7596C8.25404 12.5696 7.33325 13.2813 7.33325 14.2571V24.2742C7.33325 24.9625 7.8059 25.567 8.47805 25.7152C15.4429 27.2511 16.5824 25.4454 21.3333 25.4454C22.844 25.4454 24.0694 25.588 25.0095 25.7655C26.1052 25.9725 27.3333 25.1334 27.3333 24.0183V14.2435C27.3333 13.6753 27.0089 13.161 26.4662 12.9928C25.6561 12.7417 24.2785 12.4226 22.3333 12.3379" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.33325 16.336C9.28458 16.336 11.0381 14.741 11.2623 13.0901M23.8338 12.8359C23.8338 14.8756 25.5988 16.805 27.3333 16.805M27.3333 22.336C25.4342 22.336 23.5934 23.6462 23.4353 25.4343M11.3337 25.8321C11.3337 23.6229 9.54288 21.8321 7.33374 21.8321" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.8333 10.8359C14.8333 10.8359 16.6331 8.33594 17.3333 8.33594M17.3333 8.33594C18.0335 8.33594 19.8333 10.8359 19.8333 10.8359M17.3333 8.33594V13.8359" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-medium text-[12px] text-[#1B1818] dark:text-gray-200">Déposer une contribution</span>
        </button>

        { (isCreator || isCoHost) && (
          <>
            {/* Lancer le vote des validateurs */}
            <button
              onClick={() => navigate(`/events/${event.id}/validators-vote`)}
              className="w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.6416 9.71792C21.0506 9.71792 20.755 9.71792 20.4858 9.61803C20.4484 9.60415 20.4116 9.58889 20.3753 9.57226C20.1143 9.45253 19.9054 9.24357 19.4874 8.82565C18.5255 7.86375 18.0446 7.3828 17.4528 7.33845C17.3733 7.33249 17.2933 7.33249 17.2138 7.33845C16.622 7.3828 16.141 7.86375 15.1791 8.82564C14.7612 9.24357 14.5522 9.45253 14.2912 9.57226C14.255 9.58889 14.2181 9.60415 14.1807 9.61803C13.9115 9.71792 13.616 9.71792 13.025 9.71792H12.9159C11.408 9.71792 10.6541 9.71792 10.1856 10.1864C9.71719 10.6548 9.71719 11.4088 9.71719 12.9167V13.0257C9.71719 13.6167 9.71719 13.9122 9.6173 14.1815C9.60342 14.2188 9.58816 14.2557 9.57153 14.292C9.4518 14.553 9.24284 14.7619 8.82491 15.1798C7.86302 16.1417 7.38207 16.6227 7.33772 17.2145C7.33176 17.294 7.33176 17.374 7.33772 17.4535C7.38207 18.0453 7.86302 18.5262 8.82491 19.4881C9.24284 19.9061 9.4518 20.115 9.57153 20.376C9.58816 20.4123 9.60342 20.4491 9.6173 20.4865C9.71719 20.7557 9.71719 21.0513 9.71719 21.6423V21.7513C9.71719 23.2592 9.71719 24.0132 10.1856 24.4816C10.6541 24.9501 11.408 24.9501 12.9159 24.9501H13.025C13.616 24.9501 13.9115 24.9501 14.1807 25.0499C14.2181 25.0638 14.255 25.0791 14.2912 25.0957C14.5522 25.2155 14.7612 25.4244 15.1791 25.8423C16.141 26.8042 16.622 27.2852 17.2138 27.3295C17.2933 27.3355 17.3733 27.3355 17.4528 27.3295C18.0446 27.2852 18.5255 26.8042 19.4874 25.8423C19.9054 25.4244 20.1143 25.2155 20.3753 25.0957C20.4116 25.0791 20.4484 25.0638 20.4858 25.0499C20.755 24.9501 21.0506 24.9501 21.6416 24.9501H21.7505C23.2584 24.9501 24.0125 24.9501 24.4809 24.4816C24.9494 24.0132 24.9494 23.2592 24.9494 21.7513V21.6423C24.9494 21.0513 24.9494 20.7557 25.0492 20.4865C25.0631 20.4491 25.0783 20.4123 25.0949 20.376C25.2147 20.115 25.4237 19.9061 25.8416 19.4881C26.8035 18.5262 27.2845 18.0453 27.3288 17.4535C27.3348 17.374 27.3348 17.294 27.3288 17.2145C27.2845 16.6227 26.8035 16.1417 25.8416 15.1798C25.4237 14.7619 25.2147 14.553 25.0949 14.292C25.0783 14.2557 25.0631 14.2188 25.0492 14.1815C24.9494 13.9122 24.9494 13.6167 24.9494 13.0257V12.9167C24.9494 11.4088 24.9494 10.6548 24.4809 10.1864C24.0125 9.71792 23.2584 9.71792 21.7505 9.71792H21.6416Z" stroke="#737373" strokeWidth="1.5"/>
                <path d="M13.8333 21.832C14.5319 20.6243 15.8377 19.8117 17.3333 19.8117C18.8289 19.8117 20.1347 20.6243 20.8333 21.832M19.3333 15.332C19.3333 16.4366 18.4379 17.332 17.3333 17.332C16.2288 17.332 15.3333 16.4366 15.3333 15.332C15.3333 14.2275 16.2288 13.332 17.3333 13.332C18.4379 13.332 19.3333 14.2275 19.3333 15.332Z" stroke="#737373" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="font-medium text-[12px] text-[#1B1818] dark:text-gray-200">Lancer le vote des validateurs</span>
            </button>

            {/* Débloquer les fonds */}
            <button
              onClick={() => navigate(`/events/${event.id}/payout-request`)}
              className="w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.833 19.3359C19.833 20.7166 18.7137 21.8359 17.333 21.8359C15.9522 21.8359 14.833 20.7166 14.833 19.3359C14.833 17.9552 15.9522 16.8359 17.333 16.8359C18.7137 16.8359 19.833 17.9552 19.833 19.3359Z" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.3333 13.2247C12.2139 13.2194 10.893 13.0933 9.21123 12.7596C8.25404 12.5696 7.33325 13.2813 7.33325 14.2571V24.2742C7.33325 24.9625 7.8059 25.567 8.47805 25.7152C15.4429 27.2511 16.5824 25.4454 21.3333 25.4454C22.844 25.4454 24.0694 25.588 25.0095 25.7655C26.1052 25.9725 27.3333 25.1334 27.3333 24.0183V14.2435C27.3333 13.6753 27.0089 13.161 26.4662 12.9928C25.6561 12.7417 24.2785 12.4226 22.3333 12.3379" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.33325 16.336C9.28458 16.336 11.0381 14.741 11.2623 13.0901M23.8338 12.8359C23.8338 14.8756 25.5988 16.805 27.3333 16.805M27.3333 22.336C25.4342 22.336 23.5934 23.6462 23.4353 25.4343M11.3337 25.8321C11.3337 23.6229 9.54288 21.8321 7.33374 21.8321" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-medium text-[12px] text-[#1B1818] dark:text-gray-200">Débloquer les fonds</span>
            </button>

            {/* Clôturer la cagnotte */}
            <button
              onClick={() => {/* TODO close pot */}}
              className="w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.3333 16.1667H11.6667C10.6541 16.1667 9.83333 16.9874 9.83333 18V24.5C9.83333 25.5126 10.6541 26.3333 11.6667 26.3333H23.3333C24.3459 26.3333 25.1667 25.5126 25.1667 24.5V18C25.1667 16.9874 24.3459 16.1667 23.3333 16.1667Z" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.5 16.1667V13.4167C13.5 12.2006 13.9829 11.0337 14.8424 10.1742C15.7019 9.31473 16.8688 8.83337 18.0848 8.83337C19.3009 8.83337 20.4677 9.31473 21.3272 10.1742C22.1868 11.0337 22.6681 12.2006 22.6681 13.4167V16.1667" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="17.5" cy="21.5" r="1.5" fill="#737373"/>
              </svg>
              <span className="font-medium text-[12px] text-[#1B1818] dark:text-gray-200">Clôturer la cagnotte</span>
            </button>
          </>
        )}
      </div>

      {/* ── Sections dépliables ── */}
      <div className="flex flex-col gap-3 mt-2">
        {/* Participations */}
        <div className="border border-[#E7E4E4] dark:border-gray-800 rounded-[10px] bg-white dark:bg-[#1A1A1A]">
          <div 
            onClick={() => setExpandedSection(expandedSection === 'participations' ? null : 'participations')}
            className="flex items-center px-3 py-4 gap-3 cursor-pointer"
          >
            <div className="w-[34.67px] h-[34.67px] bg-[#FFF2D3] rounded-[5.33px] flex items-center justify-center shrink-0">
               <svg width="24" height="24" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.8333 9.042C13.527 8.9082 13.1888 8.83398 12.8333 8.83398C11.4525 8.83398 10.3333 9.95327 10.3333 11.334C10.3333 12.1518 10.7259 12.8779 11.333 13.334" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.70825 21.8348C7.94886 21.8348 7.33325 21.1936 7.33325 20.4025C7.33325 18.7933 8.99969 17.184 11.8333 16.875" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.8333 9.042C21.1395 8.90821 21.4777 8.83398 21.8333 8.83398C23.214 8.83398 24.3333 9.95327 24.3333 11.334C24.3333 12.1518 23.9406 12.8779 23.3335 13.334" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M25.9581 21.8328C26.7175 21.8328 27.3331 21.1915 27.3331 20.4005C27.3331 18.7913 25.6667 17.1821 22.8333 16.873" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17.3333 16.834C18.9901 16.834 20.3333 15.4908 20.3333 13.834C20.3333 12.1771 18.9901 10.834 17.3333 10.834C15.6764 10.834 14.3333 12.1771 14.3333 13.834C14.3333 15.4908 15.6764 16.834 17.3333 16.834Z" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17.3332 19.834C13.5833 19.834 11.3333 21.9769 11.3333 24.1197C11.3333 25.0665 12.0048 25.834 12.8333 25.834H21.8332C22.6616 25.834 23.3332 25.0665 23.3332 24.1197C23.3332 21.9769 21.0832 19.834 17.3332 19.834Z" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
               </svg>
            </div>
            <span className="font-medium text-[16px] text-[#404040] dark:text-white flex-1">Participations</span>
          </div>
          {expandedSection === 'participations' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => navigate(`/events/${event.id}/pay?type=contribution`)} className="w-full h-9 mb-4 mt-4 border border-[#FF7A00] text-[#FF7A00] rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                Contribuer à nouveau
              </button>
              <div className="flex flex-col gap-3">
                {contributions.slice(0, 5).map(c => (
                  <div key={c.userId} className="flex justify-between items-center text-[13px]">
                    <div className="flex items-center gap-2">
                      {c.user?.profile?.avatarUrl ? (
                        <SafeImage src={c.user.profile.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <UserAvatarIcon size={24} className="shrink-0" />
                      )}
                      <span className="text-gray-800 dark:text-gray-200">{c.user?.profile?.displayName || 'Anonyme'}</span>
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
                    Vous avez délégué votre part à {attendees.find(x => x.userId === attendees.find(a => a.userId === user.id)?.delegatedToId)?.user?.profile?.displayName || 'un validateur'}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500">Aucun historique de validation.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Validateurs */}
        <div className="border border-[#E7E4E4] dark:border-gray-800 rounded-[10px] bg-white dark:bg-[#1A1A1A]">
          <div 
            onClick={() => setExpandedSection(expandedSection === 'validators' ? null : 'validators')}
            className="flex items-center px-3 py-4 gap-3 cursor-pointer"
          >
            <div className="w-[34.67px] h-[34.67px] bg-[#FFF2D3] rounded-[5.33px] flex items-center justify-center shrink-0">
               <svg width="24" height="24" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.6416 9.71792C21.0506 9.71792 20.755 9.71792 20.4858 9.61803C20.4484 9.60415 20.4116 9.58889 20.3753 9.57226C20.1143 9.45253 19.9054 9.24357 19.4874 8.82565C18.5255 7.86375 18.0446 7.3828 17.4528 7.33845C17.3733 7.33249 17.2933 7.33249 17.2138 7.33845C16.622 7.3828 16.141 7.86375 15.1791 8.82564C14.7612 9.24357 14.5522 9.45253 14.2912 9.57226C14.255 9.58889 14.2181 9.60415 14.1807 9.61803C13.9115 9.71792 13.616 9.71792 13.025 9.71792H12.9159C11.408 9.71792 10.6541 9.71792 10.1856 10.1864C9.71719 10.6548 9.71719 11.4088 9.71719 12.9167V13.0257C9.71719 13.6167 9.71719 13.9122 9.6173 14.1815C9.60342 14.2188 9.58816 14.2557 9.57153 14.292C9.4518 14.553 9.24284 14.7619 8.82491 15.1798C7.86302 16.1417 7.38207 16.6227 7.33772 17.2145C7.33176 17.294 7.33176 17.374 7.33772 17.4535C7.38207 18.0453 7.86302 18.5262 8.82491 19.4881C9.24284 19.9061 9.4518 20.115 9.57153 20.376C9.58816 20.4123 9.60342 20.4491 9.6173 20.4865C9.71719 20.7557 9.71719 21.0513 9.71719 21.6423V21.7513C9.71719 23.2592 9.71719 24.0132 10.1856 24.4816C10.6541 24.9501 11.408 24.9501 12.9159 24.9501H13.025C13.616 24.9501 13.9115 24.9501 14.1807 25.0499C14.2181 25.0638 14.255 25.0791 14.2912 25.0957C14.5522 25.2155 14.7612 25.4244 15.1791 25.8423C16.141 26.8042 16.622 27.2852 17.2138 27.3295C17.2933 27.3355 17.3733 27.3355 17.4528 27.3295C18.0446 27.2852 18.5255 26.8042 19.4874 25.8423C19.9054 25.4244 20.1143 25.2155 20.3753 25.0957C20.4116 25.0791 20.4484 25.0638 20.4858 25.0499C20.755 24.9501 21.0506 24.9501 21.6416 24.9501H21.7505C23.2584 24.9501 24.0125 24.9501 24.4809 24.4816C24.9494 24.0132 24.9494 23.2592 24.9494 21.7513V21.6423C24.9494 21.0513 24.9494 20.7557 25.0492 20.4865C25.0631 20.4491 25.0783 20.4123 25.0949 20.376C25.2147 20.115 25.4237 19.9061 25.8416 19.4881C26.8035 18.5262 27.2845 18.0453 27.3288 17.4535C27.3348 17.374 27.3348 17.294 27.3288 17.2145C27.2845 16.6227 26.8035 16.1417 25.8416 15.1798C25.4237 14.7619 25.2147 14.553 25.0949 14.292C25.0783 14.2557 25.0631 14.2188 25.0492 14.1815C24.9494 13.9122 24.9494 13.6167 24.9494 13.0257V12.9167C24.9494 11.4088 24.9494 10.6548 24.4809 10.1864C24.0125 9.71792 23.2584 9.71792 21.7505 9.71792H21.6416Z" stroke="#FF7A00" strokeWidth="1.5"/>
                  <path d="M13.8333 21.832C14.5319 20.6243 15.8377 19.8117 17.3333 19.8117C18.8289 19.8117 20.1347 20.6243 20.8333 21.832M19.3333 15.332C19.3333 16.4366 18.4379 17.332 17.3333 17.332C16.2288 17.332 15.3333 16.4366 15.3333 15.332C15.3333 14.2275 16.2288 13.332 17.3333 13.332C18.4379 13.332 19.3333 14.2275 19.3333 15.332Z" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round"/>
               </svg>
            </div>
            <span className="font-medium text-[16px] text-[#404040] dark:text-white flex-1">Validateurs</span>
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
        </div>

        {/* Retraits */}
        <div className="border border-[#E7E4E4] dark:border-gray-800 rounded-[10px] bg-white dark:bg-[#1A1A1A]">
          <div 
            onClick={() => setExpandedSection(expandedSection === 'payouts' ? null : 'payouts')}
            className="flex items-center px-3 py-4 gap-3 cursor-pointer"
          >
            <div className="w-[34.67px] h-[34.67px] bg-[#FFF2D3] rounded-[5.33px] flex items-center justify-center shrink-0">
               <svg width="24" height="24" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.833 19.3359C19.833 20.7166 18.7137 21.8359 17.333 21.8359C15.9522 21.8359 14.833 20.7166 14.833 19.3359C14.833 17.9552 15.9522 16.8359 17.333 16.8359C18.7137 16.8359 19.833 17.9552 19.833 19.3359Z" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.3333 13.2247C12.2139 13.2194 10.893 13.0933 9.21123 12.7596C8.25404 12.5696 7.33325 13.2813 7.33325 14.2571V24.2742C7.33325 24.9625 7.8059 25.567 8.47805 25.7152C15.4429 27.2511 16.5824 25.4454 21.3333 25.4454C22.844 25.4454 24.0694 25.588 25.0095 25.7655C26.1052 25.9725 27.3333 25.1334 27.3333 24.0183V14.2435C27.3333 13.6753 27.0089 13.161 26.4662 12.9928C25.6561 12.7417 24.2785 12.4226 22.3333 12.3379" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7.33325 16.336C9.28458 16.336 11.0381 14.741 11.2623 13.0901M23.8338 12.8359C23.8338 14.8756 25.5988 16.805 27.3333 16.805M27.3333 22.336C25.4342 22.336 23.5934 23.6462 23.4353 25.4343M11.3337 25.8321C11.3337 23.6229 9.54288 21.8321 7.33374 21.8321" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14.8333 10.8359C14.8333 10.8359 16.6331 8.33594 17.3333 8.33594M17.3333 8.33594C18.0335 8.33594 19.8333 10.8359 19.8333 10.8359M17.3333 8.33594V13.8359" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
               </svg>
            </div>
            <span className="font-medium text-[16px] text-[#404040] dark:text-white flex-1">Retraits</span>
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
