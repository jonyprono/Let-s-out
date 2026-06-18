import { useState } from 'react';
import { X, Copy, Share2, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '@/features/events/api';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export function ShareModal({ eventId, eventTitle, onClose }: ShareModalProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch event details to get the join code
  const { data: eventData } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.getById(eventId).then(r => r.data),
    enabled: !!eventId,
  });
  const joinCode = eventData?.joinCode || '';
  const eventLink = `https://lets-out.app/event/join/${joinCode || eventId}`;

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinCode || eventId);
      } else {
        const el = document.createElement('textarea');
        el.value = joinCode || eventId;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast.success('Code copié !');
    } catch {
      toast.error('Impossible de copier le code');
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(eventLink);
      } else {
        const el = document.createElement('textarea');
        el.value = eventLink;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success('Lien copié !');
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  const shareNative = async () => {
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
  };

  const downloadQR = () => {
    const svg = document.getElementById('share-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `qr-${eventId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    toast.success('QR Code téléchargé !');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
      <div className="w-full max-h-[90%] bg-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-[18px] font-bold text-gray-900">Partager</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Description */}
        <p className="px-5 text-[13px] text-gray-500 mb-5 leading-relaxed">
          Partagez le code événement, le QR Code ou le lien avec vos amis afin de les inviter à rejoindre l'événement.
        </p>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Join Code block */}
          <div className="rounded-2xl bg-[#FFF8EE] p-5 flex flex-col items-center gap-4">
            <span className="text-[42px] font-bold text-gray-900 tracking-widest">
              {joinCode || eventId.slice(0, 5).toUpperCase()}
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 active:scale-95 transition-transform"
            >
              {codeCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
              {codeCopied ? 'Code copié !' : 'Copier le code'}
              {!codeCopied && <span className="text-gray-400 ml-0.5">📋</span>}
            </button>
          </div>

          {/* QR Code block */}
          <div className="rounded-2xl bg-[#FFF8EE] p-5 flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <QRCodeSVG
                id="share-qr-code"
                value={eventLink}
                size={160}
                level="M"
              />
            </div>
            <button
              onClick={downloadQR}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 active:scale-95 transition-transform"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Télécharger le QR code
              <span className="text-gray-400">⬇</span>
            </button>
          </div>

          {/* Link block */}
          <div className="rounded-2xl bg-[#FFF8EE] p-4">
            <p className="text-[13px] text-[#007AFF] font-medium mb-3 break-all">{eventLink}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 active:scale-95 transition-transform"
              >
                {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                {linkCopied ? 'Copié !' : 'Copier'}
              </button>
              <button
                onClick={shareNative}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 active:scale-95 transition-transform"
              >
                <Share2 className="w-4 h-4 text-gray-500" strokeWidth={1.8} />
                Partager
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
