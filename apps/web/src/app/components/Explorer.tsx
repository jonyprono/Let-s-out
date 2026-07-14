import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Loader2, ChevronLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Search01Icon, Location01Icon, ArrowDown01Icon, SlidersHorizontalIcon, MapsIcon, ListViewIcon, QrCode01Icon, Cancel01Icon, Tick01Icon } from 'hugeicons-react';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { apiClient } from '@/lib/api-client';
import { hapticFeedback } from '@/lib/haptics';
import { EventCard } from '@/components/shared/EventCard';
import ExplorerMap from '@/app/components/ExplorerMap';
import { eventsApi, type Event } from '@/features/events/api';
import { useNotifications } from '@/features/notifications/api';
import PullToRefresh from 'react-simple-pull-to-refresh';

interface ExplorerProps {
  onNavigate: (screen: string, id?: string) => void;
}

// Filtres supprimés

/*
const CATEGORY_LABELS: Record<string, string> = {
  SPORT: 'Sport',
  CULTURE: 'Culture & Art',
  FOOD: 'Gastronomie',
  NIGHTLIFE: 'Soirées',
  TRAVEL: 'Voyages',
  GAMING: 'Gaming',
  WELLNESS: 'Bien-être',
  MUSIC: 'Musique',
  OTHER: 'Autre',
};

const CATEGORY_ICONS: Record<string, React.FC<any>> = {
  SPORT: Basketball01Icon,
  CULTURE: PaintBoardIcon,
  FOOD: Pizza01Icon,
  NIGHTLIFE: Moon01Icon,
  TRAVEL: Airplane01Icon,
  GAMING: GameIcon,
  WELLNESS: FavouriteIcon,
  MUSIC: MusicNote01Icon,
  OTHER: StarIcon,
};
*/

// Filter tabs matching Figma — fonctionnels
const filterTabs = [
  { id: 'tout',         label: 'Tout',         filter: null },
  { id: 'pour-vous',   label: 'Pour vous',    filter: 'recommended' },
  { id: 'en-ce-moment',label: 'En ce moment', filter: 'ongoing' },
  { id: 'ce-week-end', label: 'Ce week-end',  filter: 'weekend' },
];

type Screen = 'list' | 'filter' | 'search' | 'join';

export function Explorer({ onNavigate }: ExplorerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: notificationsData } = useNotifications();
  const [screen, setScreen] = useState<Screen>(() => {
    return location.search.includes('screen=filter') ? 'filter' : 'list';
  });

  // Wrapper pour passer en mode search et cacher la tab bar via l'URL
  const openSearch = () => {
    setScreen('search');
    navigate({ search: '?screen=search' }, { replace: true });
  };

  // Wrapper pour revenir à la liste et réafficher la tab bar
  const closeSearch = () => {
    setScreen('list');
    navigate({ search: '' }, { replace: true });
  };
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('tout');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [eventSearchFocused, setEventSearchFocused] = useState(false);



  // Historique des recherches (localStorage)
  const [recentCities, setRecentCities] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recentCities') || '[]');
    } catch {
      return [];
    }
  });

  const saveRecentCity = (city: string) => {
    setRecentCities(prev => {
      const updated = [city, ...prev.filter(c => c !== city)].slice(0, 5);
      localStorage.setItem('recentCities', JSON.stringify(updated));
      return updated;
    });
  };

  const [currentLocation, setCurrentLocation] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [events, setEvents] = useState<Event[]>([]);

  const fetchEvents = async () => {
    try {
      const res = await eventsApi.list({ limit: 500 });
      setEvents(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRefresh = async () => {
    await fetchEvents();
  };



  // ── FILTER SCREEN REMOVED ────────────────────────────────────────────────

  // ── SEARCH SCREEN ─────────────────────────────────────────────────────────
  if (screen === 'search') {
    const isSearching = mapSearch.length > 0;

    // Base de données locale de villes du Bénin
    const BENIN_CITIES = [
      'Abomey', 'Abomey-Calavi', 'Adjarra', 'Adjohun', 'Aguégués', 'Allada', 'Aplahoué', 'Avrankou',
      'Banikoara', 'Bantè', 'Bassila', 'Bembèrèkè', 'Bétérou', 'Bohicon', 'Bori', 'Boukoumbé',
      'Cotonou', 'Comè', 'Copargo', 'Covè',
      'Dassa-Zoumé', 'Djougou', 'Dogbo',
      'Gogounou', 'Grand-Popo',
      'Kandi', 'Kérou', 'Kétou', 'Kouandé',
      'Lokossa',
      'Malanville', 'Matéri', 'Natitingou', 'Ndali', 'Nikki',
      'Ouidah',
      'Parakou', 'Pobè', 'Porga', 'Porto-Novo',
      'Sakalou', 'Savalou', 'Savè', 'Ségbana',
      'Tanguiéta', 'Tchaourou', 'Toffo', 'Toucountouna',
      'Zagnanado', 'Za-Kpota', 'Zogbodomey'
    ].sort();

    // Filtre dès la 1ère lettre — contient plutôt que startsWith pour plus de souplesse
    const filteredCities = BENIN_CITIES.filter(c =>
      c.toLowerCase().includes(mapSearch.toLowerCase())
    );

    return (
      <div className="fixed inset-0 z-50 bg-[#FAFAFA] dark:bg-[#0a0a0b] flex flex-col pt-safe-6">
        {/* Barre de recherche */}
        <div className="px-[20px] py-[12px] shrink-0 flex items-center self-stretch box-border w-full min-w-0 bg-[#FAFAFA] dark:bg-[#0a0a0b]">
          <div className={`flex-1 flex items-center gap-[8px] rounded-[999px] px-[16px] h-[44px] bg-white dark:bg-[#1A1A1A] box-border shadow-sm min-w-0 border transition-colors ${
            isSearching ? 'border-[var(--brand-orange-500)]' : 'border-[var(--border-default)]'
          }`}>
            <Location01Icon className="w-[20px] h-[20px] text-[var(--color-icon-secondary)] shrink-0" strokeWidth={1.5} />
            <input
              autoFocus
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Rechercher une ville..."
              className="flex-1 text-[15px] outline-none bg-transparent text-[var(--color-text-primary)] font-poppins min-w-0"
            />
            {mapSearch.length > 0 ? (
              <button onClick={() => setMapSearch('')} className="p-1 shrink-0 flex items-center justify-center">
                <Cancel01Icon className="w-[18px] h-[18px] text-[var(--color-icon-secondary)]" strokeWidth={2} />
              </button>
            ) : (
              <button onClick={closeSearch} className="p-1 shrink-0 flex items-center justify-center">
                <Cancel01Icon className="w-[18px] h-[18px] text-[var(--color-icon-secondary)]" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Liste des résultats */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 0' }}>
          {!isSearching ? (
            // État vide — badge ville active + récents
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              {currentLocation && (
                <button
                  onClick={() => { /* clic sur la ville active = déjà sélectionnée, on ferme */ closeSearch(); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    backgroundColor: 'var(--brand-orange-500)', borderRadius: 999,
                    padding: '10px 16px', border: 'none', cursor: 'pointer',
                    marginBottom: 24
                  }}
                >
                  <Location01Icon style={{ width: 16, height: 16, color: 'white' }} strokeWidth={1.5} />
                  <span style={{ color: 'white', fontSize: 15, fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>{currentLocation}</span>
                  <Tick01Icon style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2.5} />
                </button>
              )}

              {recentCities.length > 0 && (
                <div style={{ width: '100%' }}>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'Poppins, sans-serif', fontWeight: 600, marginBottom: 8 }}>Récents</p>
                  {recentCities.map((city, idx) => (
                    <button
                      key={idx}
                      onClick={() => { saveRecentCity(city); setCurrentLocation(city); setMapSearch(''); closeSearch(); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                        gap: 12, padding: '14px 0', background: 'transparent', border: 'none',
                        borderBottom: '1px solid var(--border-default)',
                        cursor: 'pointer', textAlign: 'left'
                      }}
                    >
                      <Location01Icon style={{ width: 20, height: 20, color: 'var(--color-icon-secondary)', flexShrink: 0 }} strokeWidth={1.5} />
                      <span style={{ fontSize: 15, color: 'var(--color-text-primary)', fontFamily: 'Poppins, sans-serif' }}>{city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Suggestions d'autocomplétion (dès la 1ère lettre)
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              {filteredCities.map((city, idx) => (
                <button
                  key={idx}
                  onClick={() => { saveRecentCity(city); setCurrentLocation(city); setMapSearch(''); closeSearch(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                    gap: 12, padding: '14px 0', background: 'transparent', border: 'none',
                    borderBottom: '1px solid var(--border-default)',
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <Location01Icon style={{ width: 20, height: 20, color: 'var(--color-icon-secondary)', flexShrink: 0 }} strokeWidth={1.5} />
                  <span style={{ fontSize: 15, color: 'var(--color-text-primary)', fontFamily: 'Poppins, sans-serif' }}>{city}</span>
                </button>
              ))}
              {filteredCities.length === 0 && (
                <p style={{ width: '100%', textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary)', fontSize: 15, fontFamily: 'Poppins, sans-serif' }}>Aucune ville trouvée</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── JOIN PRIVATE EVENT SCREEN ────────────────────────────────────────────────
  if (screen === 'join') {
    return (
      <div className="w-full h-full bg-[#F8F7FF] dark:bg-[#111111] flex flex-col z-50 absolute inset-0">
        <div className="px-4 pt-safe-6 pb-3 flex items-center gap-150">
          <button onClick={() => setScreen('list')} className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm">
            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rejoindre</h2>
        </div>

        <div className="flex-1 px-4 pt-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-brand-orange-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Lock className="w-8 h-8 text-action-primary" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Événement Privé</h3>
          <p className="text-text-secondary text-center mb-10 text-[15px] leading-relaxed max-w-[280px]">
            Entrez le code d'accès partagé par l'organisateur pour rejoindre cet événement.
          </p>

          <div className="w-full bg-background-white rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-white/10 mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-150">Code d'accès</label>
            <input
              type="text"
              placeholder="Ex: a1b2c3d4"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#222222] border border-border-primary rounded-2xl px-5 py-200 text-center text-2xl tracking-widest font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:border-action-primary focus:ring-2 focus:ring-orange-200 transition-all uppercase"
            />
          </div>

          <button
            onClick={async () => {
              if (!joinCode.trim()) return;
              setIsJoining(true);
              try {
                const code = joinCode.trim().toUpperCase();
                const { data } = await apiClient.post(`/events/join-by-code/${code}`);
                setScreen('list');
                setJoinCode('');
                onNavigate('event-details', data.event?.id || data.eventId || data.id);
              } catch (e: any) {
                alert(e?.response?.data?.error || e?.response?.data?.message || 'Code invalide ou événement introuvable.');
              } finally {
                setIsJoining(false);
              }
            }}
            disabled={!joinCode || isJoining}
            className="w-full py-200 rounded-full font-bold text-white shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--action-primary), var(--action-primary))' }}
          >
            {isJoining ? <Loader2 className="w-6 h-6 animate-spin" /> : "Rejoindre l'événement"}
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN LIST SCREEN (Screen 1 & 4) ───────────────────────────────────────

  // Recherche d'événements : active dès 2 caractères ou si vide (= affiche tout)
  // + filtre de catégorie par onglet actif
  const now = new Date();
  const filteredEvents = events.filter(ev => {
    const searchLower = eventSearch.trim().toLowerCase();
    const searchActive = searchLower.length >= 2;
    const textMatch = !searchActive ||
      (ev.title?.toLowerCase() || '').includes(searchLower) ||
      (ev.city?.toLowerCase() || '').includes(searchLower) ||
      (ev.address?.toLowerCase() || '').includes(searchLower);
    const cityMatch = currentLocation
      ? (!ev.city || (ev.city || '').toLowerCase().trim() === currentLocation.toLowerCase().trim())
      : true;

    // Filtre par onglet actif
    const tab = filterTabs.find(t => t.id === selectedCategory);
    const tabFilter = tab?.filter;
    let tabMatch = true;
    if (tabFilter === 'ongoing') {
      // En ce moment : a commencé et pas encore terminé
      const start = ev.startAt ? new Date(ev.startAt) : null;
      const end = (ev as any).endAt ? new Date((ev as any).endAt) : null;
      tabMatch = !!start && start <= now && (!end || end >= now);
    } else if (tabFilter === 'weekend') {
      // Ce week-end : samedi ou dimanche prochain
      const start = ev.startAt ? new Date(ev.startAt) : null;
      if (start) {
        const day = new Date();
        const dayOfWeek = day.getDay(); // 0=dim, 6=sam
        const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
        const sat = new Date(day); sat.setDate(day.getDate() + daysToSat); sat.setHours(0,0,0,0);
        const sun = new Date(sat); sun.setDate(sat.getDate() + 1); sun.setHours(23,59,59,999);
        tabMatch = start >= sat && start <= sun;
      } else {
        tabMatch = false;
      }
    } else if (tabFilter === 'recommended') {
      // Pour vous : événements à venir seulement
      const start = ev.startAt ? new Date(ev.startAt) : null;
      tabMatch = !!start && start > now;
    }
    // tabFilter === null = 'Tout' : pas de filtre supplémentaire

    if (searchActive) return textMatch && tabMatch;
    return textMatch && cityMatch && tabMatch;
  });

  // Nombre de notifications non lues (directement depuis unreadCount renvoyé par l'API)
  const unreadNotifCount = notificationsData?.unreadCount ?? 0;

  const mapEvents = filteredEvents.map((ev, i) => ({
    id: ev.id,
    title: ev.title,
    city: ev.city || currentLocation,
    address: ev.address || '',
    latitude: ev.latitude || 6.36536 + (i * 0.002),
    longitude: ev.longitude || 2.41833 + (i * 0.002),
    startAt: ev.startAt,
    currentAttendees: ev.currentAttendees || 0,
    participationMode: ev.price === 0 ? 'Gratuit' : 'Payant',
    coverUrl: ev.coverUrl || ''
  })) as any[];

  return (
    <div className={`w-full h-full flex flex-col relative bg-background`}>

        {/* Header & Search Bar */}
        <div className={`px-4 pt-safe-6 pb-0 shrink-0 w-full min-w-0 box-border relative z-20 bg-[var(--color-background-primary)]`}>
          {/* Title + Notification */}
          <div className="flex items-center justify-between mb-2 mt-2 w-full min-w-0">
            <h1 className="text-[20px] font-bold font-poppins text-[var(--color-text-primary)] leading-tight">Explorez et découvrez</h1>
            <button onClick={() => onNavigate('notifications')} className="w-10 h-10 flex items-center justify-center -mr-2">
              <NotificationIconWithBadge unreadCount={unreadNotifCount} className="w-8 h-8 text-[var(--color-text-primary)]" />
            </button>
          </div>

          {/* Location */}
          <button onClick={openSearch} className="flex items-center gap-1 mb-3 active:opacity-70 transition-opacity max-w-full min-w-0">
            <Location01Icon className="w-[18px] h-[18px] text-[var(--color-icon-secondary)] shrink-0" strokeWidth={1.8} />
            <span className="text-[14px] font-poppins font-medium text-[var(--color-text-primary)] truncate flex-1 text-left min-w-0">{currentLocation || 'Où allez-vous ?'}</span>
            <ArrowDown01Icon className="w-[16px] h-[16px] text-[var(--color-icon-secondary)]" strokeWidth={2} />
          </button>

          {/* Search bar */}
          <div className="flex items-center gap-[10px] mb-3 w-full min-w-0 box-border">
            <div
              className={`flex-1 border rounded-[999px] flex items-center px-[14px] h-[44px] gap-[8px] bg-white dark:bg-[#1A1A1A] box-border min-w-0 shadow-sm transition-colors ${
                eventSearchFocused || eventSearch
                  ? 'border-[var(--brand-orange-500)]'
                  : 'border-[var(--border-default)]'
              }`}
            >
              <Search01Icon className="w-[18px] h-[18px] text-[var(--color-icon-secondary)] shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Rechercher des événements"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                onFocus={() => setEventSearchFocused(true)}
                onBlur={() => setEventSearchFocused(false)}
                className="text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] font-poppins flex-1 bg-transparent outline-none border-none min-w-0"
              />
              {/* X pour effacer quand du texte est saisi */}
              {eventSearch ? (
                <button
                  onClick={() => { setEventSearch(''); hapticFeedback.impact(); }}
                  className="shrink-0 flex items-center justify-center p-1"
                >
                  <Cancel01Icon className="w-[18px] h-[18px] text-[var(--color-icon-secondary)]" strokeWidth={2} />
                </button>
              ) : (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    toast('Filtres avancés bientôt disponibles', { icon: '🚧' });
                  }}
                  className="shrink-0 flex items-center justify-center p-1"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 5.83325H5" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.5 14.1667H7.5" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 14.1667H17.5" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12.5 5.83325H17.5" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 5.83325C5 5.05669 5 4.6684 5.12687 4.36211C5.29602 3.95374 5.62048 3.62928 6.02886 3.46012C6.33515 3.33325 6.72343 3.33325 7.5 3.33325C8.27657 3.33325 8.66483 3.33325 8.97117 3.46012C9.3795 3.62928 9.704 3.95374 9.87317 4.36211C10 4.6684 10 5.05669 10 5.83325C10 6.60982 10 6.9981 9.87317 7.30439C9.704 7.71277 9.3795 8.03723 8.97117 8.20639C8.66483 8.33325 8.27657 8.33325 7.5 8.33325C6.72343 8.33325 6.33515 8.33325 6.02886 8.20639C5.62048 8.03723 5.29602 7.71277 5.12687 7.30439C5 6.9981 5 6.60982 5 5.83325Z" stroke="#737373" strokeWidth="1.5"/>
                    <path d="M10 14.1667C10 13.3902 10 13.0019 10.1268 12.6956C10.296 12.2872 10.6205 11.9627 11.0288 11.7936C11.3352 11.6667 11.7234 11.6667 12.5 11.6667C13.2766 11.6667 13.6648 11.6667 13.9712 11.7936C14.3795 11.9627 14.704 12.2872 14.8732 12.6956C15 13.0019 15 13.3902 15 14.1667C15 14.9433 15 15.3316 14.8732 15.6379C14.704 16.0462 14.3795 16.3707 13.9712 16.5399C13.6648 16.6667 13.2766 16.6667 12.5 16.6667C11.7234 16.6667 11.3352 16.6667 11.0288 16.5399C10.6205 16.3707 10.296 16.0462 10.1268 15.6379C10 15.3316 10 14.9433 10 14.1667Z" stroke="#737373" strokeWidth="1.5"/>
                  </svg>
                </button>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('scan-qr');
              }}
              className="shrink-0 flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg width="44" height="44" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" fill="white" className="dark:fill-[#1A1A1A]"/>
                <rect x="0.5" y="0.5" width="35" height="35" rx="17.5" stroke="#D4D4D4" className="dark:stroke-[#333]"/>
                <path d="M10.5 13C10.5 11.8215 10.5 11.2322 10.8661 10.8661C11.2322 10.5 11.8215 10.5 13 10.5C14.1785 10.5 14.7678 10.5 15.1339 10.8661C15.5 11.2322 15.5 11.8215 15.5 13C15.5 14.1785 15.5 14.7678 15.1339 15.1339C14.7678 15.5 14.1785 15.5 13 15.5C11.8215 15.5 11.2322 15.5 10.8661 15.1339C10.5 14.7678 10.5 14.1785 10.5 13Z" stroke="#737373" strokeWidth="1.5"/>
                <path d="M10.5 23C10.5 21.8215 10.5 21.2322 10.8661 20.8661C11.2322 20.5 11.8215 20.5 13 20.5C14.1785 20.5 14.7678 20.5 15.1339 20.8661C15.5 21.2322 15.5 21.8215 15.5 23C15.5 24.1785 15.5 24.7677 15.1339 25.1339C14.7678 25.5 14.1785 25.5 13 25.5C11.8215 25.5 11.2322 25.5 10.8661 25.1339C10.5 24.7677 10.5 24.1785 10.5 23Z" stroke="#737373" strokeWidth="1.5"/>
                <path d="M10.5 18H15.5" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 10.5V14.6667" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.5 13C20.5 11.8215 20.5 11.2322 20.8661 10.8661C21.2322 10.5 21.8215 10.5 23 10.5C24.1785 10.5 24.7677 10.5 25.1339 10.8661C25.5 11.2322 25.5 11.8215 25.5 13C25.5 14.1785 25.5 14.7678 25.1339 15.1339C24.7677 15.5 24.1785 15.5 23 15.5C21.8215 15.5 21.2322 15.5 20.8661 15.1339C20.5 14.7678 20.5 14.1785 20.5 13Z" stroke="#737373" strokeWidth="1.5"/>
                <path d="M25.5 18H20.5C19.3215 18 18.7322 18 18.3661 18.3661C18 18.7322 18 19.3215 18 20.5M18 22.8077V25.1154M20.5 20.5V21.75C20.5 22.9553 21.1531 23 22.1667 23C22.6269 23 23 23.3731 23 23.8333M21.3333 25.5H20.5M23 20.5C24.1785 20.5 24.7677 20.5 25.1339 20.8667C25.5 21.2332 25.5 21.8234 25.5 23.0036C25.5 24.1838 25.5 24.7739 25.1339 25.1406C24.8667 25.4082 24.4806 25.4805 23.8333 25.5" stroke="#737373" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Filter chips — scrollable if they don't fit */}
          <div className="flex gap-[8px] pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filterTabs.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    hapticFeedback.impact();
                    setSelectedCategory(tab.id);
                  }}
                  className={`shrink-0 active:scale-95 transition-all px-[16px] py-[8px] rounded-[1000px] text-center ${
                    isActive
                      ? 'bg-[#FFF9EC] text-[#FF7A00]'
                      : 'bg-[#F9FAFB] dark:bg-[#2A2A2A] text-[#737373] dark:text-[#A3A3A3]'
                  }`}
                >
                  <span className={`text-[12px] font-poppins whitespace-nowrap ${
                    isActive ? 'font-semibold' : 'font-medium'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vue Carte (Map View) */}
        {viewMode === 'map' && (
          <div className="flex-1 relative z-0 w-full h-full">
            {/* Bouton pour revenir à la Liste */}
            <div className="absolute top-4 right-4 z-[1050]">
              <button
                onClick={() => {
                  hapticFeedback.impact();
                  setViewMode('list');
                }}
                className="w-[44px] h-[44px] rounded-[12px] bg-[var(--brand-orange-500)] shadow-md flex items-center justify-center active:scale-95 transition-transform"
              >
                <ListViewIcon className="w-[22px] h-[22px] text-white" strokeWidth={2} />
              </button>
            </div>
            <ExplorerMap
              events={mapEvents}
              mapCenter={currentLocation === 'Abomey-Calavi' ? [6.4485, 2.3556] : [6.36536, 2.41833]}
              mapGeoLoading={false}
              onGeolocate={() => {}}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* Vue Liste (List View) */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto relative z-10 bg-background h-full w-full">
            <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={<div className="p-4 text-center text-[var(--color-text-secondary)] text-sm">Actualisation...</div>}>
              <div className="px-4 pt-4 pb-[80px] flex flex-col min-h-[100vh]">
                {filteredEvents.length > 0 ? (
                  filteredEvents.map(ev => {
                    const dateObj = new Date(ev.startAt);
                    const dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        onNavigate={onNavigate}
                        name={ev.title}
                        datetime={dateStr}
                        city={ev.city || ''}
                        place={ev.address || ''}
                        attendeesCount={`${ev.currentAttendees || 0} Participants`}
                        cover={true}
                      />
                    );
                  })
                ) : (
                  <div className="w-full text-center py-10 mt-10">
                    <p className="text-[#9CA3AF] text-[15px] font-poppins">Aucun résultat</p>
                  </div>
                )}
              </div>
            </PullToRefresh>
            
            {/* Bouton pour aller sur la Carte */}
            <div className="fixed bottom-[100px] right-5 z-[1050]">
              <button
                onClick={() => {
                  hapticFeedback.impact();
                  setViewMode('map');
                }}
                className="w-[44px] h-[44px] rounded-[12px] bg-[var(--brand-orange-500)] shadow-md flex items-center justify-center active:scale-95 transition-transform"
              >
                <MapsIcon className="w-[22px] h-[22px] text-white" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}


