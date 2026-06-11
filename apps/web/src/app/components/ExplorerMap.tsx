/**
 * ExplorerMap — lazy-loaded Leaflet map component.
 * This file is loaded ONLY when the user switches to map view in Explorer,
 * saving ~150 KB from the initial JS bundle.
 */
import { MapPin, Search, X, Loader2, Navigation } from 'lucide-react'
import L from 'leaflet'
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
  const createCustomIcon = () => {
    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div class="relative flex flex-col items-center">
          <div class="w-8 h-8 relative">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">
              <path d="M12 21.5C12 21.5 20.5 15.5 20.5 9.5C20.5 4.80558 16.6944 1 12 1C7.30558 1 3.5 4.80558 3.5 9.5C3.5 15.5 12 21.5 12 21.5Z" fill="#FF7A00"/>
              <circle cx="12" cy="9.5" r="3.5" fill="white"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  }

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
          <Marker key={event.id} position={[event.latitude!, event.longitude!]} icon={createCustomIcon()}>
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
                  className="mt-1 w-full bg-action-primary text-white text-[11px] font-bold py-1.5 rounded-full"
                >
                  Voir les détails
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>



      {/* Locate me */}
      <button
        onClick={onGeolocate}
        disabled={mapGeoLoading}
        className="absolute bottom-6 right-4 z-[1000] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        {mapGeoLoading
          ? <Loader2 className="w-5 h-5 animate-spin text-action-primary" />
          : <Navigation className="w-5 h-5 text-action-primary" />}
      </button>
    </div>
  )
}
