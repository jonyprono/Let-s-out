import { useState } from 'react'
import { Loader2, Navigation, X } from 'lucide-react'
import L from 'leaflet'
import '@/lib/leaflet-init'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { EventCard } from '@/components/shared/EventCard'
import type { Event } from '@/features/events/api'


interface ExplorerMapProps {
  events: Event[]
  mapCenter: [number, number]
  mapGeoLoading: boolean
  onGeolocate: () => void
  onNavigate: (screen: string, id?: string) => void
}

export default function ExplorerMap({
  events,
  mapCenter,
  mapGeoLoading,
  onGeolocate,
  onNavigate,
}: ExplorerMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const createCustomIcon = (isSelected: boolean) => {
    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div class="relative flex flex-col items-center transition-transform ${isSelected ? 'scale-125' : 'scale-100'}">
          <div class="w-10 h-10 relative flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">
              <path d="M12 21.5C12 21.5 20.5 15.5 20.5 9.5C20.5 4.80558 16.6944 1 12 1C7.30558 1 3.5 4.80558 3.5 9.5C3.5 15.5 12 21.5 12 21.5Z" fill="#FF7A00"/>
              <circle cx="12" cy="9.5" r="3.5" fill="white"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    })
  }

  return (
    <div className="flex-1 relative z-0 w-full h-full">
      <MapContainer
        key={`${mapCenter[0]}-${mapCenter[1]}`}
        center={mapCenter}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {events.filter(e => e.latitude && e.longitude).map((event) => (
          <Marker 
            key={event.id} 
            position={[event.latitude!, event.longitude!]} 
            icon={createCustomIcon(selectedEvent?.id === event.id)}
            eventHandlers={{
              click: () => {
                setSelectedEvent(event)
              }
            }}
          />
        ))}
      </MapContainer>

      {/* Floating Event Card at the bottom when an event is selected */}
      {selectedEvent && (
        <div className="absolute bottom-24 left-0 right-0 px-5 z-[1000] animate-in slide-in-from-bottom-8 duration-300">
          <div className="relative">
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center z-10 active:scale-95"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <EventCard event={selectedEvent} onNavigate={onNavigate} />
          </div>
        </div>
      )}

      {/* Locate me */}
      <button
        onClick={onGeolocate}
        disabled={mapGeoLoading}
        className="absolute bottom-32 right-5 z-[900] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        {mapGeoLoading
          ? <Loader2 className="w-5 h-5 animate-spin text-action-primary" />
          : <Navigation className="w-5 h-5 text-action-primary" />}
      </button>
    </div>
  )
}
