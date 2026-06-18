import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search, ChevronLeft, X, Check, Loader2, Lock, Map, List } from 'lucide-react';
import { 
  Notification03Icon, Location01Icon, ArrowDown01Icon, Settings04Icon, QrCode01Icon,
  DashboardSquare01Icon, MusicNote02Icon, FootballIcon, PaintBoardIcon, Moon01Icon, RestaurantIcon
} from 'hugeicons-react';
import { apiClient } from '@/lib/api-client';
import { hapticFeedback } from '@/lib/haptics';
import { EventCard } from '@/components/shared/EventCard';
import ExplorerMap from '@/app/components/ExplorerMap';
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

// Base category list for search tab
const categories = [
  { id: 'tout', label: 'Tout', Icon: DashboardSquare01Icon },
  { id: 'concert', label: 'Concert', Icon: MusicNote02Icon },
  { id: 'sport', label: 'Sport', Icon: FootballIcon },
  { id: 'art', label: 'Art', Icon: PaintBoardIcon },
  { id: 'soiree', label: 'Soirée / Fête', Icon: Moon01Icon },
  { id: 'gastronomie', label: 'Gastronomie', Icon: RestaurantIcon },
];

type Screen = 'list' | 'filter' | 'search' | 'join';

export function Explorer({ onNavigate }: ExplorerProps) {
  const location = useLocation();
  const navigate = useNavigate();
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

  const [mapSearch, setMapSearch] = useState('');



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

    const filteredCities = BENIN_CITIES.filter(c => c.toLowerCase().startsWith(mapSearch.toLowerCase()));

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column' }}>
        {/* Barre de recherche */}
        <div style={{ padding: '12px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FAFAFA' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '999px',
            padding: '0 16px',
            height: '44px',
            backgroundColor: 'white',
            border: isSearching ? '1.5px solid #FF7A00' : '1px solid #DFDFDF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <Location01Icon style={{ width: 20, height: 20, color: '#A3A3A3', flexShrink: 0 }} strokeWidth={1.5} />
            <input
              autoFocus
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Rechercher une ville..."
              style={{
                flex: 1,
                fontSize: 15,
                outline: 'none',
                background: 'transparent',
                color: '#1B1818',
                fontFamily: 'Poppins, sans-serif',
                border: 'none'
              }}
            />
            <button
              onClick={closeSearch}
              style={{ padding: 6, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X style={{ width: 18, height: 18, color: '#A3A3A3' }} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Liste des résultats */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 0' }}>
          {!isSearching ? (
            // État vide — badge ville active + récents
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              <button
                onClick={closeSearch}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  backgroundColor: '#FF7A00', borderRadius: 999,
                  padding: '10px 16px', border: 'none', cursor: 'pointer',
                  marginBottom: 24
                }}
              >
                <span style={{ color: 'white', fontSize: 15, fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>Cotonou</span>
                <Check style={{ width: 16, height: 16, color: 'white' }} strokeWidth={3} />
              </button>

              {recentCities.length > 0 && (
                <div style={{ width: '100%' }}>
                  <p style={{ fontSize: 14, color: '#6B7280', fontFamily: 'Poppins, sans-serif', fontWeight: 500, marginBottom: 8 }}>Récents</p>
                  {recentCities.map((city, idx) => (
                    <button
                      key={idx}
                      onClick={() => { saveRecentCity(city); setMapSearch(city); closeSearch(); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                        gap: 12, padding: '14px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #F3F4F6',
                        cursor: 'pointer', textAlign: 'left'
                      }}
                    >
                      <Location01Icon style={{ width: 22, height: 22, color: '#5B5B5B', flexShrink: 0 }} strokeWidth={1.5} />
                      <span style={{ fontSize: 16, color: '#1B1818', fontFamily: 'Poppins, sans-serif' }}>{city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Suggestions d'autocomplétion
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              {filteredCities.map((city, idx) => (
                <button
                  key={idx}
                  onClick={() => { saveRecentCity(city); setMapSearch(city); closeSearch(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                    gap: 12, padding: '14px 0', background: 'transparent', border: 'none', borderBottom: '1px solid #F3F4F6',
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <Location01Icon style={{ width: 22, height: 22, color: '#5B5B5B', flexShrink: 0 }} strokeWidth={1.5} />
                  <span style={{ fontSize: 16, color: '#1B1818', fontFamily: 'Poppins, sans-serif' }}>{city}</span>
                </button>
              ))}
              {filteredCities.length === 0 && (
                <p style={{ width: '100%', textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 15, fontFamily: 'Poppins, sans-serif' }}>Aucune ville trouvée</p>
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
        <div className="px-5 pt-safe-6 pb-3 flex items-center gap-150">
          <button onClick={() => setScreen('list')} className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm">
            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Rejoindre</h2>
        </div>

        <div className="flex-1 px-5 pt-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-brand-orange-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Lock className="w-8 h-8 text-action-primary" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">Événement Privé</h3>
          <p className="text-text-secondary text-center mb-10 text-[15px] leading-relaxed max-w-[280px]">
            Entrez le code d'accès partagé par l'organisateur pour rejoindre cet événement.
          </p>

          <div className="w-full bg-background-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-150">Code d'accès</label>
            <input
              type="text"
              placeholder="Ex: a1b2c3d4"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full bg-gray-50 border border-border-primary rounded-2xl px-5 py-200 text-center text-2xl tracking-widest font-mono font-bold text-gray-900 focus:outline-none focus:border-action-primary focus:ring-2 focus:ring-orange-200 transition-all uppercase"
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
  
  // Mock data implementation for user request
  const currentLocation = mapSearch || 'Cotonou';
  const isAbomey = currentLocation === 'Abomey-Calavi';
  
  const mockCards = isAbomey ? [
    { id: '3', title: 'Lancement Let\'s Out', date: "Aujourd'hui • 10h10", location: "Université d'Abomey-Calavi (Abomey-Calavi)" },
    { id: '4', title: 'Matinée Cocktail social', date: "Aujourd'hui • 09h", location: "Fidirossè Beach (Cotonou)" }
  ] : [
    { id: '1', title: 'Chill bouffe gratuite', date: "Aujourd'hui à 10h", location: "Cotonou • Place de l'amazone" },
    { id: '2', title: 'Sea holidays party', date: "Samedi prochain à 09h", location: "Cotonou • Fidirossè Beach (Cotonou)" }
  ];

  const mapEvents = mockCards.map((card, i) => ({
    id: card.id,
    title: card.title,
    city: currentLocation,
    address: card.location,
    latitude: isAbomey ? 6.4485 + (i * 0.002) : 6.36536 + (i * 0.002),
    longitude: isAbomey ? 2.3556 + (i * 0.002) : 2.41833 + (i * 0.002),
    startAt: new Date().toISOString(),
    currentAttendees: 500,
    participationMode: 'Gratuit',
    coverUrl: ''
  })) as any[];


  return (
    <div className={`w-full h-full flex flex-col relative bg-background`}>

        {/* Header & Search Bar */}
        <div className={`px-5 pt-safe-6 pb-2 shrink-0 relative z-20 bg-white`}>
          <div className="flex items-center justify-between mb-4 mt-2">
            <h1 className="text-[24px] font-semibold font-poppins text-[#1B1818] tracking-tight">Explorez et découvrez</h1>
            <button onClick={() => onNavigate('notifications')} className="relative p-1">
              <Notification03Icon className="w-[24px] h-[24px] text-[#1B1818]" strokeWidth={1.8} />
              <div className="absolute top-0 right-0 w-[18px] h-[18px] bg-[#FF7A00] rounded-full border-[1.5px] border-white flex items-center justify-center">
                <span className="text-[10px] font-bold text-white leading-none">5</span>
              </div>
            </button>
          </div>

          <button onClick={openSearch} className="flex items-center gap-1.5 mb-5 text-[#5B5B5B] active:opacity-70 transition-opacity">
            <Location01Icon className="w-[24px] h-[24px]" strokeWidth={2} />
            <span className="text-[20px] font-poppins font-semibold">{currentLocation}</span>
            <ArrowDown01Icon className="w-[20px] h-[20px]" strokeWidth={2} />
          </button>

          <div className="flex items-center gap-3 mb-5 w-full max-w-[358px]">
            {/* Champ de recherche */}
            <div
              className="flex-1 border border-[#DFDFDF] rounded-full flex items-center px-4 h-[44px] gap-[4px] bg-white cursor-text"
              onClick={() => {
                hapticFeedback.impact();
                openSearch();
              }}
            >
              <Search className="w-[20px] h-[20px] text-[#A3A3A3] shrink-0" strokeWidth={1.5} />
              <span className="text-[14px] text-[#A3A3A3] font-poppins flex-1">Rechercher des événements</span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hapticFeedback.impact();
                  // setScreen('filter'); // Supprimé selon la demande
                }}
                className="p-1 shrink-0"
              >
                <Settings04Icon className="w-[20px] h-[20px] text-[#A3A3A3]" strokeWidth={1.5} />
              </button>
            </div>

            {/* Bouton Scan/QR Code */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticFeedback.impact();
                // Action future pour le scan
              }}
              className="w-[44px] h-[44px] shrink-0 rounded-full border border-[#DFDFDF] bg-white flex items-center justify-center active:bg-gray-50 transition-colors"
            >
              <QrCode01Icon className="w-[22px] h-[22px] text-[#5B5B5B]" strokeWidth={1.5} />
            </button>
          </div>

          {/* Category chips */}
          {/* Category bar */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((category) => {
              const Icon = category.Icon;
              const isActive = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    hapticFeedback.impact();
                    setSelectedCategory(category.id);
                  }}
                  className="flex flex-col items-center justify-center gap-2 flex-shrink-0 active:scale-95 transition-transform"
                >
                  <div className={isActive ? 'text-[#FF7A00]' : 'text-[#8D8D8D]'}>
                    <Icon className="w-6 h-6" strokeWidth={isActive ? 2 : 1.5} />
                  </div>
                  <span
                    className={`text-[12px] font-poppins ${
                      isActive ? 'text-[#FF7A00] font-medium' : 'text-[#8D8D8D] font-normal'
                    }`}
                  >
                    {category.label}
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
                className="w-[44px] h-[44px] rounded-[12px] bg-[#FF7A00] shadow-md flex items-center justify-center active:scale-95 transition-transform"
              >
                <List className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
              </button>
            </div>
            <ExplorerMap
              events={mapEvents}
              mapCenter={isAbomey ? [6.4485, 2.3556] : [6.36536, 2.41833]}
              mapGeoLoading={false}
              onGeolocate={() => {}}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* Vue Liste (List View) */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[80px] flex flex-col items-center relative z-10 bg-background">
            {mockCards.map(card => {
              const parts = card.location.split(' • ');
              return (
                <EventCard
                  key={card.id}
                  name={card.title}
                  datetime={card.date}
                  city={parts[0]}
                  place={parts[1]}
                  attendeesCount="+500 Participants"
                  price="Gratuit"
                  cover={true}
                />
              );
            })}
            
            {/* Bouton pour aller sur la Carte */}
            <div className="fixed bottom-[100px] right-5 z-[1050]">
              <button
                onClick={() => {
                  hapticFeedback.impact();
                  setViewMode('map');
                }}
                className="w-[44px] h-[44px] rounded-[12px] bg-[#FF7A00] shadow-md flex items-center justify-center active:scale-95 transition-transform"
              >
                <Map className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}


