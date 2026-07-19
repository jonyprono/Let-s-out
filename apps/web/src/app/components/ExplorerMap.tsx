import { useState, useMemo, useEffect, useCallback } from 'react'
import { Loader2, Navigation } from 'lucide-react'
import L from 'leaflet'
import '@/lib/leaflet-init'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Event } from '@/features/events/api'
import { RowEventCard } from '@/components/ui/event-cards-v2'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ExplorerMapProps {
  events: Event[]
  mapCenter: [number, number]
  mapGeoLoading: boolean
  onGeolocate: () => void
  onNavigate: (screen: string, id?: string) => void
  onSwitchToList?: () => void
}

/** Cluster events by proximity */
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

/** Format label sub-line based on event status & date */
function getEventSubLabel(ev: Event): string {
  const now = new Date()
  if (!ev.startAt) return `${ev.currentAttendees || 0} participants`

  const start = new Date(ev.startAt)
  const end = (ev as any).endAt ? new Date((ev as any).endAt) : null

  // En cours
  if (start <= now && (!end || end >= now)) {
    return `En cours • ${ev.currentAttendees || 0} participants`
  }

  // Today
  if (start.toDateString() === now.toDateString()) {
    const time = format(start, "HH'h'mm", { locale: fr })
    return `Aujourd'hui à ${time} • ${ev.currentAttendees || 0} participants`
  }

  // Tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (start.toDateString() === tomorrow.toDateString()) {
    return `Demain • ${ev.currentAttendees || 0} participants`
  }

  // Next monday or specific day
  const dayStr = format(start, 'dd MMM', { locale: fr })
  return `${dayStr} • ${ev.currentAttendees || 0} participants`
}

/** Custom orange pin icon with label bubble */
function makePinIcon(events: Event[], isSelected: boolean) {
  const count = events.length
  const scale = isSelected ? 1.1 : 1
  const shadow = isSelected
    ? 'drop-shadow(0 4px 14px rgba(255,122,0,0.55))'
    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.22))'

  if (count > 1) {
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
        ">
          <div style="
            background: white;
            border-radius: 10px;
            padding: 5px 10px;
            margin-bottom: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.12);
            white-space: nowrap;
          ">
            <span style="font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 12px; color: #111827;">${count} événements</span>
          </div>
          <svg width="30" height="38" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.059 0 0 8.059 0 18C0 27.405 16.2 43.2 17.1 44.1C17.55 44.55 18.45 44.55 18.9 44.1C19.8 43.2 36 27.405 36 18C36 8.059 27.941 0 18 0Z" fill="${isSelected ? '#E06A00' : '#FF7A00'}"/>
            <circle cx="18" cy="18" r="7" fill="white"/>
          </svg>
        </div>`,
      iconSize: [120, 70],
      iconAnchor: [60, 70],
    })
  }

  // Single event pin with label
  const ev = events[0]
  const title = (ev.title || 'Événement').slice(0, 24) + (ev.title?.length > 24 ? '…' : '')
  const subLabel = getEventSubLabel(ev)
  const isOngoing = subLabel.startsWith('En cours')

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
      ">
        <div style="
          background: white;
          border-radius: 10px;
          padding: 6px 10px;
          margin-bottom: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          max-width: 190px;
          border: ${isSelected ? '1.5px solid #FF7A00' : '1px solid rgba(0,0,0,0.06)'};
        ">
          <div style="font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 13px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
          <div style="font-family: 'Inter', sans-serif; font-size: 11px; color: ${isOngoing ? '#FF7A00' : '#6B7280'}; white-space: nowrap; margin-top: 1px;">${isOngoing ? '<span style="color:#FF7A00">En cours</span>' + subLabel.slice(8) : subLabel}</div>
        </div>
        <svg width="28" height="36" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.059 0 0 8.059 0 18C0 27.405 16.2 43.2 17.1 44.1C17.55 44.55 18.45 44.55 18.9 44.1C19.8 43.2 36 27.405 36 18C36 8.059 27.941 0 18 0Z" fill="${isSelected ? '#E06A00' : '#FF7A00'}"/>
          <circle cx="18" cy="18" r="7" fill="white"/>
        </svg>
      </div>`,
    iconSize: [200, 90],
    iconAnchor: [100, 90],
  })
}

/** Listen to map zoom/click */
function ZoomWatcher({
  onZoom,
  onMapClick,
  zoomTarget,
}: {
  onZoom: (z: number) => void
  onMapClick: () => void
  zoomTarget?: { lat: number; lon: number; id: number } | null
}) {
  const map = useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
    click: () => onMapClick(),
  })
  useEffect(() => {
    if (zoomTarget) {
      const currentZoom = map.getZoom()
      map.flyTo([zoomTarget.lat, zoomTarget.lon], currentZoom + 2, { duration: 0.5 })
    }
  }, [zoomTarget, map])
  return null
}

export default function ExplorerMap({
  events,
  mapCenter,
  mapGeoLoading,
  onGeolocate,
  onNavigate,
  onSwitchToList,
}: ExplorerMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [zoom, setZoom] = useState(13)
  const [zoomTarget, setZoomTarget] = useState<{ lat: number; lon: number; id: number } | null>(null)

  const validEvents = events.filter((e) => e?.latitude && e?.longitude)
  const clusters = useMemo(() => clusterEvents(validEvents, zoom), [validEvents, zoom])

  const handleClusterClick = useCallback((clusterEvts: Event[], lat: number, lon: number) => {
    if (clusterEvts.length === 1) {
      setSelectedEvent(clusterEvts[0])
    } else {
      setZoomTarget({ lat, lon, id: Date.now() })
      setSelectedEvent(null)
    }
  }, [])

  const closeCard = useCallback(() => {
    setSelectedEvent(null)
  }, [])

  const hasCard = !!selectedEvent

  return (
    <div className="absolute inset-0 z-0">
      {/* ── Map ── */}
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
            selectedEvent != null &&
            cluster.events.some((e) => e.id === selectedEvent.id)
          return (
            <Marker
              key={i}
              position={[cluster.lat, cluster.lon]}
              icon={makePinIcon(cluster.events, isSelected)}
              eventHandlers={{
                click: () => handleClusterClick(cluster.events, cluster.lat, cluster.lon),
              }}
            />
          )
        })}
      </MapContainer>

      {/* ── Switch to list button (top right) ── */}
      {onSwitchToList && (
        <button
          onClick={onSwitchToList}
          className="absolute top-4 right-4 z-[900] w-10 h-10 rounded-xl bg-[#FF7A00] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* ── Bottom event card ── */}
      {selectedEvent && (
        <div
          className="absolute left-0 right-0 z-[1000] px-4"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
            pointerEvents: 'all',
            animation: 'slideUpCard 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both',
          }}
        >
          {/* Close pill */}
          <div className="flex justify-center mb-2">
            <button
              onClick={closeCard}
              className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full active:scale-95 transition-transform"
            />
          </div>
          <RowEventCard
            event={selectedEvent}
            onClick={() => onNavigate('event-details', selectedEvent.id)}
          />
        </div>
      )}

      {/* ── Geolocate FAB ── */}
      <button
        onClick={onGeolocate}
        disabled={mapGeoLoading}
        className="absolute z-[900] w-11 h-11 bg-white dark:bg-[#1A1A1A] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all border border-gray-100 dark:border-white/10"
        style={{
          right: 16,
          bottom: hasCard
            ? 'calc(env(safe-area-inset-bottom, 0px) + 210px)'
            : 'calc(env(safe-area-inset-bottom, 0px) + 100px)',
          transition: 'bottom 0.2s ease',
        }}
      >
        {mapGeoLoading
          ? <Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" />
          : <Navigation className="w-5 h-5 text-[#FF7A00]" />}
      </button>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slideUpCard {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
