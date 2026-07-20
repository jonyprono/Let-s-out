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
  const isDeepZoom = zoom >= 15
  const radius = zoom >= 16 ? 0.0005 : zoom >= 14 ? 0.01 : 0.05
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

    if (isDeepZoom && cluster.events.length > 1) {
      // Spiderfy: spread identical/very close coordinates in a small circle
      const count = cluster.events.length
      cluster.events.forEach((ev, i) => {
        const angle = (i / count) * Math.PI * 2
        const offset = zoom >= 17 ? 0.00015 : 0.0003
        clusters.push({
          lat: cluster.lat + Math.cos(angle) * offset,
          lon: cluster.lon + Math.sin(angle) * offset,
          events: [ev]
        })
      })
    } else {
      clusters.push(cluster)
    }
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
          <svg width="23" height="32" viewBox="0 0 23 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clip-path="url(#clip0_889_3402)">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.4284 0C5.21653 0 0.185181 4.99311 0.185181 11.1724C0.185181 17.7931 5.01978 20.2759 8.44896 26.0138C10.6414 29.6828 9.99491 32 11.4284 32C12.9182 32 12.2717 29.6276 14.4079 26.0689C17.556 20.6345 22.6717 17.8207 22.6717 11.1724C22.6717 4.99311 17.6403 0 11.4284 0Z" fill="${isSelected ? '#E06A00' : '#FF7A00'}"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.4429 30.2702C11.2413 30.2702 11.1838 30.2136 10.8382 29.1674C10.5504 28.2627 10.1185 26.8772 8.99582 25.1808C7.90179 23.5126 6.75024 22.1554 5.65627 20.8548C3.09406 17.7447 1.05005 15.3129 1.05005 10.9305C1.07884 5.36038 5.71384 0.864746 11.4429 0.864746C17.1718 0.864746 21.8068 5.38866 21.8068 10.9305C21.8068 15.3129 19.7916 17.7729 17.2006 20.8831C16.1355 22.1837 15.0127 23.5409 13.9186 25.1808C12.8247 26.8489 12.364 28.2062 12.0762 29.1109C11.7307 30.2136 11.6444 30.2702 11.4429 30.2702Z" fill="#FF991C"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.4286 15.5674C13.8168 15.5674 15.7529 13.6313 15.7529 11.243C15.7529 8.85479 13.8168 6.9187 11.4286 6.9187C9.04033 6.9187 7.10425 8.85479 7.10425 11.243C7.10425 13.6313 9.04033 15.5674 11.4286 15.5674Z" fill="white"/>
            </g>
            <defs>
            <clipPath id="clip0_889_3402">
            <rect width="22.8571" height="32" fill="white"/>
            </clipPath>
            </defs>
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
        <svg width="23" height="32" viewBox="0 0 23 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#clip0_889_3402)">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11.4284 0C5.21653 0 0.185181 4.99311 0.185181 11.1724C0.185181 17.7931 5.01978 20.2759 8.44896 26.0138C10.6414 29.6828 9.99491 32 11.4284 32C12.9182 32 12.2717 29.6276 14.4079 26.0689C17.556 20.6345 22.6717 17.8207 22.6717 11.1724C22.6717 4.99311 17.6403 0 11.4284 0Z" fill="${isSelected ? '#E06A00' : '#FF7A00'}"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11.4429 30.2702C11.2413 30.2702 11.1838 30.2136 10.8382 29.1674C10.5504 28.2627 10.1185 26.8772 8.99582 25.1808C7.90179 23.5126 6.75024 22.1554 5.65627 20.8548C3.09406 17.7447 1.05005 15.3129 1.05005 10.9305C1.07884 5.36038 5.71384 0.864746 11.4429 0.864746C17.1718 0.864746 21.8068 5.38866 21.8068 10.9305C21.8068 15.3129 19.7916 17.7729 17.2006 20.8831C16.1355 22.1837 15.0127 23.5409 13.9186 25.1808C12.8247 26.8489 12.364 28.2062 12.0762 29.1109C11.7307 30.2136 11.6444 30.2702 11.4429 30.2702Z" fill="#FF991C"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11.4286 15.5674C13.8168 15.5674 15.7529 13.6313 15.7529 11.243C15.7529 8.85479 13.8168 6.9187 11.4286 6.9187C9.04033 6.9187 7.10425 8.85479 7.10425 11.243C7.10425 13.6313 9.04033 15.5674 11.4286 15.5674Z" fill="white"/>
          </g>
          <defs>
          <clipPath id="clip0_889_3402">
          <rect width="22.8571" height="32" fill="white"/>
          </clipPath>
          </defs>
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
      const targetZoom = Math.max(currentZoom + 2, 16)
      map.flyTo([zoomTarget.lat, zoomTarget.lon], targetZoom, { duration: 0.5 })
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
            bottom: '12px',
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
            ? '140px'
            : '20px',
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
