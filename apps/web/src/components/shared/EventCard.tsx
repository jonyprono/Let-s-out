import { useState, memo } from 'react';
import { Share2, Star, Lock, QrCode, X, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { type Event, eventsApi } from '@/features/events/api';
import { useQuery } from '@tanstack/react-query';
import { SafeImage } from '@/components/shared/SafeImage';
import { hapticFeedback } from '@/lib/haptics';
import { toast } from 'sonner';
import { useFavoritesStore } from '@/stores/favorites.store';
import { useAuthStore } from '@/stores/auth.store';
import { getEventParticipationMode } from '@/lib/utils';
import { ShareModal } from '@/components/shared/ShareModal';

interface EventCardProps {
  // Propriétés explicites exigées par la maquette
  name?: string;
  datetime?: string;
  city?: string;
  place?: string;
  attendeesCount?: string | number;
  price?: string;
  cover?: boolean | string; // URL ou true pour afficher la grille par défaut

  // Propriétés legacy pour la rétrocompatibilité
  event?: Event;
  onNavigate?: (screen: string, id?: string) => void;
  badge?: React.ReactNode;
  horizontal?: boolean;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).replace(/^\w/, c => c.toUpperCase()) + ' • ' +
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' GMT';
}

function formatPrice(event: any): string {
  const mode = getEventParticipationMode(event);
  if (mode !== 'Gratuit') return mode;
  if (event.price === 0) return 'Gratuit';
  
  // Devise : FCFA par défaut si non spécifiée
  const cur = event.currency || 'XOF';
  if (cur === 'XOF' || cur === 'CFA' || cur === 'FCFA') return `${Number(event.price).toLocaleString('fr-FR')} F CFA`;
  if (cur === 'EUR') return `${event.price} €`;
  return `${event.price} ${cur}`;
}

export const EventCard = memo(function EventCard({
  name,
  datetime,
  city,
  place,
  attendeesCount,
  price,
  cover = true,
  event,
  onNavigate,
  badge,
  horizontal = false,
}: EventCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const { user } = useAuthStore();
  const favorite = isFavorite(event.id);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const { data: fullEvent, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['events', event?.id],
    queryFn: () => event?.id ? eventsApi.getById(event.id) : Promise.reject('No event'),
    enabled: showQRModal && !!event && !event.joinCode,
  });

  const joinCode = event?.joinCode || fullEvent?.data?.joinCode;

  // Calcul dynamique des données (Priorité aux Props explicites, sinon fallback sur l'objet Event)
  const displayTitle = name || event?.title || '';
  const displayDate = datetime || (event?.startAt ? formatEventDate(event.startAt) : '');
  const displayCity = city || event?.city || '';
  const displayPlace = place || event?.address || '';
  const displayLocation = [displayCity, displayPlace].filter(Boolean).join(' • ');
  const displayPrice = price || (event ? formatPrice(event) : 'Gratuit');
  const displayCover = typeof cover === 'string' ? cover : event?.coverUrl;

  const attendees: any[] = event ? (event as any).bookings || [] : [];
  const count = event?.currentAttendees ?? 0;
  const max = event?.maxAttendees;
  const displayAttendeesCount = attendeesCount || (max ? `${count}/${max} Participants` : `${count} Participants`);

  const colors = ['#9747FF', 'var(--action-primary)', '#B070FF', 'var(--color-brand-orange-400)'];

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticFeedback.impact();
    setShowShareModal(true);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticFeedback.impact();
    if (favorite) {
      removeFavorite(event.id);
      toast.success('Retiré des favoris');
    } else {
      addFavorite(event);
      toast.success('Ajouté aux favoris');
    }
  };

  return (
    <button
      onClick={() => {
        hapticFeedback.impact();
        if (onNavigate && event?.id) onNavigate('event-details', event.id);
      }}
      className={`flex flex-col text-left transition-transform active:scale-[0.98] ${
        horizontal ? 'flex-shrink-0 mr-4' : 'mb-4'
      }`}
      style={{
        width: '358px',
        minHeight: '266px', // "Enserrer" autorise l'expansion si nécessaire, 266px de base
        borderRadius: '12px',
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #DFDFDF',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)', // Léger relief optionnel
        overflow: 'hidden'
      }}
    >
      {/* ── ZONE DE COUVERTURE ────────────────────────────────────────── */}
      <div className="relative w-full bg-[#F5F5F5] overflow-hidden" style={{ height: '148px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
        {displayCover ? (
          <SafeImage
            src={displayCover}
            alt={displayTitle}
            className="w-full h-full object-cover"
            fallback={
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `linear-gradient(45deg, #E5E5E5 25%, transparent 25%, transparent 75%, #E5E5E5 75%, #E5E5E5), linear-gradient(45deg, #E5E5E5 25%, transparent 25%, transparent 75%, #E5E5E5 75%, #E5E5E5)`,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 10px 10px'
                }}
              />
            }
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `linear-gradient(45deg, #E5E5E5 25%, transparent 25%, transparent 75%, #E5E5E5 75%, #E5E5E5), linear-gradient(45deg, #E5E5E5 25%, transparent 25%, transparent 75%, #E5E5E5 75%, #E5E5E5)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px'
            }}
          />
        )}
        
        {/* Actions (Favoris, Partage) */}
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4 text-gray-600" strokeWidth={2} />
          </button>
          <button
            onClick={handleFavorite}
            className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <Star className={`w-[18px] h-[18px] ${favorite ? 'text-action-primary fill-[var(--action-primary)]' : 'text-gray-600'}`} strokeWidth={favorite ? 0 : 1.8} />
          </button>
        </div>
        
        {/* Private Badge */}
        {event?.isPrivate && (
          event.creatorId === user?.id ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowQRModal(true); }}
              className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur-md px-2 py-1.5 rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition-transform z-10"
            >
              <QrCode className="w-3.5 h-3.5 text-action-primary" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">Privé</span>
            </button>
          ) : (
            <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm z-10">
              <Lock className="w-3 h-3 text-action-primary" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Privé</span>
            </div>
          )
        )}
      </div>

      {/* ── ZONE DE CONTENU ─────────────────────────────────────────────── */}
      <div className="p-4 w-full flex flex-col flex-1 justify-between">
        
        {/* Informations */}
        <div>
          <h3 
            className="font-semibold text-[#1B1818] leading-tight mb-1 truncate" 
            style={{ fontFamily: 'var(--font-poppins)', fontSize: '17px', fontWeight: 500 }}
          >
            {displayTitle}
          </h3>
          <p className="text-[13px] text-gray-500 mb-0.5 truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
            {displayDate}
          </p>
          {displayLocation && (
            <p className="text-[13px] text-gray-500 truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
              {displayLocation}
            </p>
          )}
        </div>

        {/* Pied de la carte (Avatars + Prix) */}
        <div className="flex items-center justify-between mt-4">
          
          <div className="flex items-center gap-2">
            {/* Avatars */}
            {count > 0 ? (
              <div className="flex -space-x-2">
                {Array.from({ length: Math.min(count, 3) }).map((_, i) => {
                  const avatar = attendees[i]?.user?.profile?.avatarUrl;
                  return (
                    <div
                      key={i}
                      className="w-[26px] h-[26px] rounded-full border-[2px] border-white flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
                      style={{ backgroundColor: avatar ? 'transparent' : colors[i % colors.length], zIndex: 3 - i }}
                    >
                      {avatar
                        ? <SafeImage src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        : String.fromCharCode(65 + i)
                      }
                    </div>
                  );
                })}
              </div>
            ) : (
              // Mock avatars pour la maquette si pas d'attendees
              <div className="flex -space-x-2">
                <div className="w-[26px] h-[26px] rounded-full bg-gray-300 border-[2px] border-white" style={{ zIndex: 3 }} />
                <div className="w-[26px] h-[26px] rounded-full bg-gray-400 border-[2px] border-white" style={{ zIndex: 2 }} />
                <div className="w-[26px] h-[26px] rounded-full bg-gray-500 border-[2px] border-white" style={{ zIndex: 1 }} />
              </div>
            )}
            
            <span className="text-[12px] font-medium text-gray-600" style={{ fontFamily: 'var(--font-poppins)' }}>
              {displayAttendeesCount}
            </span>
          </div>

          {/* Badge Prix */}
          {badge ?? (
            <div className={`px-3 py-1 rounded-full flex items-center justify-center ${
              displayPrice.toLowerCase() === 'gratuit' || displayPrice.toLowerCase() === 'free'
                ? 'bg-[#E8F8F0]'
                : 'bg-gray-100'
            }`}>
              <span 
                className={`text-[13px] font-semibold ${
                  displayPrice.toLowerCase() === 'gratuit' || displayPrice.toLowerCase() === 'free'
                    ? 'text-[#00A35F]'
                    : 'text-gray-700'
                }`} 
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {displayPrice}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal for Private Events */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 animate-in fade-in duration-200">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={(e) => { e.stopPropagation(); setShowQRModal(false); }} 
          />
          <div className="bg-background-white rounded-[32px] p-8 w-full max-w-sm relative z-10 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowQRModal(false); }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="w-16 h-16 rounded-full bg-brand-orange-50 flex items-center justify-center mb-200 mt-2">
              <QrCode className="w-8 h-8 text-action-primary" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Inviter à l'événement</h3>
            <p className="text-sm text-text-secondary mb-8 max-w-[240px]">
              Faites scanner ce code QR pour permettre à vos proches de rejoindre l'événement privé.
            </p>
            <div className="p-200 bg-background-white rounded-3xl border border-gray-100 shadow-sm mb-200">
              {isLoadingEvent ? (
                <div className="w-[180px] h-[180px] bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#9747FF] mb-2" />
                  <span className="text-sm font-medium">Chargement...</span>
                </div>
              ) : joinCode ? (
                <QRCodeSVG value={joinCode} size={180} level="M" />
              ) : (
                <div className="w-[180px] h-[180px] bg-gray-50 flex items-center justify-center text-gray-400">
                  <span className="text-sm font-medium">Code indisponible</span>
                </div>
              )}
            </div>
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mt-2">{joinCode}</p>
          </div>
        </div>
      )}

      {showShareModal && (
        <ShareModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </button>
  );
});
