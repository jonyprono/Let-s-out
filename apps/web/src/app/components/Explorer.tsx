import { useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router';
import { Search, SlidersHorizontal, MapPin, ChevronLeft, X, Check, Loader2, Lock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi, type Event } from '@/features/events/api';
import { hapticFeedback } from '@/lib/haptics';
import { getCurrentPosition, searchPlaces, type GeoPlace } from '@/lib/geo';
import { EventCard } from '@/components/shared/EventCard';

// ── Leaflet lazy-loaded only when Map mode is actually used ──────────────────
const LazyExplorerMap = lazy(() => import('@/app/components/ExplorerMap'));
interface ExplorerProps {
  onNavigate: (screen: string, id?: string) => void;
}

const CATEGORIES_FILTER = [
  { key: 'SPORT', label: 'Sport' },
  { key: 'CULTURE', label: 'Culture & Art' },
  { key: 'FOOD', label: 'Gastronomie' },
  { key: 'NIGHTLIFE', label: 'Soirées' },
  { key: 'TRAVEL', label: 'Voyages' },
  { key: 'GAMING', label: 'Gaming' },
  { key: 'WELLNESS', label: 'Bien-être' },
  { key: 'MUSIC', label: 'Musique' },
  { key: 'OTHER', label: 'Autre' },
];

const DATE_FILTERS = [
  { key: 'all', label: 'Toutes les dates' },
  { key: 'today', label: 'Aujourd\'hui' },
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

// Base category list for search tab
const BROWSE_CATEGORIES = ['Tous', 'EN_COURS', 'SPORT', 'CULTURE', 'FOOD', 'NIGHTLIFE', 'TRAVEL', 'GAMING', 'WELLNESS', 'MUSIC', 'OTHER'];
const CATEGORY_CHIP_LABELS: Record<string, string> = { 'Tous': 'Tous', 'EN_COURS': '🔴 En cours', ...Object.fromEntries(Object.entries({
  SPORT: 'Sport', CULTURE: 'Culture & Art', FOOD: 'Gastronomie', NIGHTLIFE: 'Soirées',
  TRAVEL: 'Voyages', GAMING: 'Gaming', WELLNESS: 'Bien-être', MUSIC: 'Musique', OTHER: 'Autre'
})) };

type Screen = 'list' | 'filter' | 'search' | 'join';

export function Explorer({ onNavigate }: ExplorerProps) {
  const location = useLocation();
  const [screen, setScreen] = useState<Screen>(() => {
    return location.search.includes('screen=filter') ? 'filter' : 'list';
  });
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const [filterDate, setFilterDate] = useState('all');
  const [filterTime, setFilterTime] = useState('all');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterBudgetMax, setFilterBudgetMax] = useState(50000);
  const [filterCustomDate, setFilterCustomDate] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ date: 'all', time: 'all', categories: [] as string[], budgetMax: 50000, customDate: '' });

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.36536, 2.41833])
  const [mapGeoLoading, setMapGeoLoading] = useState(false)
  const [mapSearch, setMapSearch] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState<GeoPlace[]>([])

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

      return eventsApi.list({
        status: 'PUBLISHED',
        category: apiCategory || (appliedFilters.categories.length > 0 ? appliedFilters.categories.join(',') : undefined),
        search: searchQuery || undefined,
        limit: 50,
        maxPrice: appliedFilters.budgetMax < 50000 ? appliedFilters.budgetMax : undefined,
        date: dateParam,
        time: appliedFilters.time !== 'all' ? appliedFilters.time : undefined,
      }).then((r) => r.data);
    },
  });

  // Backend now handles custom date filtering
  // If "En cours" is selected, additionally filter client-side to events that have started
  const allFetchedEvents: Event[] = eventsData?.data || [];
  const events: Event[] = isEnCours
    ? allFetchedEvents.filter(e => {
        const now = new Date();
        const start = new Date(e.startAt);
        const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 4 * 60 * 60 * 1000); // assume 4h duration
        return start <= now && now <= end;
      })
    : allFetchedEvents;

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
    setAppliedFilters({ date: filterDate, time: filterTime, categories: filterCategories, budgetMax: filterBudgetMax, customDate: filterCustomDate });
    setScreen('list');
  };

  const resetFilters = () => {
    setFilterDate('all');
    setFilterTime('all');
    setFilterCategories([]);
    setFilterBudgetMax(50000);
    setFilterCustomDate('');
  };

  // ── FILTER SCREEN ─────────────────────────────────────────────────────────
  if (screen === 'filter') {
    return (
      <div className="w-full h-full bg-white flex flex-col">
        {/* Header */}
        <div className="px-5 pt-4 pt-safe-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <button onClick={() => setScreen('list')} className="w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <span className="text-[15px] font-semibold text-gray-900">Filtrer</span>
            <div className="w-8" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6" style={{ scrollbarWidth: 'none' }}>
          {/* Date */}
          <div>
            <h3 className="text-[14px] font-bold text-gray-900 mb-3">Date</h3>
            <div className="flex flex-wrap gap-2">
              {DATE_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterDate(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    filterDate === f.key
                      ? 'bg-[#FF9F1C] text-white border-[#FF9F1C]'
                      : 'bg-white text-gray-600 border-gray-200'
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
                className="mt-3 w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] text-gray-700 focus:outline-none focus:border-[#FF9F1C]"
              />
            )}
          </div>

          {/* Moment */}
          <div>
            <h3 className="text-[14px] font-bold text-gray-900 mb-3">Moment</h3>
            <div className="flex flex-wrap gap-2">
              {TIME_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterTime(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    filterTime === f.key
                      ? 'bg-[#FF9F1C] text-white border-[#FF9F1C]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Catégorie */}
          <div>
            <h3 className="text-[14px] font-bold text-gray-900 mb-3">Catégorie</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES_FILTER.map(cat => {
                const selected = filterCategories.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggleFilterCategory(cat.key)}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all flex items-center gap-1 ${
                      selected
                        ? 'bg-[#FF9F1C] text-white border-[#FF9F1C]'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-gray-900">Budget</h3>
              <span className="text-[13px] text-gray-500">
                0 – {filterBudgetMax === 50000 ? '50 000' : filterBudgetMax.toLocaleString('fr-FR')} F CFA
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50000}
              step={500}
              value={filterBudgetMax}
              onChange={e => setFilterBudgetMax(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #FF9F1C 0%, #FF9F1C ${(filterBudgetMax / 50000) * 100}%, #e5e7eb ${(filterBudgetMax / 50000) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>

          {/* Distance */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-gray-900">Distance</h3>
              <span className="text-[13px] text-gray-500">N'importe quelle distance</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              defaultValue={100}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ background: 'linear-gradient(to right, #FF9F1C 0%, #FF9F1C 100%, #e5e7eb 100%, #e5e7eb 100%)' }}
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="border-t border-gray-100 px-5 py-4 flex gap-3">
          <button
            onClick={resetFilters}
            className="flex-1 py-3.5 rounded-full border border-gray-200 text-[14px] font-bold text-gray-700"
          >
            Réinitialiser
          </button>
          <button
            onClick={applyFilters}
            className="flex-[2] py-3.5 rounded-full bg-[#FF9F1C] text-[14px] font-bold text-white"
          >
            Appliquer les filtres
          </button>
        </div>
        <div className="flex justify-center pb-2">
          <div className="w-32 h-[5px] bg-black rounded-full" />
        </div>
      </div>
    );
  }

  // ── SEARCH SCREEN ─────────────────────────────────────────────────────────
  if (screen === 'search') {
    return (
      <div className="w-full h-full bg-white flex flex-col">
        <div className="px-5 pt-4 pt-safe-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen('list')} className="w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <span className="text-[15px] font-semibold text-gray-900">Rechercher</span>
            <div className="w-8" />
          </div>

          {/* Location search */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
            <MapPin className="w-4 h-4 text-[#FF9F1C] flex-shrink-0" />
            <input
              autoFocus
              placeholder="Ville, quartier..."
              className="flex-1 text-[14px] outline-none"
            />
            <button><X className="w-4 h-4 text-gray-400" /></button>
          </div>

          {/* Event keyword search */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Concert, sortie, fête..."
              className="flex-1 text-[14px] outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4">
          {searchQuery.length < 2 ? (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-4">Suggestions</p>
              {['Position actuelle', 'Cotonou, BJ', 'Abomey-Calavi, BJ', 'Porto-Novo, BJ', 'Bohicon, BJ'].map(loc => (
                <button
                  key={loc}
                  className="w-full flex items-center gap-3 py-2.5"
                  onClick={() => setSearchQuery(loc)}
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-[14px] text-gray-700">{loc}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase())).map(event => (
                <button
                  key={event.id}
                  className="w-full flex items-center gap-3 py-2.5"
                  onClick={() => onNavigate('event-details', event.id)}
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-[14px] text-gray-700">{event.title}</span>
                </button>
              ))}
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
        <div className="px-5 pt-4 pt-safe-4 pb-3 flex items-center gap-3">
          <button onClick={() => setScreen('list')} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Rejoindre</h2>
        </div>

        <div className="flex-1 px-5 pt-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Lock className="w-8 h-8 text-[#FF9F1C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">Événement Privé</h3>
          <p className="text-gray-500 text-center mb-10 text-[15px] leading-relaxed max-w-[280px]">
            Entrez le code d'accès partagé par l'organisateur pour rejoindre cet événement.
          </p>

          <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">Code d'accès</label>
            <input
              type="text"
              placeholder="Ex: a1b2c3d4"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-center text-2xl tracking-widest font-mono font-bold text-gray-900 focus:outline-none focus:border-[#FF9F1C] focus:ring-2 focus:ring-orange-200 transition-all uppercase"
            />
          </div>

          <button
            onClick={async () => {
              if (!joinCode) return;
              setIsJoining(true);
              try {
                // We'll just call the API directly here for simplicity
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/events/join-by-code/${joinCode}`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                
                if (res.ok) {
                  setScreen('list');
                  setJoinCode('');
                  // If it's payment required, navigate to pay. Or just navigate to event details and let it handle it.
                  onNavigate('event-details', data.eventId || data.id);
                } else {
                  alert(data.message || data.error || 'Erreur lors de la tentative.');
                }
              } catch (e) {
                alert('Erreur réseau.');
              } finally {
                setIsJoining(false);
              }
            }}
            disabled={!joinCode || isJoining}
            className="w-full py-4 rounded-full font-bold text-white shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #FF9F1C, #FF9F1C)' }}
          >
            {isJoining ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Rejoindre l\'événement'}
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN LIST SCREEN ───────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-white flex flex-col">

        {/* Header & Search Bar */}
        <div className="bg-white px-5 pt-4 pt-safe-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex-1 bg-gray-50 rounded-full flex items-center px-4 py-2.5 cursor-text"
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
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-700" />
            </button>
            <button
              onClick={() => {
                hapticFeedback.impact()
                setViewMode(viewMode === 'list' ? 'map' : 'list')
              }}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center transition-colors bg-white hover:bg-gray-50 active:bg-gray-100"
            >
              <MapPin className={`w-4 h-4 ${viewMode === 'map' ? 'text-[#FF9F1C]' : 'text-gray-700'}`} />
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
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-medium transition-colors flex-shrink-0 ${
                selectedCategory === category
                  ? category === 'EN_COURS'
                    ? 'bg-red-500 text-white'
                    : 'bg-[#FF9F1C] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {CATEGORY_CHIP_LABELS[category] || CATEGORY_LABELS[category] || category}
            </button>
          ))}
        </div>
      </div>

      {/* Applied filters badge */}
      {(appliedFilters.date !== 'all' || appliedFilters.time !== 'all' || appliedFilters.categories.length > 0 || appliedFilters.budgetMax < 50000) && (
        <div className="px-5 pb-2 pt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[#FF9F1C] font-semibold">Filtres actifs :</span>
          {appliedFilters.date !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-[#FF9F1C] font-medium">
              {appliedFilters.date === 'pick' && appliedFilters.customDate
                ? new Date(appliedFilters.customDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                : DATE_FILTERS.find(f => f.key === appliedFilters.date)?.label ?? appliedFilters.date}
            </span>
          )}
          {appliedFilters.time !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-[#FF9F1C] font-medium">
              {TIME_FILTERS.find(f => f.key === appliedFilters.time)?.label ?? appliedFilters.time}
            </span>
          )}
          {appliedFilters.categories.map(c => (
            <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-[#FF9F1C] font-medium">
              {CATEGORIES_FILTER.find(cf => cf.key === c)?.label ?? c}
            </span>
          ))}
          {appliedFilters.budgetMax < 50000 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-[#FF9F1C] font-medium">
              ≤ {appliedFilters.budgetMax.toLocaleString('fr-FR')} F
            </span>
          )}
          <button
            onClick={() => {
              setFilterDate('all'); setFilterTime('all'); setFilterCategories([]);
              setFilterBudgetMax(50000); setFilterCustomDate('');
              setAppliedFilters({ date: 'all', time: 'all', categories: [], budgetMax: 50000, customDate: '' });
            }}
            className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium"
          >
            × Tout effacer
          </button>
        </div>
      )}

        {/* Content (List or Map) */}
        {viewMode === 'map' ? (
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#FF9F1C]" />
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
          <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-4 pb-20">
            {isLoading ? (
              // ── Skeleton loaders — prevent layout shift ──────────────────
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-3xl p-3 flex gap-4 shadow-sm animate-pulse">
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
                <p className="text-gray-500">Aucun événement trouvé.</p>
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


