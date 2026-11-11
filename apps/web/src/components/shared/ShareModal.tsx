import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Share2, Download, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '@/features/events/api';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export function ShareModal({ eventId, eventTitle, onClose }: ShareModalProps) {
  const { user } = useAuthStore();
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch event details to get the join code and privacy settings
  const { data: eventData } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.getById(eventId).then(r => r.data),
    enabled: !!eventId,
  });

  // Fetch current user's booking to check participation
  const { data: myBookingData } = useQuery({
    queryKey: ['events', eventId, 'my-booking'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/events/${eventId}/my-booking`);
        return data?.data ?? data;
      } catch {
        return null;
      }
    },
    enabled: !!eventId && !!user,
  });

  const isOrganizer = Boolean(user && eventData && (eventData.creatorId === user.id || (eventData.coHostIds || []).includes(user.id)));
  const isJoined = Boolean(myBookingData && myBookingData.status === 'CONFIRMED');
  const isPrivate = Boolean(eventData?.isPrivate);
  const requiresApproval = Boolean(eventData?.requiresApproval);
  const allowGuestShare = Boolean(eventData?.allowGuestShare);

  const canShare = isOrganizer || (
    isPrivate
      ? (isJoined && allowGuestShare)
      : requiresApproval
        ? isJoined
        : true
  );
  
  const joinCode = eventData?.joinCode || eventId.slice(0, 5).toUpperCase();
  const eventLink = `https://letsout.app/event/join/${joinCode}`;

  const copyText = async (text: string, setCopied: (v: boolean) => void, successMsg: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(successMsg);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const copyCode = () => copyText(joinCode, setCodeCopied, 'Code copié !');
  const copyLink = () => copyText(eventLink, setLinkCopied, 'Lien copié !');

  const shareNative = async () => {
    try {
      // Use Capacitor Share plugin for native share sheet on iOS/Android
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: eventTitle,
        text: `Rejoignez "${eventTitle}" sur Let's Out !`,
        url: eventLink,
        dialogTitle: 'Partager avec',
      });
    } catch (err) {
      // Fallback to web navigator.share or copyLink if it fails (e.g., cancelled or unsupported)
      if (navigator.share) {
        try {
          await navigator.share({
            title: eventTitle,
            text: `Rejoignez "${eventTitle}" sur Let's Out !`,
            url: eventLink,
          });
        } catch {
          copyLink();
        }
      } else {
        copyLink();
      }
    }
  };

  const downloadQR = async () => {
    const svg = document.getElementById('share-qr-code');
    if (!svg) return;

    // 1. Serialize SVG → PNG via canvas
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const SIZE = 400; // Higher resolution for better quality
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        resolve();
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const fileName = `letsout-qr-${eventId}.png`;

    try {
      // Try Capacitor native save (Android / iOS)
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        
        // Write to cache directory
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        // Share it via the native share sheet (user can save to gallery from there)
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: `QR Code – ${eventTitle}`,
          text: `QR Code pour "${eventTitle}"`,
          url: writeResult.uri,
          dialogTitle: 'Enregistrer le QR Code dans la galerie',
        });
        return;
      }
    } catch {
      // Not native or plugin not available — fall through to web download
    }

    // Web fallback: anchor download
    const a = document.createElement('a');
    a.download = fileName;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR Code téléchargé !');
  };

  if (eventData && !canShare) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="w-full max-h-[90%] bg-white dark:bg-[#1A1A1A] rounded-t-[28px] flex flex-col relative animate-in slide-in-from-bottom duration-300 shadow-2xl p-6">
          <div className="flex justify-center pt-1 pb-3 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-action-primary" />
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2">Partage restreint</h3>
            <p className="text-[14px] text-gray-600 dark:text-gray-300 max-w-xs mb-6 leading-relaxed">
              {isPrivate
                ? (!isJoined
                    ? "Cet événement est privé. Vous devez d'abord avoir rejoint l'événement pour pouvoir le partager."
                    : "L'organisateur de cet événement privé n'a pas autorisé les participants à le partager.")
                : (!isJoined
                    ? "Cet événement nécessite la validation de l'organisateur. Vous devez être accepté avant de pouvoir le partager."
                    : "L'organisateur n'a pas autorisé le partage de cet événement.")}
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-full bg-action-primary text-white font-semibold text-[14px] active:scale-95 transition-transform shadow-md"
            >
              Compris
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="w-full max-h-[90%] bg-white dark:bg-[#1A1A1A] rounded-t-[28px] flex flex-col relative animate-in slide-in-from-bottom duration-300 shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 flex items-center justify-center flex-shrink-0 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">Partager</h3>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8" style={{ scrollbarWidth: 'none' }}>
          
          <p className="text-[13px] text-gray-800 dark:text-gray-200 text-center mb-6 leading-relaxed px-2">
            Partagez le code événement, le QR Code ou le lien avec vos amis afin de les inviter à rejoindre l'événement.
          </p>

          <div className="space-y-4">
            {/* Join Code block */}
            <div className="rounded-2xl bg-[#FFF8EE] dark:bg-[#FF7A00]/10 border border-transparent dark:border-[#FF7A00]/20 p-6 flex flex-col items-center gap-4">
              <span className="text-[36px] font-bold text-gray-900 dark:text-white tracking-widest leading-none">
                {joinCode}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-[13px] font-semibold text-gray-800 dark:text-gray-200 active:scale-95 transition-transform shadow-sm"
              >
                {codeCopied ? 'Code copié !' : 'Copier le code'}
                {codeCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
              </button>
            </div>

            {/* QR Code block */}
            <div className="rounded-2xl bg-[#FFF8EE] dark:bg-[#FF7A00]/10 border border-transparent dark:border-[#FF7A00]/20 p-6 flex flex-col items-center gap-5">
              <div className="bg-white dark:bg-[#1A1A1A] p-3 rounded-xl shadow-sm">
                <QRCodeSVG
                  id="share-qr-code"
                  value={eventLink}
                  size={120}
                  level="M"
                />
              </div>
              <button
                onClick={downloadQR}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-[13px] font-semibold text-gray-800 dark:text-gray-200 active:scale-95 transition-transform shadow-sm"
              >
                Télécharger le QR code
                <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" strokeWidth={2} />
              </button>
            </div>

            {/* Link block */}
            <div className="rounded-2xl bg-[#FFF8EE] dark:bg-[#FF7A00]/10 border border-transparent dark:border-[#FF7A00]/20 p-5 flex flex-col items-center gap-4">
              <p className="text-[13px] text-gray-900 dark:text-white font-medium text-center break-all">
                {eventLink}
              </p>
              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-[13px] font-semibold text-gray-800 dark:text-gray-200 active:scale-95 transition-transform shadow-sm flex-1"
                >
                  {linkCopied ? 'Copié !' : 'Copier'}
                  {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                </button>
                <button
                  onClick={shareNative}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-[13px] font-semibold text-gray-800 dark:text-gray-200 active:scale-95 transition-transform shadow-sm flex-1"
                >
                  Partager
                  <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
