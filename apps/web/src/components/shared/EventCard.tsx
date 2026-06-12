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

interface EventCardProps {
  event: Event;
  onNavigate: (screen: string, id?: string) => void;
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

function formatPrice(price: number, currency: string, poolTarget?: number, participationMode?: string): string {
  // Cagnotte : poolTarget défini OU mode participation = cagnotte
  if ((poolTarget && poolTarget > 0) || participationMode === 'cagnotte' || participationMode === 'pool') return 'Cagnotte';
  // Tickets
  if (participationMode === 'ticket' || participationMode === 'tickets') return 'Tickets';
  if (price === 0) return 'Gratuit';
  // Devise : FCFA par défaut si non spécifiée
  const cur = currency || 'XOF';
  if (cur === 'XOF' || cur === 'CFA' || cur === 'FCFA') return `${Number(price).toLocaleString('fr-FR')} F CFA`;
  if (cur === 'EUR') return `${price} €`;
  return `${price} ${cur}`;
}

export const EventCard = memo(function EventCard({
  event,
  onNavigate,
  badge,
  horizontal = false,
}: EventCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const { user } = useAuthStore();
  const favorite = isFavorite(event.id);
  const [showQRModal, setShowQRModal] = useState(false);

  const { data: fullEvent, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['events', event.id],
    queryFn: () => eventsApi.getById(event.id),
    enabled: showQRModal && !event.joinCode,
  });

  const joinCode = event.joinCode || fullEvent?.data?.joinCode;

  const price = formatPrice(event.price, event.currency, event.poolTarget, (event as any).participationMode);
  const dateStr = formatEventDate(event.startAt);
  const location = [event.address, event.city].filter(Boolean).join(' • ');
  const attendees: any[] = (event as any).bookings || [];
  const count = event.currentAttendees ?? 0;
  const max = event.maxAttendees;
  const colors = ['#9747FF', 'var(--action-primary)', '#B070FF', 'var(--color-brand-orange-400)'];

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success('Lien copié !');
      } else {
        toast.error('Impossible de copier le lien');
      }
    } catch (err) {
      toast.error('Impossible de copier le lien');
    }

    document.body.removeChild(textArea);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticFeedback.impact();
    const url = `${window.location.origin}/events/${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Découvrez "${event.title}" sur Let's Out !`,
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Lien copié !');
        } catch {
          fallbackCopyTextToClipboard(url);
        }
      } else {
        fallbackCopyTextToClipboard(url);
      }
    }
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
      onClick={() => { hapticFeedback.impact(); onNavigate('event-details', event.id); }}
      className={`flex flex-col bg-background-white rounded-2xl overflow-hidden text-left shadow-sm border border-gray-100 active:scale-[0.98] transition-transform relative ${
        horizontal ? 'flex-shrink-0 w-[280px]' : 'w-full mb-200'
      }`}
    >
      {/* Image + Actions */}
      <div className="relative w-full bg-gray-100" style={{ height: 176 }}>
        <SafeImage
          src={event.coverUrl}
          alt={event.title}
          className="w-full h-full object-cover"
          fallback={
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `repeating-conic-gradient(#e5e7eb 0% 25%, #f3f4f6 0% 50%)`,
                backgroundSize: '24px 24px',
              }}
            />
          }
        />
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-gray-200/60 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4 text-gray-800" />
          </button>
          <button
            onClick={handleFavorite}
            className="w-9 h-9 rounded-full bg-gray-200/60 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <Star className={`w-4 h-4 ${favorite ? 'text-action-primary fill-[var(--action-primary)]' : 'text-gray-800'}`} />
          </button>
        </div>
        
        {/* Private Badge */}
        {event.isPrivate && (
          event.creatorId === user?.id ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowQRModal(true); }}
              className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur-md px-150 py-1.5 rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition-transform z-10"
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

      {/* Info */}
      <div className="p-150 w-full">
        <h3 className="text-base font-bold text-gray-900 leading-tight mb-1 truncate flex items-center gap-1.5">
          {event.title}
        </h3>
        <p className="text-[12px] text-text-secondary mb-0.5">{dateStr}</p>
        {location && <p className="text-[12px] text-text-secondary mb-200 truncate">{location}</p>}

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            {/* Overlapping avatars */}
            {count > 0 && (
              <div className="flex -space-x-2">
                {Array.from({ length: Math.min(count, 3) }).map((_, i) => {
                  const avatar = attendees[i]?.user?.profile?.avatarUrl;
                  return (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-bold overflow-hidden"
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
            )}
            {/* Participant count */}
            <span className="text-[13px] text-text-secondary font-medium">
              {max ? `${count}/${max} Participants` : `${count} Participants`}
            </span>
          </div>

          {/* Price badge */}
          {badge ?? (
            <span className={`px-3 py-1 rounded-lg text-[12px] font-bold whitespace-nowrap ${
              ((event.poolTarget && event.poolTarget > 0) || (event as any).participationMode === 'cagnotte' || (event as any).participationMode === 'pool')
                ? 'bg-purple-100 text-purple-600'
                : ((event as any).participationMode === 'ticket' || (event as any).participationMode === 'tickets')
                  ? 'bg-blue-100 text-blue-600'
                  : event.price === 0
                    ? 'bg-green-100 text-green-600'
                    : 'bg-[#EBF5FF] text-[#007AFF]'
            }`}>
              {price}
            </span>
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
    </button>
  );
});
