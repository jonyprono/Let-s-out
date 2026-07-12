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
        {activeTab === 'participants' && <TabParticipants event={event} bookings={bookings?.data || []} />}
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
function TabParticipants({ bookings }: { event: any, bookings: any[] }) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const navigate = useNavigate();

  const participants = bookings.filter(b => b.status === 'CONFIRMED').map(b => b.user);

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
              onClick={() => setSelectedUser(user)}
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
            onClick={() => {
              const url = `${window.location.origin}/events/${event.id}`;
              if (navigator.share) {
                navigator.share({ title: event.title, url }).catch(console.error);
              } else {
                navigator.clipboard.writeText(url);
                toast.success('Lien copié dans le presse-papier');
              }
            }}
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

      {/* Bottom sheet: participant detail */}
      <BottomSheet open={!!selectedUser} onClose={() => setSelectedUser(null)}>
        {selectedUser && (
          <div className="w-full flex flex-col items-center pt-2 pb-8 px-5">
            <div className="mb-3">
              {selectedUser.profile?.avatarUrl ? (
                <SafeImage
                  src={selectedUser.profile.avatarUrl}
                  alt={selectedUser.profile?.displayName || ''}
                  className="w-20 h-20 rounded-full border-4 border-white shadow-sm object-cover"
                />
              ) : (
                <UserAvatarIcon size={80} />
              )}
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-4">
              {selectedUser.profile?.displayName || selectedUser.profile?.username}
            </h3>
            <PrimaryButton
              onClick={() => navigate(`/profile/${selectedUser.profile?.username || selectedUser.id}`)}
              className="max-w-[200px]"
            >
              Voir le profil
            </PrimaryButton>
          </div>
        )}
      </BottomSheet>
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
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-[24px] font-extrabold text-gray-900 dark:text-white leading-tight">
            {collected.toLocaleString('fr-FR')} F
          </p>
          <p className="text-[13px] text-gray-500 mt-0.5">
            sur {event.poolTarget?.toLocaleString('fr-FR')} F CFA
          </p>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-3 overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-[#FF7A00] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-[10px] font-bold text-white bg-[#FF7A00] rounded px-1.5 py-0.5 leading-none">{pct}%</span>
          </div>
        </div>

        {!isPastDeadline && (
          <PrimaryButton 
            onClick={() => navigate(`/events/${event.id}/pay?type=contribution`)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            Contribuer à la cagnotte
          </PrimaryButton>
        )}

        {isPastDeadline && (
          <PrimaryButton
            onClick={() => toast.success("Demande de déblocage envoyée")}
            disabled={event.poolReleased}
            className="bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            Débloquer les fonds
          </PrimaryButton>
        )}

        {(!isPastDeadline && !event.poolReleased) && (
          <PrimaryButton
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending}
            className="bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Clôturer la cagnotte
          </PrimaryButton>
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
        <g opacity="0.2">
        <path d="M94.3668 23.0586L98.0348 29.1796C97.94 29.3061 97.8361 29.428 97.7322 29.5545L93.9783 23.2935L94.3668 23.0586Z" fill="black"/>
        </g>
        <path d="M91.9827 31.9553C97.251 27.8747 100.22 22.8863 98.6144 20.8133C97.0088 18.7403 91.4364 20.3678 86.1681 24.4484C80.8999 28.529 77.9308 33.5174 79.5364 35.5904C81.1421 37.6633 86.7145 36.0359 91.9827 31.9553Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M91.3293 30.6985C95.4989 27.4688 97.9589 23.6627 96.8238 22.1972C95.6887 20.7317 91.3883 22.1619 87.2187 25.3915C83.0491 28.6211 80.5891 32.4273 81.7242 33.8927C82.8593 35.3582 87.1597 33.9281 91.3293 30.6985Z" fill="white"/>
        <path d="M78.2716 12.845C77.7566 15.8174 71.089 17.0732 63.536 15.718C55.9831 14.3628 50.2867 10.8709 50.8152 7.89853C50.9372 7.20738 51.1495 4.69123 51.8587 4.18981C54.2032 2.53647 59.6511 3.91877 65.4514 4.94872C70.8722 5.91091 76.8034 5.9877 78.2716 8.48578C79.1615 10.0217 78.4206 11.9957 78.2716 12.845Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M78.2716 8.49079C79.1751 10.5417 78.4569 11.7659 78.2716 12.8319C78.0864 13.898 77.052 14.7879 75.4619 15.3752C75.2676 15.452 75.0643 15.5152 74.8565 15.5785C73.6128 15.9281 72.3341 16.1386 71.0439 16.2064C70.8587 16.2064 70.678 16.2064 70.4883 16.238C68.9684 16.2939 67.4465 16.238 65.9348 16.0709L65.4063 16.0031C64.7965 15.9263 64.1685 15.836 63.5406 15.723C62.9127 15.6101 62.3029 15.4836 61.7021 15.3436C61.5304 15.3074 61.3588 15.2623 61.1871 15.2216C59.7679 14.8712 58.3759 14.4182 57.0221 13.8664C56.855 13.8032 56.6969 13.7309 56.5388 13.6677C55.3506 13.1619 54.2232 12.524 53.1779 11.7659C53.0198 11.6529 52.8752 11.54 52.7262 11.4225C51.3258 10.2797 50.6075 9.05094 50.8108 7.90806C50.9463 7.16722 51.0547 4.74593 51.8498 4.19933C52.6448 3.65274 53.7832 3.48108 55.1384 3.47656H55.6805C58.3909 3.56691 61.8828 4.3213 65.447 4.95373C69.6481 5.7036 74.5674 6.35862 77.2146 7.77706C77.3699 7.85935 77.5206 7.94982 77.6663 8.0481C77.8793 8.17967 78.0817 8.32769 78.2716 8.49079Z" fill="black"/>
        <g opacity="0.2">
        <path d="M55.8294 3.01528L55.6848 3.4896L53.1732 11.7744C53.0151 11.6614 52.8705 11.5485 52.7214 11.4311L55.1337 3.48508L55.3234 2.86621L55.8294 3.01528Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M59.606 5.32803L57.0175 13.8613C56.8504 13.798 56.6923 13.7257 56.5342 13.6625L59.1091 5.16992L59.606 5.32803Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M68.383 8.0032L65.9301 16.0847L65.4016 16.0169L67.8816 7.84961L68.383 8.0032Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M64.3038 6.76516L61.6973 15.3481C61.5257 15.3119 61.354 15.2668 61.1824 15.2261L63.8024 6.60254L64.3038 6.76516Z" fill="black"/>
        </g>
        <g opacity="0.2">
        <path d="M73.4289 8.35512L71.0393 16.2198C70.8541 16.2198 70.6734 16.2198 70.4836 16.2514L72.9275 8.20605L73.4289 8.35512Z" fill="black"/>
        </g>
        <path d="M78.6233 10.25C79.1522 7.27795 73.456 3.77869 65.9005 2.43422C58.3451 1.08975 51.7914 2.40918 51.2625 5.38127C50.7337 8.35335 56.4298 11.8526 63.9853 13.1971C71.5408 14.5416 78.0944 13.2221 78.6233 10.25Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M76.052 9.79611C76.4257 7.696 71.8821 5.1311 65.9035 4.06723C59.925 3.00337 54.7755 3.84341 54.4018 5.94351C54.028 8.04362 58.5717 10.6085 64.5502 11.6724C70.5288 12.7363 75.6783 11.8962 76.052 9.79611Z" fill="white"/>
        <path d="M117.708 88.7323L71.2202 91.4427C69.578 91.5394 67.9667 91.9312 66.4634 92.5992L15.9687 115.186C15.0828 115.575 14.3572 116.257 13.9133 117.117C13.4693 117.977 13.3338 118.963 13.5294 119.911L21.8729 159.37C22.0139 160.005 22.2984 160.6 22.7046 161.109C23.1107 161.617 23.6278 162.026 24.2163 162.304C24.8048 162.582 25.449 162.722 26.0999 162.713C26.7507 162.704 27.3908 162.546 27.9713 162.252L77.8109 137.37L123.833 135.83C124.4 135.815 124.956 135.679 125.466 135.432C125.976 135.185 126.427 134.832 126.79 134.397C127.153 133.962 127.419 133.455 127.571 132.909C127.722 132.363 127.755 131.791 127.669 131.231L121.512 93.4484C121.191 91.497 119.709 88.6736 117.708 88.7323Z" fill="#FF7A00"/>
        <path opacity="0.1" d="M117.708 88.7323L71.2202 91.4427C69.578 91.5394 67.9667 91.9312 66.4634 92.5992L15.9687 115.186C15.0828 115.575 14.3572 116.257 13.9133 117.117C13.4693 117.977 13.3338 118.963 13.5294 119.911L21.8729 159.37C22.0139 160.005 22.2984 160.6 22.7046 161.109C23.1107 161.617 23.6278 162.026 24.2163 162.304C24.8048 162.582 25.449 162.722 26.0999 162.713C26.7507 162.704 27.3908 162.546 27.9713 162.252L77.8109 137.37L123.833 135.83C124.4 135.815 124.956 135.679 125.466 135.432C125.976 135.185 126.427 134.832 126.79 134.397C127.153 133.962 127.419 133.455 127.571 132.909C127.722 132.363 127.755 131.791 127.669 131.231L121.512 93.4484C121.191 91.497 119.709 88.6736 117.708 88.7323Z" fill="black"/>
        <path d="M24.3975 63.0399L0.00146484 85.5283L43.7811 133.022L68.1772 110.533L24.3975 63.0399Z" fill="#FF7A00"/>
        <path opacity="0.5" d="M68.171 110.538L43.7729 133.025L0 85.5347L16.0094 70.7766L24.3981 63.043L25.7939 64.5608L68.171 110.538Z" fill="#FAFAFA"/>
        <path d="M24.5542 65.9431L3.02783 85.7861L43.9785 130.211L65.5048 110.367L24.5542 65.9431Z" stroke="#FF7A00" strokeWidth="0.451733" strokeMiterlimit="10"/>
        <path d="M39.11 103.336C41.5791 101.06 41.2668 96.705 38.4125 93.6086C35.5582 90.5121 31.2427 89.847 28.7737 92.1231C26.3046 94.3991 26.6169 98.7543 29.4712 101.851C32.3255 104.947 36.641 105.612 39.11 103.336Z" fill="#FF7A00"/>
        <path opacity="0.1" d="M43.5153 113.75L34.8465 116.745L16.0093 70.7766L24.398 63.043L25.7938 64.5608L43.5153 113.75Z" fill="black"/>
        <path d="M45.2043 44.4331L14.0117 55.7432L36.0297 116.468L67.2224 105.158L45.2043 44.4331Z" fill="#FF7A00"/>
        <path opacity="0.5" d="M45.2043 44.4331L14.0117 55.7432L36.0297 116.468L67.2224 105.158L45.2043 44.4331Z" fill="#FAFAFA"/>
        <path d="M44.2238 47.1717L16.7004 57.1514L37.2957 113.952L64.8191 103.972L44.2238 47.1717Z" stroke="#FF7A00" strokeWidth="0.451733" strokeMiterlimit="10"/>
        <path d="M43.1996 87.2811C46.3565 86.1365 47.752 81.999 46.3165 78.04C44.881 74.0809 41.158 71.7993 38.0011 72.944C34.8441 74.0887 33.4486 78.2261 34.8841 82.1852C36.3197 86.1443 40.0426 88.4258 43.1996 87.2811Z" fill="#FF7A00"/>
        <path d="M118.011 90.3367L72.1598 92.9206C70.5344 93.0097 68.9398 93.4003 67.4573 94.0725L17.7034 116.533C16.8271 116.929 16.1121 117.612 15.6768 118.47C15.2414 119.327 15.1118 120.308 15.3092 121.249L23.6527 160.726C23.7871 161.357 24.0645 161.949 24.4635 162.457C24.8626 162.965 25.3727 163.374 25.9546 163.654C26.5366 163.933 27.1749 164.076 27.8205 164.07C28.4661 164.064 29.1018 163.911 29.6789 163.621L78.7822 138.88L124.172 137.443C124.734 137.426 125.286 137.288 125.79 137.04C126.295 136.792 126.741 136.44 127.098 136.006C127.456 135.572 127.717 135.066 127.863 134.524C128.01 133.981 128.039 133.413 127.949 132.858L121.774 95.0799C121.453 93.1103 119.989 90.2825 118.011 90.3367Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M74.0254 99.8315L113.367 97.4102" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
        <path opacity="0.2" d="M69.3137 100.848L76.5008 133.86" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
        <path opacity="0.2" d="M21.394 130.653L26.4625 156.045C26.4625 156.045 30.3474 145.972 21.394 130.653Z" fill="#FAFAFA"/>
        <path opacity="0.2" d="M22.0581 130.951C22.2343 131.403 67.0778 112.159 67.0778 112.159C67.1993 116.522 66.1084 120.833 63.9265 124.613C61.7446 128.393 58.5571 131.494 54.7184 133.571C41.2206 141.138 22.0581 130.951 22.0581 130.951Z" fill="#FAFAFA"/>
        <path d="M51.8453 131.701C52.9181 131.701 53.7877 130.832 53.7877 129.759C53.7877 128.686 52.9181 127.816 51.8453 127.816C50.7725 127.816 49.9028 128.686 49.9028 129.759C49.9028 130.832 50.7725 131.701 51.8453 131.701Z" fill="#FF7A00"/>
        <path opacity="0.2" d="M67.1003 112.159C67.1003 112.159 72.6612 120.53 71.315 134.786L67.1003 112.159Z" fill="black"/>
        <g opacity="0.2">
        <path d="M19.2483 120.679L20.2828 120.223" stroke="#FAFAFA" strokeWidth="0.451733" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22.4285 119.275L64.3041 100.763" stroke="#FAFAFA" strokeWidth="0.451733" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.35 2.35"/>
        <path d="M65.3794 100.288L66.4093 99.832" stroke="#FAFAFA" strokeWidth="0.451733" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <path opacity="0.2" d="M75.3445 107.254L114.686 104.828" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
        <path opacity="0.2" d="M77.1152 116.51L116.457 114.084" stroke="black" strokeWidth="0.903465" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Aucune cagnotte ajoutée</h3>
      <p className="text-[14px] text-gray-500 text-center mb-6 max-w-[250px]">Ajoutez une cagnotte à l'événement pour mutualiser les frais.</p>

      <PrimaryButton onClick={() => setStep('form')} className="max-w-xs">
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
