import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft01Icon } from 'hugeicons-react';
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

export function ManageEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'cagnotte'>('details');
  const [cagnotteStep, setCagnotteStep] = useState<'empty' | 'form' | 'summary' | 'success'>('empty');

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
        {activeTab === 'participants' && <TabParticipants event={event} attendees={attendeesData?.data || []} />}
        {activeTab === 'cagnotte' && <TabCagnotteInline event={event} setStep={setCagnotteStep} />}
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
function TabParticipants({ event, attendees }: { event: any, attendees: any[] }) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const navigate = useNavigate();
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
function TabCagnotteInline({ event, setStep }: { event: any, setStep: (s: any) => void }) {
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

  if (hasPot) {
    const isPastDeadline = event.registrationDeadline 
      ? new Date() > new Date(event.registrationDeadline) 
      : new Date() > new Date(event.startAt);

    const collected = event.poolCollected ?? 0;
    const pct = event.poolTarget ? Math.min(100, Math.round((collected / event.poolTarget) * 100)) : 0;
    const isFull = pct >= 100;
    const progressColorClass = isFull ? "bg-[#0CAF60]" : "bg-[#FF7A00]";
    const bgClass = isFull ? "bg-[#F0FDF4] dark:bg-[#102a1c] border-green-100 dark:border-green-900" : "bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-gray-800";

    return (
      <div className="flex flex-col gap-3">
        <div className={`rounded-[12px] p-4 shadow-sm border ${bgClass}`}>
          <p className="text-[14px] text-gray-500 mb-1">
            {isFull ? "Solde disponible" : "Cagnotte"}
          </p>
          <p className="text-[20px] font-bold text-gray-900 dark:text-white leading-tight">
            {collected.toLocaleString('fr-FR')} F CFA
          </p>
          {!isFull && (
            <p className="text-[13px] text-gray-500 mt-0.5">
              sur {event.poolTarget?.toLocaleString('fr-FR')} F CFA
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
              <div className={`absolute top-0 left-0 h-full rounded-full transition-all ${progressColorClass}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-[10px] font-bold text-white rounded px-1.5 py-0.5 leading-none ${progressColorClass}`}>{pct}%</span>
          </div>
        </div>

        {!isPastDeadline && (
          <button 
            onClick={() => navigate(`/events/${event.id}/pay?type=contribution`)}
            className="flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] active:scale-95 transition-transform text-[14px] font-medium text-gray-900 dark:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.68091 11.666C3.51388 11.666 4.99981 13.1519 4.99981 14.9849" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.99981 3.34766C4.99981 5.18063 3.51388 6.66656 1.68091 6.66656" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 3.34766C15 5.16459 16.4742 6.64051 18.2853 6.66621" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.3333 10.834V8.33398C18.3333 5.97696 18.3333 4.79845 17.6011 4.06622C16.8688 3.33398 15.6903 3.33398 13.3333 3.33398H6.66666C4.30964 3.33398 3.13113 3.33398 2.3989 4.06622C1.66666 4.79845 1.66666 5.97696 1.66666 8.33398V10.0007C1.66666 12.3577 1.66666 13.5362 2.3989 14.2684C3.13113 15.0007 4.30964 15.0007 6.66666 15.0007H10.8333" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.5 9.16602C12.5 10.5468 11.3807 11.666 10 11.666C8.61925 11.666 7.5 10.5468 7.5 9.16602C7.5 7.78531 8.61925 6.66602 10 6.66602C11.3807 6.66602 12.5 7.78531 12.5 9.16602Z" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.8333 11.666V16.666M13.3333 14.166H18.3333" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Déposer une contribution
          </button>
        )}

        {isPastDeadline && (
          <button
            onClick={() => toast.success("Demande de déblocage envoyée")}
            disabled={event.poolReleased}
            className="flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] active:scale-95 transition-transform text-[14px] font-medium text-gray-900 dark:text-white disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.68091 14.582C3.51388 14.582 4.99981 16.0679 4.99981 17.9009" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 17.9009V17.8243C15 16.0336 16.4517 14.582 18.2423 14.582" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.99981 6.26367C4.99981 8.09665 3.51388 9.58259 1.68091 9.58259" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 6.26367C15 8.08061 16.4742 9.55651 18.2853 9.58226" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.1667 6.25C15.9792 6.26008 16.9607 6.34046 17.6011 6.98078C18.3333 7.71302 18.3333 8.89152 18.3333 11.2485V12.9152C18.3333 15.2723 18.3333 16.4508 17.6011 17.183C16.8688 17.9152 15.6903 17.9152 13.3333 17.9152H6.66666C4.30964 17.9152 3.13113 17.9152 2.3989 17.183C1.66666 16.4508 1.66666 15.2723 1.66666 12.9152V11.2485C1.66666 8.89152 1.66666 7.71302 2.3989 6.98078C3.03921 6.34046 4.02081 6.26008 5.83333 6.25" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.5 12.082C12.5 13.4627 11.3807 14.582 10 14.582C8.61925 14.582 7.5 13.4627 7.5 12.082C7.5 10.7013 8.61925 9.58203 10 9.58203C11.3807 9.58203 12.5 10.7013 12.5 12.082Z" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.91666 4.16732C7.91666 4.16732 9.4165 2.08398 10 2.08398C10.5835 2.08398 12.0833 4.16732 12.0833 4.16732M10 6.66732V2.50065" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Débloquer les fonds
          </button>
        )}

        {(!isPastDeadline && !event.poolReleased) && (
          <button
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending}
            className="flex flex-row justify-center items-center p-[10px_16px] gap-[8px] w-full h-[40px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-gray-700 rounded-[8px] active:scale-95 transition-transform text-[14px] font-medium text-gray-900 dark:text-white disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.7467 7.49935V5.41602C13.7467 3.34495 12.0678 1.66602 9.99674 1.66602C7.92568 1.66602 6.24674 3.34495 6.24674 5.41602V7.49935" stroke="#737373" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11.2462 7.5H8.74674C6.80106 7.5 5.82822 7.5 5.09182 7.89364C4.51037 8.20446 4.03414 8.68075 3.72339 9.26217C3.32981 9.99867 3.3299 10.9715 3.33009 12.9172C3.33026 14.8625 3.33035 15.8352 3.72397 16.5715C4.03477 17.1529 4.51097 17.629 5.09237 17.9398C5.8287 18.3333 6.80139 18.3333 8.74674 18.3333H11.2462C13.1917 18.3333 14.1646 18.3333 14.9009 17.9398C15.4823 17.629 15.9586 17.1527 16.2693 16.5713C16.6629 15.8349 16.6629 14.8622 16.6629 12.9167C16.6629 10.9712 16.6629 9.99842 16.2693 9.262C15.9586 8.68058 15.4823 8.20438 14.9009 7.89359C14.1646 7.5 13.1917 7.5 11.2462 7.5Z" stroke="#737373" strokeWidth="1.25" strokeLinecap="round"/>
              <path d="M9.99674 14.5833C10.9172 14.5833 11.6634 13.8371 11.6634 12.9167C11.6634 11.9962 10.9172 11.25 9.99674 11.25C9.07627 11.25 8.33008 11.9962 8.33008 12.9167C8.33008 13.8371 9.07627 14.5833 9.99674 14.5833Z" stroke="#737373" strokeWidth="1.25"/>
            </svg>
            Clôturer la cagnotte
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <svg width="128" height="165" viewBox="0 0 128 165" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
        <path d="M68.9432 44.4843C67.9449 46.9101 62.0678 46.743 55.9107 44.2042C49.7536 41.6655 45.5661 37.6406 46.5644 35.2148C46.7993 34.6546 47.4678 32.5541 48.1364 32.2649C50.4312 31.2937 54.7995 33.4756 59.5291 35.4271C63.9335 37.234 68.9703 38.413 69.7518 40.8027C70.2216 42.2573 69.2278 43.7932 68.9432 44.4843Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M69.7519 40.8028C70.1268 42.7046 69.3001 43.6171 68.9433 44.4844C68.5864 45.3517 67.5429 45.9209 66.0838 46.1197C65.9014 46.1507 65.7174 46.1718 65.5327 46.1829C64.4138 46.2487 63.2911 46.1896 62.1853 46.0067C62.0272 46.0067 61.8691 45.957 61.7065 45.9299C60.4085 45.6969 59.1296 45.3678 57.8803 44.9452L57.4286 44.7916C56.9272 44.6154 56.4122 44.4212 55.8972 44.2088C55.3823 43.9965 54.8944 43.7571 54.411 43.5448L53.9954 43.346C52.8567 42.7829 51.7592 42.1398 50.7113 41.4216L50.3409 41.1596C49.4262 40.5131 48.5881 39.7644 47.8428 38.9281C47.7299 38.8016 47.626 38.6796 47.5266 38.5532C46.5554 37.3244 46.1714 36.1499 46.5554 35.2148C46.8084 34.614 47.3504 32.5587 48.1274 32.2605C49.0831 31.9913 50.0945 31.9913 51.0501 32.2605L51.5019 32.3689C53.7605 32.9471 56.6064 34.2346 59.5111 35.4317C62.9352 36.8456 66.9873 38.3137 68.9749 40.0077C69.0932 40.1073 69.2062 40.2128 69.3137 40.3239C69.4723 40.4716 69.6188 40.6317 69.7519 40.8028Z" fill="black"/>
        <g opacity="0.2">
        <path d="M51.7277 31.9805L51.5199 32.36L47.8519 38.9236C47.7389 38.7971 47.635 38.6752 47.5356 38.5487L51.0592 32.2515L51.3347 31.7637L51.7277 31.9805Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M54.5013 34.659L50.7203 41.435L50.3499 41.173L54.1083 34.4512L54.5013 34.659Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M61.4534 38.5441L57.8802 44.9452L57.4285 44.7916L61.0423 38.3047L61.4534 38.5441Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M58.2191 36.7375L54.42 43.5451L54.0044 43.3463L57.8261 36.498L58.2191 36.7375Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M65.6682 39.7815L62.1854 46.0064C62.0273 46.0064 61.8692 45.9567 61.7065 45.9296L65.2707 39.5557L65.6682 39.7815Z" fill="black"/>
        </g>
        <path d="M69.7248 42.3703C68.7265 44.7961 62.9217 44.7012 56.7601 42.158C50.5985 39.6147 46.4154 35.5943 47.4183 33.1685C48.4211 30.7427 54.2214 30.8421 60.383 33.3808C66.5446 35.9196 70.7232 39.9309 69.7248 42.3703Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M67.6287 41.4896C66.924 43.2017 62.3977 42.9623 57.5235 40.9521C52.6493 38.9418 49.2703 35.9197 49.975 34.2077C50.6797 32.4956 55.2061 32.735 60.0848 34.7452C64.9635 36.7555 68.338 39.7776 67.6287 41.4896Z" fill="white"/>
        <path d="M100.077 22.5573C101.685 24.6308 98.622 29.6495 93.3503 33.7286C88.0786 37.8078 82.5087 39.434 80.9051 37.3425C80.5347 36.8637 79.0349 35.26 79.1253 34.5101C79.4279 32.0392 83.489 29.3378 87.5365 26.2028C91.304 23.2846 94.823 19.4991 97.2849 20.0095C98.7801 20.3393 99.6204 21.97 100.077 22.5573Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M97.285 20.0283C99.1235 20.6517 99.503 21.8353 100.077 22.558C100.65 23.2808 100.628 24.4869 100.077 25.8557C100.013 26.0228 99.9366 26.19 99.8553 26.3616C99.3604 27.3659 98.7543 28.3114 98.0484 29.1804C97.9535 29.3069 97.8496 29.4289 97.7457 29.5554C96.8962 30.5686 95.9721 31.5168 94.9811 32.3922L94.6333 32.6949C94.2313 33.0427 93.8066 33.3906 93.3684 33.7294C92.9303 34.0682 92.4921 34.3889 92.0494 34.6916C91.9274 34.7819 91.7964 34.8677 91.6745 34.9536C90.619 35.6616 89.5139 36.2926 88.3678 36.8418C88.2277 36.9141 88.0922 36.9728 87.9612 37.0361C86.9428 37.5071 85.8745 37.8617 84.7765 38.0931C84.6139 38.1292 84.4558 38.1564 84.2977 38.1789C82.7482 38.4093 81.5376 38.1789 80.9187 37.3613C80.5212 36.8463 79.0079 35.3511 79.1389 34.5335C79.3752 33.5669 79.8775 32.6859 80.5889 31.9902C80.6883 31.8773 80.7967 31.7643 80.9097 31.6469C82.5404 29.9574 85.0656 28.146 87.5501 26.2261C90.4819 23.9674 93.7705 21.1712 96.2234 20.2948C96.3715 20.2405 96.5223 20.1937 96.6751 20.1548C96.8751 20.0978 97.0789 20.0555 97.285 20.0283Z" fill="black"/>
        <g opacity="0.2">
        <path d="M80.6703 31.2754L80.8962 31.6458L84.763 38.092C84.6004 38.1282 84.4423 38.1553 84.2842 38.1779L80.5755 31.9801L80.2864 31.5284L80.6703 31.2754Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M84.3699 30.2012L88.3542 36.8416C88.2142 36.9139 88.0787 36.9726 87.9477 37.0359L83.9814 30.4316L84.3699 30.2012Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M91.1956 26.1084L94.9676 32.3965L94.6197 32.6992L90.8071 26.3388L91.1956 26.1084Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M88.0244 28.0098L92.0357 34.6909C91.9138 34.7812 91.7828 34.8671 91.6608 34.9529L87.6313 28.2402L88.0244 28.0098Z" fill="black"/>
        </g>
        <path d="M91.9827 31.9553C97.251 27.8747 100.22 22.8863 98.6144 20.8133C97.0088 18.7403 91.4364 20.3678 86.1681 24.4484C80.8999 28.529 77.9308 33.5174 79.5364 35.5904C81.1421 37.6633 86.7145 36.0359 91.9827 31.9553Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M91.3293 30.6985C95.4989 27.4688 97.9589 23.6627 96.8238 22.1972C95.6887 20.7317 91.3883 22.1619 87.2187 25.3915C83.0491 28.6211 80.5891 32.4273 81.7242 33.8927C82.8593 35.3582 87.1597 33.9281 91.3293 30.6985Z" fill="white"/>
      </svg>

      <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Aucune cagnotte ajoutée</h3>
      <p className="text-[14px] text-gray-500 text-center mb-6 max-w-[250px]">Ajoutez une cagnotte à l'événement pour mutualiser les frais.</p>

      <PrimaryButton onClick={handleAddCagnotte} className="max-w-xs">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
        Ajouter une cagnotte
      </PrimaryButton>
    </div>
  );
}

function TabCagnotteNoData({ setStep }: { setStep: (s: 'form') => void }) {
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();

  const handleAddCagnotte = () => {
    if (userProfile?.kycStatus !== 'verified') {
      toast.error('Le profil doit être vérifié (KYC) pour ajouter une cagnotte.', {
        action: { label: 'Vérifier', onClick: () => navigate('/profile/kyc') }
      });
      return;
    }
    setStep('form');
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pt-12 pb-20">
      <svg width="129" height="165" viewBox="0 0 129 165" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
        <path d="M57.653 10.1554L56.9189 12.3925C56.637 13.2514 55.4526 13.3364 55.0506 12.5268L44.5714 8.52985L57.653 10.1554Z" fill="#FAFAFA"/>
        <path d="M78.2716 12.845C77.7566 15.8174 71.089 17.0732 63.536 15.718C55.9831 14.3628 50.2867 10.8709 50.8152 7.89853C50.9372 7.20738 51.1495 4.69123 51.8587 4.18981C54.2032 2.53647 59.6511 3.91877 65.4514 4.94872C70.8722 5.91091 76.8034 5.9877 78.2716 8.48578C79.1615 10.0217 78.4206 11.9957 78.2716 12.845Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M78.2716 8.49079C79.1751 10.5417 78.4569 11.7659 78.2716 12.8319C78.0864 13.898 77.052 14.7879 75.4619 15.3752C75.2676 15.452 75.0643 15.5152 74.8565 15.5785C73.6128 15.9281 72.3341 16.1386 71.0439 16.2064C70.8587 16.2064 70.678 16.2064 70.4883 16.238C68.9684 16.2939 67.4465 16.238 65.9348 16.0709L65.4063 16.0031C64.7965 15.9263 64.1685 15.836 63.5406 15.723C62.9127 15.6101 62.3029 15.4836 61.7021 15.3436C61.5304 15.3074 61.3588 15.2623 61.1871 15.2216C59.7679 14.8712 58.3759 14.4182 57.0221 13.8664C56.855 13.8032 56.6969 13.7309 56.5388 13.6677C55.3506 13.1619 54.2232 12.524 53.1779 11.7659C53.0198 11.6529 52.8752 11.54 52.7262 11.4225C51.3258 10.2797 50.6075 9.05094 50.8108 7.90806C50.9463 7.16722 51.0547 4.74593 51.8498 4.19933C52.6448 3.65274 53.7832 3.48108 55.1384 3.47656H55.6805C58.3909 3.56691 61.8828 4.3213 65.447 4.95373C69.6481 5.7036 74.5674 6.35862 77.2146 7.77706C77.3699 7.85935 77.5206 7.94982 77.6663 8.0481C77.8793 8.17967 78.0817 8.32769 78.2716 8.49079Z" fill="black"/>
        <g opacity="0.2">
        <path d="M55.8294 3.01528L55.6848 3.4896L53.1732 11.7744C53.0151 11.6614 52.8705 11.5485 52.7214 11.4311L55.1337 3.48508L55.3234 2.86621L55.8294 3.01528Z" fill="black"/>
        </g>
      </svg>

      <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Aucune cagnotte ajoutée</h3>
      <p className="text-[14px] text-gray-500 text-center mb-6 max-w-[250px]">Ajoutez une cagnotte à l'événement pour mutualiser les frais.</p>

      <PrimaryButton onClick={handleAddCagnotte} className="max-w-xs">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
        Ajouter une cagnotte
      </PrimaryButton>
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
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
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
                <span className="font-semibold text-gray-900 dark:text-white leading-relaxed">{desc}</span>
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
