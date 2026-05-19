/**
 * ExplorerMap — lazy-loaded Leaflet map component.
 * This file is loaded ONLY when the user switches to map view in Explorer,
 * saving ~150 KB from the initial JS bundle.
 */
import { MapPin, Search, X, Loader2, Navigation } from 'lucide-react'
import '@/lib/leaflet-init'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { SafeImage } from '@/components/shared/SafeImage'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Event } from '@/features/events/api'
import type { GeoPlace } from '@/lib/geo'

interface ExplorerMapProps {
  events: Event[]
  mapCenter: [number, number]
  mapSearch: string
  mapSearchResults: GeoPlace[]
  mapGeoLoading: boolean
  onMapSearch: (q: string) => void
  onClearSearch: () => void
  onSelectSearchResult: (r: GeoPlace) => void
  onGeolocate: () => void
  onNavigate: (screen: string, id?: string) => void
}

export default function ExplorerMap({
  events,
  mapCenter,
  mapSearch,
  mapSearchResults,
  mapGeoLoading,
  onMapSearch,
  onClearSearch,
  onSelectSearchResult,
  onGeolocate,
  onNavigate,
}: ExplorerMapProps) {
  return (
    <div className="flex-1 relative z-0">
      <MapContainer
        key={`${mapCenter[0]}-${mapCenter[1]}`}
        center={mapCenter}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {events.filter(e => e.latitude && e.longitude).map((event) => (
          <Marker key={event.id} position={[event.latitude!, event.longitude!]}>
            <Popup className="rounded-xl overflow-hidden shadow-sm">
              <div className="w-[200px] flex flex-col gap-2 p-1">
                <SafeImage
                  src={event.coverUrl}
                  alt={event.title}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <h3 className="font-bold text-gray-900 text-[13px] leading-tight mt-1">{event.title}</h3>
                <p className="text-[11px] text-gray-500">{format(new Date(event.startAt), 'EEE d MMM, HH:mm', { locale: fr })}</p>
                <button
                  onClick={() => onNavigate('event-details', event.id)}
                  className="mt-1 w-full bg-[#9747FF] text-white text-[11px] font-bold py-1.5 rounded-full"
                >
                  Voir les détails
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Search overlay */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 flex items-center px-4 py-3">
          <Search className="w-4 h-4 text-[#9747FF] mr-2 shrink-0" />
          <input
            value={mapSearch}
            onChange={e => onMapSearch(e.target.value)}
            placeholder="Rechercher un lieu sur la carte..."
            className="flex-1 outline-none text-[14px] bg-transparent text-gray-900 placeholder:text-gray-400"
          />
          {mapSearch && (
            <button onClick={onClearSearch} className="ml-2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        {mapSearchResults.length > 0 && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-100">
            {mapSearchResults.map((r, i) => (
              <button key={i} onClick={() => onSelectSearchResult(r)}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#9747FF] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-gray-900 truncate">{r.name || r.label.split(',')[0]}</span>
                  <span className="text-[11px] text-gray-400 truncate">{r.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Locate me */}
      <button
        onClick={onGeolocate}
        disabled={mapGeoLoading}
        className="absolute bottom-6 right-4 z-[1000] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        {mapGeoLoading
          ? <Loader2 className="w-5 h-5 animate-spin text-[#9747FF]" />
          : <Navigation className="w-5 h-5 text-[#9747FF]" />}
      </button>
    </div>
  )
}
