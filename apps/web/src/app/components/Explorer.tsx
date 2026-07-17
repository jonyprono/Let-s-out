import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { Loader2, ChevronLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Search01Icon, Location01Icon, ArrowDown01Icon, MapsIcon, Cancel01Icon, Tick01Icon } from 'hugeicons-react';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { apiClient } from '@/lib/api-client';
import { hapticFeedback } from '@/lib/haptics';
import { eventsApi } from '@/features/events/api';
import { SquareEventCard, RowEventCard } from '@/components/ui/event-cards-v2';
import { sortFeaturedEvents, sortNearbyEvents } from '@/utils/event-ranking';
import ExplorerMap from '@/app/components/ExplorerMap';
import { useNotifications } from '@/features/notifications/api';
import PullToRefresh from 'react-simple-pull-to-refresh';

interface ExplorerProps {
  onNavigate: (screen: string, id?: string) => void;
}

// Filtres supprimés

import { Basketball01Icon, PaintBoardIcon, Moon01Icon, MusicNote01Icon, StarIcon, Settings01Icon, Mic01Icon } from 'hugeicons-react';

const CATEGORY_LABELS = [
  { id: 'MUSIC',      label: 'Concerts',    icon: MusicNote01Icon },
  { id: 'NIGHTLIFE',  label: 'Fêtes',       icon: Moon01Icon },
  { id: 'CONFERENCE', label: 'Conférences', icon: Mic01Icon },
  { id: 'WORKSHOP',   label: 'Ateliers',    icon: Settings01Icon },
  { id: 'SPORT',      label: 'Sports',      icon: Basketball01Icon },
  { id: 'CULTURE',    label: 'Arts',        icon: PaintBoardIcon },
  { id: 'OTHER',      label: 'Autres',      icon: StarIcon },
];

// Filter tabs — pill style with border
const filterTabs = [
  { id: 'tout',          label: 'Tout',         filter: null },
  { id: 'pour-vous',     label: 'Pour vous',    filter: 'recommended' },
  { id: 'en-ce-moment',  label: 'En ce moment', filter: 'ongoing' },
  { id: 'ce-soir',       label: 'Ce soir',      filter: 'tonight' },
  { id: 'ce-week-end',   label: 'Week-end',     filter: 'weekend' },
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
  const [selectedIconCategory, setSelectedIconCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [eventSearchFocused, setEventSearchFocused] = useState(false);
  const [viewAll, setViewAll] = useState<'featured' | 'nearby' | null>(null);



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
  const { data: eventsData, refetch } = useQuery({
    queryKey: ['events', 'explorer'],
    queryFn: async () => {
      const res = await eventsApi.list({ limit: 500 });
      return res.data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const events = eventsData || [];

  const handleRefresh = async () => {
    await refetch();
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

    if (searchActive) return textMatch && tabMatch && (!selectedIconCategory || ev.category === selectedIconCategory);
    return textMatch && cityMatch && tabMatch && (!selectedIconCategory || ev.category === selectedIconCategory);
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

  if (viewAll) {
    const listEvents = viewAll === 'featured' ? sortFeaturedEvents(filteredEvents) : sortNearbyEvents(filteredEvents);
    const title = viewAll === 'featured' ? 'En vedette' : 'Près de vous';
    
    return (
      <div className="w-full h-full flex flex-col bg-white dark:bg-black">
        {/* Header */}
        <div className="px-4 pt-safe-4 pt-4 pb-3 flex items-center gap-3 bg-white dark:bg-black z-10 sticky top-0 border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => setViewAll(null)} className="w-10 h-10 bg-gray-100 dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        </div>
        
        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
          {listEvents.map((ev: any) => (
            <RowEventCard
              key={ev.id}
              event={ev}
              onClick={() => onNavigate('event-details', ev.id)}
            />
          ))}
          {listEvents.length === 0 && (
            <p className="text-center text-gray-500 py-10">Aucun événement disponible.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative bg-white dark:bg-black">

      {/* Map View Header (Fixed) */}
      {viewMode === 'map' && (
        <div className="px-4 pt-safe-5 pt-5 pb-2 shrink-0 bg-white dark:bg-black z-10 shadow-sm relative">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-white leading-tight">
                Explorer <span className="text-[#FF7A00]">✦</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => onNavigate('notifications')} className="w-10 h-10 flex items-center justify-center">
                <NotificationIconWithBadge unreadCount={unreadNotifCount} className="w-7 h-7 text-gray-900 dark:text-white" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 mb-3">
            <div className={`flex-1 flex items-center gap-2 px-4 h-11 rounded-full bg-gray-100 dark:bg-[#1A1A1A] border transition-colors ${
              eventSearchFocused || eventSearch ? 'border-[#FF7A00]' : 'border-transparent'
            }`}>
              <Search01Icon className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Rechercher des événements, artistes, lieux..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                onFocus={() => setEventSearchFocused(true)}
                onBlur={() => setEventSearchFocused(false)}
                className="flex-1 text-[13px] bg-transparent outline-none text-gray-800 dark:text-white placeholder:text-gray-400 font-medium min-w-0"
              />
              {eventSearch && (
                <button onClick={() => { setEventSearch(''); hapticFeedback.impact(); }}>
                  <Cancel01Icon className="w-4 h-4 text-gray-400" strokeWidth={2} />
                </button>
              )}
            </div>
            <button
              onClick={() => { hapticFeedback.impact(); setViewMode('list'); }}
              className="shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">Liste</span>
            </button>
          </div>
          <button onClick={openSearch} className="flex items-center gap-1 mb-2 active:opacity-70 transition-opacity">
            <Location01Icon className="w-4 h-4 text-gray-500" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
              {currentLocation || 'Où allez-vous ?'}
            </span>
            <ArrowDown01Icon className="w-4 h-4 text-gray-500" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="flex-1 relative z-0 w-full h-full">
          <ExplorerMap
            events={mapEvents}
            mapCenter={currentLocation === 'Abomey-Calavi' ? [6.4485, 2.3556] : [6.36536, 2.41833]}
            mapGeoLoading={false}
            onGeolocate={() => {}}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-black">
          {/* Fixed Header */}
          <div className="px-4 pt-safe-3 pt-3 pb-2 bg-white dark:bg-black z-20 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-[19px] font-bold text-gray-900 dark:text-white leading-tight">
                  Explorer <span className="text-[#FF7A00]">✦</span>
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  Découvrez des expériences uniques autour de vous
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onNavigate('notifications')} className="w-9 h-9 flex items-center justify-center">
                  <NotificationIconWithBadge unreadCount={unreadNotifCount} className="w-6 h-6 text-gray-900 dark:text-white" />
                </button>
                <button
                  onClick={() => toast('Filtres avancés bientôt disponibles', { icon: '🚧' })}
                  className="w-9 h-9 bg-[#FF7A00] rounded-[12px] flex items-center justify-center shadow-md active:scale-95 transition-transform"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M4 6h16M7 12h10M10 18h4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className={`flex-1 flex items-center gap-2 px-3 h-9 rounded-full bg-gray-100 dark:bg-[#1A1A1A] border transition-colors ${
                eventSearchFocused || eventSearch ? 'border-[#FF7A00]' : 'border-transparent'
              }`}>
                <Search01Icon className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Rechercher des événements, artistes, lieux..."
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  onFocus={() => setEventSearchFocused(true)}
                  onBlur={() => setEventSearchFocused(false)}
                  className="flex-1 text-[12px] bg-transparent outline-none text-gray-800 dark:text-white placeholder:text-gray-400 font-medium min-w-0"
                />
                {eventSearch && (
                  <button onClick={() => { setEventSearch(''); hapticFeedback.impact(); }}>
                    <Cancel01Icon className="w-4 h-4 text-gray-400" strokeWidth={2} />
                  </button>
                )}
              </div>
              <button
                onClick={() => { hapticFeedback.impact(); setViewMode('map'); }}
                className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 3L4 5.5v15L9 18l6 3 5-2.5V3.5L15 6 9 3z" stroke="#6B7280" strokeWidth="1.8" strokeLinejoin="round"/>
                  <path d="M9 3v15M15 6v15" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">Carte</span>
              </button>
            </div>

            <button onClick={openSearch} className="flex items-center gap-1 mb-1.5 active:opacity-70 transition-opacity">
              <Location01Icon className="w-4 h-4 text-gray-500" strokeWidth={1.8} />
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
                {currentLocation || 'Où allez-vous ?'}
              </span>
              <ArrowDown01Icon className="w-4 h-4 text-gray-500" strokeWidth={2} />
            </button>

            <div className="flex gap-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {filterTabs.map((tab) => {
                const isActive = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { hapticFeedback.impact(); setSelectedCategory(tab.id); }}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95 whitespace-nowrap border ${
                      isActive
                        ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-sm'
                        : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={<div className="p-4 text-center text-gray-400 text-sm">Actualisation...</div>}>
              <div>
              
              {/* Category Icons Row (Scrolls away) */}
              <div className="flex gap-3 px-4 pt-1 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CATEGORY_LABELS.map((cat) => {
                const isActive = selectedIconCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { hapticFeedback.impact(); setSelectedIconCategory(isActive ? null : cat.id); }}
                    className="flex flex-col items-center gap-1 shrink-0 active:scale-95 transition-transform w-[50px]"
                  >
                    <div className={`w-[42px] h-[42px] rounded-full flex items-center justify-center border transition-colors ${
                      isActive
                        ? 'bg-orange-50 dark:bg-[#FF7A00]/10 border-orange-200 dark:border-[#FF7A00]/30'
                        : 'bg-orange-50/60 dark:bg-[#FF7A00]/5 border-orange-100 dark:border-[#FF7A00]/10'
                    }`}>
                      <cat.icon size={20} className="text-[#FF7A00]" strokeWidth={1.8} />
                    </div>
                    <span className={`text-[10px] text-center font-medium leading-tight ${
                      isActive ? 'text-[#FF7A00] font-semibold' : 'text-gray-600 dark:text-gray-400'
                    }`}>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-4 pt-1 pb-[100px]">
              {filteredEvents.length > 0 ? (
                <>
                  {/* ── En vedette (Horizontal scroll — 3 cards visible) ── */}
                  {sortFeaturedEvents(filteredEvents).length > 0 && (
                    <div className="mb-3 -mx-4">
                      <div className="flex items-center justify-between px-4 mb-3">
                        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">
                          En vedette <span>🔥</span>
                        </h2>
                        <button onClick={() => setViewAll('featured')} className="text-[13px] font-semibold text-[#FF7A00]">Voir tout &gt;</button>
                      </div>
                      <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                        {sortFeaturedEvents(filteredEvents).slice(0, 6).map((ev, idx) => (
                          <SquareEventCard
                            key={ev.id}
                            event={ev}
                            onClick={() => onNavigate('event-details', ev.id)}
                            badge={idx === 0 ? 'À LA UNE' : idx === 1 ? 'POPULAIRE' : 'NOUVEAU'}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Événements près de vous (Vertical) ── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Événements près de vous</h2>
                      <button onClick={() => setViewAll('nearby')} className="text-[13px] font-semibold text-[#FF7A00]">Voir tout &gt;</button>
                    </div>
                    <div className="space-y-3">
                      {sortNearbyEvents(filteredEvents).map(ev => (
                        <RowEventCard
                          key={ev.id}
                          event={ev}
                          onClick={() => onNavigate('event-details', ev.id)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-20 gap-3 text-center">
                  <div className="text-4xl">🔍</div>
                  <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-300">Aucun résultat</p>
                  <p className="text-[13px] text-gray-400">Essayez un autre mot-clé ou une autre ville.</p>
                </div>
              )}
            </div>
            </div>
          </PullToRefresh>
        </div>

          {/* Map FAB */}
          <div className="fixed bottom-[100px] right-5 z-[1050]">
            <button
              onClick={() => { hapticFeedback.impact(); setViewMode('map'); }}
              className="w-11 h-11 rounded-[14px] bg-[#FF7A00] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
              <MapsIcon className="w-5 h-5 text-white" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


