import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router';
import { Search, SlidersHorizontal, MapPin, ChevronLeft, X, Check, Loader2, Lock, Target, Bell, ChevronDown, QrCode, List } from 'lucide-react';
// import { Basketball01Icon, PaintBoardIcon, Pizza01Icon, Moon01Icon, Airplane01Icon, GameIcon, FavouriteIcon, MusicNote01Icon, StarIcon } from 'hugeicons-react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi, type Event } from '@/features/events/api';
import { apiClient } from '@/lib/api-client';
import { hapticFeedback } from '@/lib/haptics';
import { getCurrentPosition, searchPlaces, type GeoPlace } from '@/lib/geo';
import { EventCard } from '@/components/shared/EventCard';

// ── Leaflet lazy-loaded only when Map mode is actually used ──────────────────
const LazyExplorerMap = lazy(() => import('@/app/components/ExplorerMap'));
interface ExplorerProps {
  onNavigate: (screen: string, id?: string) => void;
}

const CATEGORIES_FILTER = [
  { key: 'SPORT', label: 'Sports' },
  { key: 'TECH', label: 'Tech & Pro' },
  { key: 'MUSIC', label: 'Musique' },
  { key: 'NIGHTLIFE', label: 'Soirées & Fêtes' },
  { key: 'ART', label: 'Art & Théâtre' },
  { key: 'CULTURE', label: 'Culture & Cinéma' },
  { key: 'FOOD', label: 'Gastronomie' },
  { key: 'LIFESTYLE', label: 'Lifestyle' },
  { key: 'WELLNESS', label: 'Santé & Bien-être' },
  { key: 'SCIENCE', label: 'Science' },
  { key: 'TRAVEL', label: 'Voyages' },
  { key: 'GAMING', label: 'Jeux' },
  { key: 'SOCIAL', label: 'Social & Comédie' },
];

const DATE_FILTERS = [
  { key: 'soon', label: 'Bientôt' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'week', label: 'Cette semaine' },
  { key: 'weekend', label: 'Ce week-end' },
  { key: 'pick', label: 'Choisir une date' },
];

const TIME_FILTERS = [
  { key: 'all', label: 'Tout moment' },
  { key: 'morning', label: 'Matinée' },
  { key: 'afternoon', label: 'Après-midi' },
  { key: 'evening', label: 'Soirée' },
  { key: 'night', label: 'Nuit' },
];

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
const BROWSE_CATEGORIES = ['Tout', 'Pour vous', 'En ce moment', 'Ce week-end'];

type Screen = 'list' | 'filter' | 'search' | 'join';

export function Explorer({ onNavigate }: ExplorerProps) {
  const location = useLocation();
  const [screen, setScreen] = useState<Screen>(() => {
    return location.search.includes('screen=filter') ? 'filter' : 'list';
  });
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchInput, setActiveSearchInput] = useState<'location'|'keyword'>('location');
  const [selectedCategory, setSelectedCategory] = useState('Tout');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const [filterDate, setFilterDate] = useState('soon');
  const [filterTime, setFilterTime] = useState('all');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterBudgetMax, setFilterBudgetMax] = useState(10000);
  const [filterCustomDate, setFilterCustomDate] = useState('');
  const [filterDistance, setFilterDistance] = useState(100);
  const [appliedFilters, setAppliedFilters] = useState({ date: 'soon', time: 'all', categories: [] as string[], budgetMax: 10000, customDate: '', distance: 100 });

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.36536, 2.41833])
  const [mapGeoLoading, setMapGeoLoading] = useState(false)
  const [mapSearch, setMapSearch] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState<GeoPlace[]>([])

  // Keyword event suggestions
  const [keywordSuggestions, setKeywordSuggestions] = useState<Event[]>([]);

  const isEnCours = selectedCategory === 'En ce moment';
  const isWeekend = selectedCategory === 'Ce week-end';
  const apiCategory = undefined;

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events', 'explorer', apiCategory, searchQuery, appliedFilters, isEnCours, isWeekend],
    queryFn: () => {
      let dateParam: string | undefined = undefined;
      if (appliedFilters.date === 'pick' && appliedFilters.customDate) {
        dateParam = appliedFilters.customDate;
      } else if (appliedFilters.date !== 'all' && appliedFilters.date !== 'soon') {
        dateParam = appliedFilters.date;
      } else if (isEnCours) {
        dateParam = 'today';
      } else if (isWeekend) {
        dateParam = 'weekend';
      }

      return eventsApi.list({
        status: 'PUBLISHED',
        category: apiCategory || (appliedFilters.categories.length > 0 ? appliedFilters.categories.join(',') : undefined),
        search: searchQuery || undefined,
        limit: 50,
        maxPrice: appliedFilters.budgetMax < 10000 ? appliedFilters.budgetMax : undefined,
        date: dateParam,
        time: appliedFilters.time !== 'all' ? appliedFilters.time : undefined,
      }).then((r) => r.data);
    },
    // Always fetch — no conditions that would prevent initial load
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Backend now handles custom date filtering
  // If "En cours" is selected, additionally filter client-side to events that have started
  // Also filter by distance client-side if a specific distance is selected
  const allFetchedEvents: Event[] = eventsData?.data || [];
  const events: Event[] = allFetchedEvents.filter(e => {
    // 1. En cours
    if (isEnCours) {
      const now = new Date();
      const start = new Date(e.startAt);
      const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 4 * 60 * 60 * 1000); // assume 4h duration
      if (!(start <= now && now <= end)) return false;
    }
    // 2. Distance
    if (appliedFilters.distance < 100 && e.latitude && e.longitude && mapCenter[0] && mapCenter[1]) {
      // Haversine formula
      const R = 6371; // km
      const dLat = (e.latitude - mapCenter[0]) * Math.PI / 180;
      const dLon = (e.longitude - mapCenter[1]) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(mapCenter[0] * Math.PI / 180) * Math.cos(e.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      if (distance > appliedFilters.distance) return false;
    }
    return true;
  });

  const handleMapGeolocate = async () => {
    setMapGeoLoading(true)
    try {
      const pos = await getCurrentPosition()
      setMapCenter([pos.coords.latitude, pos.coords.longitude])
    } catch {
      // silently ignore, keep current center
    } finally {
      setMapGeoLoading(false)
    }
  }

  const handleMapSearch = async (q: string) => {
    setMapSearch(q)
    if (q.length < 2) { setMapSearchResults([]); return }
    const results = await searchPlaces(q)
    setMapSearchResults(results)
  }

  const toggleFilterCategory = (key: string) => {
    setFilterCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const applyFilters = () => {
    setAppliedFilters({ date: filterDate, time: filterTime, categories: filterCategories, budgetMax: filterBudgetMax, customDate: filterCustomDate, distance: filterDistance });
    setScreen('list');
  };

  const resetFilters = () => {
    setFilterDate('soon');
    setFilterTime('all');
    setFilterCategories([]);
    setFilterBudgetMax(10000);
    setFilterCustomDate('');
    setFilterDistance(100);
  };

  // Keyword search: query events API when user types in the keyword field
  useEffect(() => {
    if (searchQuery.length < 1) {
      setKeywordSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await eventsApi.list({ search: searchQuery, status: 'PUBLISHED', limit: 8 });
        setKeywordSuggestions(res.data?.data || res.data || []);
      } catch {
        setKeywordSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── FILTER SCREEN ─────────────────────────────────────────────────────────
  if (screen === 'filter') {
    return (
      <div className="w-full h-full bg-background flex flex-col">
        {/* Header */}
        <div className="px-5 pt-safe-6 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setScreen('list')} className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform">
              <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
            </button>
            <span className="text-[15px] font-semibold text-gray-900">Filtrer</span>
            <div className="w-8" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-200 space-y-6" style={{ scrollbarWidth: 'none' }}>
          {/* Date */}
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 mb-3">Date</h3>
            <div className="flex flex-wrap gap-2">
              {DATE_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterDate(f.key)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    filterDate === f.key
                      ? 'bg-action-primary text-white border-action-primary'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Custom date picker shown when 'Choisir une date' is selected */}
            {filterDate === 'pick' && (
              <input
                type="date"
                value={filterCustomDate}
                onChange={e => setFilterCustomDate(e.target.value)}
                className="mt-3 w-full border border-gray-200 rounded-xl px-4 py-2 text-[13px] text-gray-700 focus:outline-none focus:border-action-primary"
              />
            )}
          </div>

          {/* Moment */}
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 mb-3">Moment</h3>
            <div className="flex flex-wrap gap-2">
              {TIME_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterTime(f.key)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    filterTime === f.key
                      ? 'bg-action-primary text-white border-action-primary'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Catégorie */}
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 mb-3">Catégorie</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES_FILTER.map(cat => {
                const selected = filterCategories.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggleFilterCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all flex items-center gap-1 ${
                      selected
                        ? 'bg-action-primary text-white border-action-primary'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget */}
          <div className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-gray-900">Budget</h3>
              <span className="text-[13px] font-medium text-gray-500">
                0 - {filterBudgetMax >= 10000 ? '10 000' : filterBudgetMax.toLocaleString('fr-FR')} F CFA
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10000}
              step={500}
              value={filterBudgetMax}
              onChange={e => setFilterBudgetMax(Number(e.target.value))}
              className="w-full h-1 appearance-none cursor-pointer outline-none rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[20px] [&::-webkit-slider-thumb]:h-[20px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-action-primary [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.12)] [&::-moz-range-thumb]:w-[20px] [&::-moz-range-thumb]:h-[20px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-action-primary"
              style={{
                background: `linear-gradient(to right, #FF7A00 0%, #FF7A00 ${(filterBudgetMax / 10000) * 100}%, #E5E7EB ${(filterBudgetMax / 10000) * 100}%, #E5E7EB 100%)`
              }}
            />
          </div>

          {/* Distance */}
          <div className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-gray-900">Distance</h3>
              <span className="text-[13px] font-medium text-gray-500">
                {filterDistance >= 100 ? "N'importe quelle distance" : `${filterDistance} km`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={filterDistance}
              onChange={e => setFilterDistance(Number(e.target.value))}
              className="w-full h-1 appearance-none cursor-pointer outline-none rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[20px] [&::-webkit-slider-thumb]:h-[20px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-action-primary [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.12)] [&::-moz-range-thumb]:w-[20px] [&::-moz-range-thumb]:h-[20px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-action-primary"
              style={{ background: `linear-gradient(to right, #FF7A00 0%, #FF7A00 ${(filterDistance / 100) * 100}%, #E5E7EB ${(filterDistance / 100) * 100}%, #E5E7EB 100%)` }}
            />
          </div>
        </div>

        {/* Footer buttons — sticky en bas */}
        <div className="px-5 py-5 flex items-center gap-3 border-t border-gray-100 bg-background shrink-0">
          <button
            onClick={resetFilters}
            className="px-5 py-3 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 active:scale-95 transition-transform"
          >
            Réinitialiser
          </button>
          <button
            onClick={applyFilters}
            className="flex-1 py-3 rounded-full bg-action-primary active:bg-[#E56E00] text-[13px] font-semibold text-white active:scale-[0.98] transition-all"
          >
            Appliquer les filtres
          </button>
        </div>
      </div>
    );
  }

  // ── SEARCH SCREEN ─────────────────────────────────────────────────────────
  // ── SEARCH SCREEN (City Selector - Screen 2 & 3) ────────────────────────
  if (screen === 'search') {
    const isSearching = activeSearchInput === 'location' && mapSearch.length > 0;
    
    // Mock data for cities
    const recentCities = ['Abomey-Calavi', 'Cotonou', 'Bohicon', 'Abomey'];
    const allCities = ['Abomey', 'Abomey-Calavi', 'Adjarra', 'Adjohun', 'Aguégués', 'Allada', 'Aplahoué', 'Avrankou'];
    const filteredCities = allCities.filter(c => c.toLowerCase().startsWith(mapSearch.toLowerCase()));

    return (
      <div className="w-full h-full bg-background flex flex-col z-10 relative">
        <div className="px-5 pt-safe-6 pb-2">
          {/* Header Search Input */}
          <div className={`flex items-center gap-2 rounded-[16px] px-4 py-3 transition-colors ${isSearching ? 'border-action-primary border-[1.5px]' : 'border border-gray-200'}`}>
            <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={mapSearch}
              onChange={(e) => {
                setMapSearch(e.target.value);
                setActiveSearchInput('location');
              }}
              placeholder="Rechercher une ville..."
              className="flex-1 text-[15px] outline-none bg-transparent text-[#1B1818] placeholder:text-gray-400 font-poppins"
            />
            {isSearching && (
              <button onClick={() => setMapSearch('')}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4">
          {!isSearching ? (
            // Screen 2: Empty search (Focus location)
            <div className="animate-in fade-in duration-200">
              {/* Active Badge */}
              <button 
                className="inline-flex items-center gap-1.5 bg-action-primary px-4 py-2 rounded-full mb-6"
                onClick={() => setScreen('list')}
              >
                <span className="text-white text-[14px] font-semibold font-poppins">Cotonou</span>
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </button>

              {/* Récents */}
              <div>
                <h3 className="text-[13px] text-gray-500 font-poppins mb-3">Récents</h3>
                <div className="flex flex-col">
                  {recentCities.map((city, idx) => (
                    <button
                      key={idx}
                      className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 transition-opacity"
                      onClick={() => {
                        setMapSearch(city);
                        setScreen('list');
                      }}
                    >
                      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-[15px] text-[#1B1818] font-poppins">{city}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Screen 3: Active search
            <div className="flex flex-col animate-in fade-in duration-200">
              {filteredCities.map((city, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 transition-opacity"
                  onClick={() => {
                    setMapSearch(city);
                    setScreen('list');
                  }}
                >
                  <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span className="text-[15px] text-[#1B1818] font-poppins">{city}</span>
                </button>
              ))}
              {filteredCities.length === 0 && (
                <div className="py-4 text-center text-gray-400 text-sm font-poppins">Aucune ville trouvée</div>
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

  const MockEventCard = ({ data }: { data: any }) => (
    <div className="w-full bg-white rounded-[24px] overflow-hidden border border-gray-100 shadow-sm relative mb-4">
      <div className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </div>
      
      {/* Grille transparente placeholder */}
      <div className="w-full h-[180px] bg-[#F5F5F5] relative overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(45deg, #E5E5E5 25%, transparent 25%, transparent 75%, #E5E5E5 75%, #E5E5E5), linear-gradient(45deg, #E5E5E5 25%, transparent 25%, transparent 75%, #E5E5E5 75%, #E5E5E5)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px'
        }} />
      </div>

      <div className="p-4 relative">
        <h3 className="font-poppins font-bold text-[17px] text-[#1B1818] leading-tight mb-1">{data.title}</h3>
        <p className="font-poppins text-[13px] text-gray-500 mb-0.5">{data.date}</p>
        <p className="font-poppins text-[13px] text-gray-500 mb-4">{data.location}</p>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white" />
              <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white" />
              <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-white" />
            </div>
            <span className="font-poppins text-[12px] font-medium text-gray-600 ml-2">+500 Participants</span>
          </div>
          
          <div className="px-3 py-1 bg-[#E8F8F0] rounded-full">
            <span className="font-poppins font-semibold text-[13px] text-[#00A35F]">Gratuit</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Prevent TS unused variable errors during mockup phase
  void Suspense;
  void Target;
  void List;
  void EventCard;
  void LazyExplorerMap;
  void setSearchQuery;
  void mapGeoLoading;
  void mapSearchResults;
  void keywordSuggestions;
  void isLoading;
  void events;
  void handleMapGeolocate;
  void handleMapSearch;

  return (
    <div className={`w-full h-full flex flex-col relative bg-background`}>

        {/* Header & Search Bar */}
        <div className={`px-5 pt-safe-6 pb-2 shrink-0 relative z-10 bg-background-white`}>
          <div className="flex items-center justify-between mb-4 mt-2">
            <h1 className="text-[24px] font-semibold font-poppins text-[#1B1818] tracking-tight">Explorez et découvrez</h1>
            <button onClick={() => onNavigate('notifications')} className="relative p-1">
              <Bell className="w-6 h-6 text-[#1B1818]" strokeWidth={1.8} />
              <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-action-primary rounded-full border-2 border-white" />
            </button>
          </div>

          <button onClick={() => setScreen('search')} className="flex items-center gap-1.5 mb-5 text-gray-600 active:opacity-70 transition-opacity">
            <MapPin className="w-[18px] h-[18px]" strokeWidth={2} />
            <span className="text-[15px] font-poppins font-medium">{currentLocation}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={2} />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div
              className="flex-1 border border-gray-200 rounded-[14px] flex items-center px-4 py-3 bg-white"
            >
              <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
              <input 
                className="text-[15px] text-[#1B1818] font-poppins placeholder:text-gray-400 bg-transparent outline-none flex-1"
                placeholder="Rechercher des événements"
                readOnly
              />
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticFeedback.impact();
                    setScreen('filter');
                  }}
                  className="p-1"
                >
                  <SlidersHorizontal className="w-5 h-5 text-gray-400" />
                </button>
                <div className="w-[1px] h-5 bg-gray-200 mx-1"></div>
                <button
                  onClick={() => {
                    hapticFeedback.impact();
                    setViewMode(viewMode === 'list' ? 'map' : 'list');
                  }}
                  className="p-1"
                >
                  <QrCode className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
            {BROWSE_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => {
                  hapticFeedback.impact()
                  setSelectedCategory(category)
                }}
                className={`px-4 py-2 rounded-full text-[14px] font-poppins whitespace-nowrap font-medium transition-colors flex-shrink-0 ${
                  selectedCategory === category
                    ? 'bg-[#FFF5ED] text-[#FF7A00]'
                    : 'bg-transparent text-gray-500'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Content (Mocked Event List) */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[80px]">
          {mockCards.map(card => (
            <MockEventCard key={card.id} data={card} />
          ))}
        </div>

    </div>
  );
}


