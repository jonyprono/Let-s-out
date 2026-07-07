import { useState, useMemo, useEffect } from 'react'
import { Loader2, Navigation, X } from 'lucide-react'
import L from 'leaflet'
import '@/lib/leaflet-init'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Event } from '@/features/events/api'
import { EventCard } from '@/components/shared/EventCard'

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
function makePinIcon(events: Event[], isSelected: boolean) {
  const count = events.length;
  const scale = isSelected ? 1.15 : 1;
  const shadow = isSelected
    ? 'drop-shadow(0 4px 12px rgba(255,122,0,0.5))'
    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))';
  
  if (count > 1) {
    const text = `${count} événements`;
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
            color: var(--brand-orange-500, #FF7A00);
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

  // Marqueur individuel avec label (carte)
  const ev = events[0];
  let dateStr = 'Bientôt';
  if (ev.startAt) {
    const dateObj = new Date(ev.startAt);
    dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

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
        <div style="
          background: white; 
          border-radius: 8px; 
          padding: 6px 10px; 
          margin-bottom: 4px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
          display: flex; 
          flex-direction: column; 
          align-items: flex-start; 
          max-width: 200px;
        ">
          <span style="font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 13px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${ev.title || 'Événement'}</span>
          <span style="font-family: 'Poppins', sans-serif; font-size: 11px; color: #6B7280; white-space: nowrap;">
            ${dateStr} • ${(ev.currentAttendees || 0)} participants
          </span>
        </div>
        <svg width="32" height="40" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.059 0 0 8.059 0 18C0 27.405 16.2 43.2 17.1 44.1C17.55 44.55 18.45 44.55 18.9 44.1C19.8 43.2 36 27.405 36 18C36 8.059 27.941 0 18 0Z" fill="#FF7A00"/>
          <circle cx="18" cy="18" r="7" fill="white"/>
        </svg>
      </div>`,
    iconSize: [200, 100],
    iconAnchor: [100, 100],
  });
}

/** Listen to map zoom/click changes */
function ZoomWatcher({ onZoom, onMapClick, zoomTarget }: { onZoom: (z: number) => void; onMapClick: () => void; zoomTarget?: {lat: number; lon: number; id: number} | null }) {
  const map = useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
    click: () => onMapClick(),
  })
  useEffect(() => {
    if (zoomTarget) {
      const currentZoom = map.getZoom();
      map.flyTo([zoomTarget.lat, zoomTarget.lon], currentZoom + 2, { duration: 0.5 });
    }
  }, [zoomTarget, map]);
  
  return null
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
  const [zoomTarget, setZoomTarget] = useState<{lat: number; lon: number; id: number} | null>(null)

  const validEvents = events.filter((e) => e.latitude && e.longitude)
  const clusters = useMemo(() => clusterEvents(validEvents, zoom), [validEvents, zoom])

  const handleClusterClick = (clusterEvents: Event[], lat: number, lon: number) => {
    if (clusterEvents.length === 1) {
      setSelectedEvent(clusterEvents[0])
      setSelectedCluster(null)
    } else {
      // Zoom into the cluster instead of just selecting it
      setZoomTarget({ lat, lon, id: Date.now() })
      setSelectedCluster(null)
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
        <ZoomWatcher onZoom={setZoom} onMapClick={closeCard} zoomTarget={zoomTarget} />
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
              icon={makePinIcon(cluster.events, !!isSelected)}
              eventHandlers={{ click: () => handleClusterClick(cluster.events, cluster.lat, cluster.lon) }}
            />
          )
        })}
      </MapContainer>

      {/* Bottom full card — single event */}
      {selectedEvent && (
        <div className="absolute bottom-20 left-0 right-0 z-[1000] px-5" style={{ pointerEvents: 'all' }}>
          <div className="relative" onClick={() => onNavigate('event-details', selectedEvent.id)}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeCard();
              }}
              className="absolute top-4 right-4 w-7 h-7 bg-white dark:bg-[#1A1A1A]/80 backdrop-blur rounded-full flex items-center justify-center z-20 active:scale-90 shadow-sm border border-gray-100 dark:border-white/10"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <EventCard
              name={selectedEvent.title}
              datetime={selectedEvent.startAt ? new Date(selectedEvent.startAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(selectedEvent.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
              city={selectedEvent.city || ''}
              place={selectedEvent.address || ''}
              attendeesCount={`${selectedEvent.currentAttendees || 0} Participants`}
              price={selectedEvent.price === 0 ? "Gratuit" : `${selectedEvent.price} ${selectedEvent.currency || 'CFA'}`}
              cover={true}
            />
          </div>
        </div>
      )}

      {/* Bottom full card — cluster: show first event */}
      {selectedCluster && !selectedEvent && (
        <div className="absolute bottom-20 left-0 right-0 z-[1000] px-5" style={{ pointerEvents: 'all' }}>
          <div className="relative" onClick={() => onNavigate('event-details', selectedCluster[0].id)}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeCard();
              }}
              className="absolute top-4 right-4 w-7 h-7 bg-white dark:bg-[#1A1A1A]/80 backdrop-blur rounded-full flex items-center justify-center z-20 active:scale-90 shadow-sm border border-gray-100 dark:border-white/10"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <EventCard
              name={selectedCluster[0].title}
              datetime={selectedCluster[0].startAt ? new Date(selectedCluster[0].startAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(selectedCluster[0].startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
              city={selectedCluster[0].city || ''}
              place={selectedCluster[0].address || ''}
              attendeesCount={`${selectedCluster[0].currentAttendees || 0} Participants`}
              price={selectedCluster[0].price === 0 ? "Gratuit" : `${selectedCluster[0].price} ${selectedCluster[0].currency || 'CFA'}`}
              cover={true}
            />
          </div>
        </div>
      )}

      {/* Geolocate FAB */}
      <button
        onClick={onGeolocate}
        disabled={mapGeoLoading}
        className={`absolute z-[900] w-11 h-11 bg-white dark:bg-[#1A1A1A] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform ${selectedEvent || selectedCluster ? 'bottom-52 right-4' : 'bottom-8 right-4'}`}
      >
        {mapGeoLoading
          ? <Loader2 className="w-5 h-5 animate-spin text-action-primary" />
          : <Navigation className="w-5 h-5 text-action-primary" />}
      </button>
    </div>
  )
}
