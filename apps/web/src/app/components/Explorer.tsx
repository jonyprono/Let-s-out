import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router';
import { Search, SlidersHorizontal, MapPin, ChevronLeft, X, Check, Loader2, Lock, Target } from 'lucide-react';
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
  { key: 'CONFERENCE', label: 'Conférences' },
  { key: 'CONCERT', label: 'Concerts' },
  { key: 'FESTIVAL', label: 'Festivals' },
  { key: 'NIGHTLIFE', label: 'Soirées' },
  { key: 'THEATER', label: 'Théâtre' },
  { key: 'CINEMA', label: 'Cinéma' },
  { key: 'WORKSHOP', label: 'Formations' },
  { key: 'FOOD', label: 'Gastronomie' },
  { key: 'LIFESTYLE', label: 'Lifestyle' },
  { key: 'FASHION', label: 'Mode' },
  { key: 'HEALTH', label: 'Santé' },
  { key: 'SCIENCE', label: 'Science' },
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

const CATEGORY_LABELS: Record<string, string> = {
  SPORT: '⚽ Sport',
  CULTURE: '🎭 Culture & Art',
  FOOD: '🍔 Gastronomie',
  NIGHTLIFE: '🍸 Soirées',
  TRAVEL: '✈️ Voyages',
  GAMING: '🎮 Gaming',
  WELLNESS: '🧘 Bien-être',
  MUSIC: '🎵 Musique',
  OTHER: '✨ Autre',
};

// Base category list for search tab
const BROWSE_CATEGORIES = ['Tous', 'EN_COURS', 'SPORT', 'CULTURE', 'FOOD', 'NIGHTLIFE', 'TRAVEL', 'GAMING', 'WELLNESS', 'MUSIC', 'OTHER'];
const CATEGORY_CHIP_LABELS: Record<string, string> = { 'Tous': 'Tous', 'EN_COURS': '🔴 En cours', ...CATEGORY_LABELS };

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
  const [selectedCategory, setSelectedCategory] = useState('Tous');
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

  const isEnCours = selectedCategory === 'EN_COURS';
  const apiCategory = (selectedCategory === 'Tous' || isEnCours) ? undefined : selectedCategory;

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events', 'explorer', apiCategory, searchQuery, appliedFilters, isEnCours],
    queryFn: () => {
      // Resolve the date param: if custom date was picked, format as ISO date string
      let dateParam: string | undefined = undefined;
      if (appliedFilters.date === 'pick' && appliedFilters.customDate) {
        dateParam = appliedFilters.customDate;
      } else if (appliedFilters.date !== 'all') {
        dateParam = appliedFilters.date;
      } else if (isEnCours) {
        // "En cours" = events happening today
        dateParam = 'today';
      }
      // No date filter when "all" is selected — fetch everything

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
  if (screen === 'search') {
    return (
      <div className="w-full h-full bg-background flex flex-col">
        <div className="px-5 pt-safe-6 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-200">
            <button onClick={() => setScreen('list')} className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform">
              <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
            </button>
            <span className="text-[15px] font-semibold text-gray-900">Rechercher</span>
            <div className="w-8" />
          </div>

          {/* Location search */}
          <div className={`flex items-center gap-2 border rounded-full px-4 py-2.5 mb-3 transition-colors ${activeSearchInput === 'location' ? 'border-action-primary' : 'border-gray-200'}`}>
            <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              autoFocus
              value={mapSearch}
              onChange={(e) => handleMapSearch(e.target.value)}
              onFocus={() => setActiveSearchInput('location')}
              placeholder="Saisissez une ville..."
              className="flex-1 text-[15px] outline-none text-gray-900 placeholder:text-gray-400"
            />
            {mapSearch && (
              <button onClick={() => { handleMapSearch(''); setActiveSearchInput('location'); }}>
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-3 h-3 text-gray-500" />
                </div>
              </button>
            )}
          </div>

          {/* Event keyword search */}
          <div className={`flex items-center gap-2 border rounded-full px-4 py-2.5 transition-colors ${activeSearchInput === 'keyword' ? 'border-action-primary' : 'border-gray-200'}`}>
            <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setActiveSearchInput('keyword')}
              placeholder="Concert, sortie, fête..."
              className="flex-1 text-[15px] outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4">
          {activeSearchInput === 'location' ? (
            <div className="space-y-1">
              {/* Position actuelle toujours visible en haut, alignée à gauche */}
              <button className="w-full flex justify-start items-center text-left px-4 py-3 gap-2" onClick={handleMapGeolocate}>
                <Target className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="text-[15px] text-gray-900 flex-1">Position actuelle</span>
              </button>
              
              {(() => {
                const defaultLocs = ['Abomey, BJ', 'Abomey-Calavi, BJ', 'Cotonou, BJ', 'Ouidah, BJ', 'Porto-Novo, BJ', 'Parakou, BJ', 'Bohicon, BJ'];
                
                let list = mapSearch.length > 0 
                  ? [
                      ...defaultLocs.map(label => ({ label, lat: 0, lon: 0, isStatic: true })),
                      ...mapSearchResults.map(r => ({ label: r.label, lat: r.lat, lon: r.lon, isStatic: false }))
                    ]
                  : defaultLocs.map(label => ({ label, lat: 0, lon: 0, isStatic: true }));

                if (mapSearch.length > 0) {
                  // STRICT PREFIX MATCHING (STARTS WITH)
                  list = list.filter(loc => loc.label.toLowerCase().startsWith(mapSearch.toLowerCase()));
                  // Supprimer les doublons
                  list = list.filter((loc, idx, self) => self.findIndex(l => l.label === loc.label) === idx);
                }

                if (mapSearch.length > 0 && list.length === 0) {
                  return <div className="px-4 py-3 text-[14px] text-gray-400 text-left">Aucune ville trouvée</div>;
                }

                return list.map((loc, idx) => {
                  const isSelected = mapSearch === loc.label;
                  return (
                    <button
                      key={idx}
                      className="w-full flex justify-start items-center text-left px-4 py-3 gap-2"
                      onClick={() => {
                        handleMapSearch(loc.label);
                        if (!loc.isStatic && loc.lat && loc.lon) {
                          setMapCenter([loc.lat, loc.lon]);
                        }
                        setActiveSearchInput('keyword');
                      }}
                    >
                      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-[15px] text-gray-900 flex-1 truncate">{loc.label}</span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-action-primary flex items-center justify-center flex-shrink-0 ml-auto">
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="space-y-1">
              {searchQuery.length > 0 && keywordSuggestions.length > 0 ? (
                keywordSuggestions.map((evt) => (
                  <button
                    key={evt.id}
                    className="w-full flex items-center gap-2 px-4 py-3"
                    onClick={() => {
                      setSearchQuery(evt.title);
                      setScreen('list');
                    }}
                  >
                    {evt.coverUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={evt.coverUrl} alt={evt.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex flex-col items-start truncate">
                      <span className="text-[15px] text-gray-900 truncate">{evt.title}</span>
                      {evt.city && <span className="text-[12px] text-gray-400 truncate">{evt.city}</span>}
                    </div>
                  </button>
                ))
              ) : searchQuery.length > 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">Aucun événement trouvé</div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-sm">Tapez pour rechercher un événement</div>
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

  // ── MAIN LIST SCREEN ───────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-background flex flex-col">

        {/* Header & Search Bar */}
        <div className="bg-background-white px-5 pt-safe-6 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-150 mb-200">
            <div
              className="flex-1 bg-gray-50 rounded-full flex items-center px-200 py-2.5 cursor-text"
              onClick={() => {
                hapticFeedback.impact()
                setScreen('search')
              }}
            >
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-[14px] text-gray-400">Rechercher...</span>
            </div>
            <button
              onClick={() => {
                hapticFeedback.impact()
                setScreen('filter')
              }}
              className="w-10 h-10 rounded-full border border-border-primary flex items-center justify-center transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-700" />
            </button>
            <button
              onClick={() => {
                hapticFeedback.impact()
                setViewMode(viewMode === 'list' ? 'map' : 'list')
              }}
              className="w-10 h-10 rounded-full border border-border-primary flex items-center justify-center transition-colors bg-background-white hover:bg-gray-50 active:bg-gray-100 touch-sm"
            >
              <MapPin className={`w-4 h-4 ${viewMode === 'map' ? 'text-action-primary' : 'text-gray-700'}`} />
            </button>
            <button
              onClick={() => { hapticFeedback.impact(); setScreen('join') }}
              className="w-10 h-10 rounded-full border border-border-primary flex items-center justify-center transition-colors bg-background-white hover:bg-gray-50 active:bg-gray-100 touch-sm"
              title="Rejoindre un événement privé"
            >
              <Lock className="w-4 h-4 text-gray-700" />
            </button>
          </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {BROWSE_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => {
                hapticFeedback.impact()
                setSelectedCategory(category)
              }}
              className={`px-200 py-2 rounded-full text-sm whitespace-nowrap font-medium transition-colors flex-shrink-0 ${
                selectedCategory === category
                  ? category === 'EN_COURS'
                    ? 'bg-red-500 text-white'
                    : 'bg-action-primary active:bg-action-primary-hover text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              {CATEGORY_CHIP_LABELS[category] || CATEGORY_LABELS[category] || category}
            </button>
          ))}
        </div>
      </div>



        {/* Content (List or Map) */}
        {viewMode === 'map' ? (
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-action-primary" />
            </div>
          }>
            <LazyExplorerMap
              events={events}
              mapCenter={mapCenter}
              mapSearch={mapSearch}
              mapSearchResults={mapSearchResults}
              mapGeoLoading={mapGeoLoading}
              onMapSearch={handleMapSearch}
              onClearSearch={() => { setMapSearch(''); setMapSearchResults([]); }}
              onSelectSearchResult={(r) => { setMapCenter([r.lat, r.lon]); setMapSearch(''); setMapSearchResults([]); }}
              onGeolocate={handleMapGeolocate}
              onNavigate={onNavigate}
            />
          </Suspense>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-200 pb-20">
            {isLoading ? (
              // ── Skeleton loaders — prevent layout shift ──────────────────
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-background-white border border-gray-100 rounded-3xl p-150 flex gap-200 shadow-sm animate-pulse">
                  <div className="w-24 h-24 rounded-2xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <div className="h-3 bg-gray-200 rounded-full w-2/3" />
                    <div className="h-4 bg-gray-200 rounded-full w-full" />
                    <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                  </div>
                </div>
              ))
            ) : events.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-text-secondary">Aucun événement trouvé.</p>
              </div>
            ) : (
              events.map((event: Event) => (
                <EventCard key={event.id} event={event} onNavigate={onNavigate} />
              ))
            )}
          </div>
        )}
    </div>
  );
}


