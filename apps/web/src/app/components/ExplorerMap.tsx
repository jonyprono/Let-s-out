import { useState, useMemo } from 'react'
import { Loader2, Navigation, X, MapPin } from 'lucide-react'
import L from 'leaflet'
import '@/lib/leaflet-init'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { SafeImage } from '@/components/shared/SafeImage'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Event } from '@/features/events/api'
import { getEventParticipationMode } from '@/lib/utils'

interface ExplorerMapProps {
  events: Event[]
  mapCenter: [number, number]
  mapGeoLoading: boolean
  onGeolocate: () => void
  onNavigate: (screen: string, id?: string) => void
}

/** Cluster events by proximity (roughly 0.03° ≈ 3 km at equator) */
function clusterEvents(events: Event[], zoom: number): Array<{
  lat: number
  lon: number
  events: Event[]
}> {
  const radius = zoom >= 15 ? 0.005 : zoom >= 13 ? 0.02 : 0.05
  const clusters: Array<{ lat: number; lon: number; events: Event[] }> = []
  const used = new Set<string>()

  for (const event of events) {
    if (used.has(event.id) || !event.latitude || !event.longitude) continue
    const cluster = { lat: event.latitude, lon: event.longitude, events: [event] }
    used.add(event.id)

    for (const other of events) {
      if (used.has(other.id) || !other.latitude || !other.longitude) continue
      const dlat = Math.abs(other.latitude - event.latitude)
      const dlon = Math.abs(other.longitude - event.longitude)
      if (dlat < radius && dlon < radius) {
        cluster.events.push(other)
        used.add(other.id)
      }
    }
    clusters.push(cluster)
  }
  return clusters
}

/** Custom map marker matching the mockup */
function makePinIcon(count: number, isSelected: boolean) {
  const scale = isSelected ? 1.15 : 1;
  const shadow = isSelected
    ? 'drop-shadow(0 4px 12px rgba(255,122,0,0.5))'
    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))';
  
  const text = count === 1 ? '1 événement' : `${count} événements`;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        transform: scale(${scale});
        transform-origin: bottom center;
        filter: ${shadow};
        transition: transform 0.15s;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        position: relative;
      ">
        <span style="
          color: #FF7A00;
          font-weight: 600;
          font-size: 13px;
          font-family: 'Poppins', sans-serif;
          white-space: nowrap;
          margin-bottom: 2px;
          text-shadow: 0px 1px 2px rgba(255,255,255,0.8);
        ">${text}</span>
        <svg width="32" height="40" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.059 0 0 8.059 0 18C0 27.405 16.2 43.2 17.1 44.1C17.55 44.55 18.45 44.55 18.9 44.1C19.8 43.2 36 27.405 36 18C36 8.059 27.941 0 18 0Z" fill="#FF7A00"/>
          <circle cx="18" cy="18" r="7" fill="white"/>
        </svg>
      </div>`,
    iconSize: [80, 64],
    iconAnchor: [40, 64],
  });
}

/** Listen to map zoom/click changes */
function ZoomWatcher({ onZoom, onMapClick }: { onZoom: (z: number) => void; onMapClick: () => void }) {
  useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
    click: () => onMapClick(),
  })
  return null
}

/** Compact event mini-card shown at bottom of map when a pin is tapped */
function EventMiniCard({
  event,
  onNavigate,
  onClose,
}: {
  event: Event
  onNavigate: (s: string, id?: string) => void
  onClose: () => void
}) {
  const dateStr = event.startAt
    ? format(new Date(event.startAt), "EEEE d MMM 'à' HH'h'mm", { locale: fr })
    : ''
  const location = [event.city, event.address].filter(Boolean).join(' • ')
  const participationMode = getEventParticipationMode(event as any)
  const price = participationMode === 'Gratuit'
    ? 'Gratuit'
    : participationMode === 'Cagnotte'
      ? 'Cagnotte'
      : event.price
        ? `${Number(event.price).toLocaleString('fr-FR')} F`
        : participationMode
  const isFree = participationMode === 'Gratuit'

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] px-4 pb-6 pt-3"
      style={{ pointerEvents: 'all' }}
    >
      <div className="bg-white rounded-[20px] shadow-2xl overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center z-10 active:scale-90"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>

        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div className="w-[90px] h-[80px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
            <SafeImage
              src={event.coverUrl}
              alt={event.title}
              className="w-full h-full"
              fallback={
                <div className="w-full h-full"
                  style={{ backgroundImage: `repeating-conic-gradient(#e5e7eb 0% 25%, #f3f4f6 0% 50%)`, backgroundSize: '16px 16px' }}
                />
              }
            />
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
            <div>
              <h3 className="text-[14px] font-bold text-gray-900 leading-tight truncate">{event.title}</h3>
              <p className="text-[12px] text-gray-500 mt-0.5 capitalize">{dateStr}</p>
              {location && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-[12px] text-gray-500 truncate">{location}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              {/* Participants */}
              <div className="flex items-center gap-1">
                {((event as any).bookings || []).slice(0, 3).map((b: any, i: number) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-gray-200"
                    style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}
                  >
                    {b?.user?.profile?.avatarUrl ? (
                      <SafeImage src={b.user.profile.avatarUrl} alt="" className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-orange-200" />
                    )}
                  </div>
                ))}
                <span className="text-[11px] text-gray-500 ml-1">
                  {(event.currentAttendees || 0) > 0
                    ? `+${event.currentAttendees} Participants`
                    : 'Aucun inscrit'}
                </span>
              </div>
              {/* Price */}
              <span
                className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${isFree ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'}`}
              >
                {price}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => onNavigate('event-details', event.id)}
          className="w-full bg-action-primary text-white text-[13px] font-bold py-3 active:opacity-80"
        >
          Voir les détails
        </button>
      </div>
    </div>
  )
}

export default function ExplorerMap({
  events,
  mapCenter,
  mapGeoLoading,
  onGeolocate,
  onNavigate,
}: ExplorerMapProps) {
  const [selectedCluster, setSelectedCluster] = useState<Event[] | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [zoom, setZoom] = useState(13)

  const validEvents = events.filter((e) => e.latitude && e.longitude)
  const clusters = useMemo(() => clusterEvents(validEvents, zoom), [validEvents, zoom])

  const handleClusterClick = (clusterEvents: Event[]) => {
    if (clusterEvents.length === 1) {
      setSelectedEvent(clusterEvents[0])
      setSelectedCluster(null)
    } else {
      setSelectedCluster(clusterEvents)
      setSelectedEvent(null)
    }
  }

  const closeCard = () => {
    setSelectedEvent(null)
    setSelectedCluster(null)
  }

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer
        key={`${mapCenter[0]}-${mapCenter[1]}`}
        center={mapCenter}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <ZoomWatcher onZoom={setZoom} onMapClick={closeCard} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        {clusters.map((cluster, i) => {
          const isSelected =
            (selectedEvent && cluster.events.some((e) => e.id === selectedEvent.id)) ||
            (selectedCluster && cluster.events[0]?.id === selectedCluster[0]?.id)
          return (
            <Marker
              key={i}
              position={[cluster.lat, cluster.lon]}
              icon={makePinIcon(cluster.events.length, !!isSelected)}
              eventHandlers={{ click: () => handleClusterClick(cluster.events) }}
            />
          )
        })}
      </MapContainer>

      {/* Bottom mini-card — single event */}
      {selectedEvent && (
        <EventMiniCard
          event={selectedEvent}
          onNavigate={onNavigate}
          onClose={closeCard}
        />
      )}

      {/* Bottom mini-card — cluster: show first event with count */}
      {selectedCluster && !selectedEvent && (
        <EventMiniCard
          event={selectedCluster[0]}
          onNavigate={onNavigate}
          onClose={closeCard}
        />
      )}

      {/* Geolocate FAB */}
      <button
        onClick={onGeolocate}
        disabled={mapGeoLoading}
        className={`absolute z-[900] w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform ${selectedEvent || selectedCluster ? 'bottom-52 right-4' : 'bottom-8 right-4'}`}
      >
        {mapGeoLoading
          ? <Loader2 className="w-5 h-5 animate-spin text-action-primary" />
          : <Navigation className="w-5 h-5 text-action-primary" />}
      </button>
    </div>
  )
}
