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

function formatPrice(price: number, currency: string): string {
  if (price === 0) return 'Gratuit';
  if (currency === 'XOF' || currency === 'CFA') return `${Number(price).toLocaleString('fr-FR')} F`;
  if (currency === 'EUR') return `${price} €`;
  return `${price} ${currency}`;
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

  const price = formatPrice(event.price, event.currency);
  const dateStr = formatEventDate(event.startAt);
  const location = [event.address, event.city].filter(Boolean).join(' • ');
  const attendees: any[] = (event as any).bookings || [];
  const count = event.currentAttendees ?? 0;
  const max = event.maxAttendees;
  const colors = ['#9747FF', '#FF9F1C', '#B070FF', '#FFAE42'];

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
      className={`flex flex-col bg-white rounded-2xl overflow-hidden text-left shadow-sm border border-gray-100 active:scale-[0.98] transition-transform relative ${
        horizontal ? 'flex-shrink-0 w-[280px]' : 'w-full mb-4'
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
            className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={handleFavorite}
            className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <Star className={`w-4 h-4 ${favorite ? 'text-[#FF9F1C] fill-[#FF9F1C]' : 'text-gray-700'}`} />
          </button>
        </div>
        
        {/* Private Badge */}
        {event.isPrivate && (
          event.creatorId === user?.id ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowQRModal(true); }}
              className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition-transform z-10"
            >
              <QrCode className="w-3.5 h-3.5 text-[#FF9F1C]" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">Privé</span>
            </button>
          ) : (
            <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm z-10">
              <Lock className="w-3 h-3 text-[#FF9F1C]" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Privé</span>
            </div>
          )
        )}
      </div>

      {/* Info */}
      <div className="p-3 w-full">
        <h3 className="text-base font-bold text-gray-900 leading-tight mb-1 truncate flex items-center gap-1.5">
          {event.title}
        </h3>
        <p className="text-[12px] text-gray-500 mb-0.5">{dateStr}</p>
        {location && <p className="text-[12px] text-gray-500 mb-4 truncate">{location}</p>}

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
            <span className="text-[13px] text-gray-500 font-medium">
              {max ? `${count}/${max} Participants` : `${count} Participants`}
            </span>
          </div>

          {/* Price badge */}
          {badge ?? (
            <span className={`px-3 py-1 rounded-lg text-[12px] font-bold whitespace-nowrap ${
              event.price === 0
                ? 'bg-[#E6F9F1] text-[#00A859]'
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
          <div className="bg-white rounded-[32px] p-8 w-full max-w-sm relative z-10 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowQRModal(false); }}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4 mt-2">
              <QrCode className="w-8 h-8 text-[#FF9F1C]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Inviter à l'événement</h3>
            <p className="text-sm text-gray-500 mb-8 max-w-[240px]">
              Faites scanner ce code QR pour permettre à vos proches de rejoindre l'événement privé.
            </p>
            <div className="p-4 bg-white rounded-3xl border border-gray-100 shadow-sm mb-4">
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
