import { useState } from 'react';
import { Copy, Share2, Download, Check } from 'lucide-react';
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
  
  const joinCode = eventData?.joinCode || eventId.slice(0, 5).toUpperCase();
  const eventLink = `https://lets-out.app/event/join/${joinCode}`;

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
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="w-full max-h-[90%] bg-white rounded-t-[28px] flex flex-col relative animate-in slide-in-from-bottom duration-300 shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 flex items-center justify-center flex-shrink-0 border-b border-gray-100">
          <h3 className="text-[17px] font-bold text-gray-900">Partager</h3>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8" style={{ scrollbarWidth: 'none' }}>
          
          <p className="text-[13px] text-gray-800 text-center mb-6 leading-relaxed px-2">
            Partagez le code événement, le QR Code ou le lien avec vos amis afin de les inviter à rejoindre l'événement.
          </p>

          <div className="space-y-4">
            {/* Join Code block */}
            <div className="rounded-2xl bg-[#FFF8EE] p-6 flex flex-col items-center gap-4">
              <span className="text-[36px] font-bold text-gray-900 tracking-widest leading-none">
                {joinCode}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 active:scale-95 transition-transform shadow-sm"
              >
                {codeCopied ? 'Code copié !' : 'Copier le code'}
                {codeCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
              </button>
            </div>

            {/* QR Code block */}
            <div className="rounded-2xl bg-[#FFF8EE] p-6 flex flex-col items-center gap-5">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                <QRCodeSVG
                  id="share-qr-code"
                  value={eventLink}
                  size={120}
                  level="M"
                />
              </div>
              <button
                onClick={downloadQR}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 active:scale-95 transition-transform shadow-sm"
              >
                Télécharger le QR code
                <Download className="w-4 h-4 text-gray-500" strokeWidth={2} />
              </button>
            </div>

            {/* Link block */}
            <div className="rounded-2xl bg-[#FFF8EE] p-5 flex flex-col items-center gap-4">
              <p className="text-[13px] text-gray-900 font-medium text-center break-all">
                {eventLink}
              </p>
              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 active:scale-95 transition-transform shadow-sm flex-1"
                >
                  {linkCopied ? 'Copié !' : 'Copier'}
                  {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
                <button
                  onClick={shareNative}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 active:scale-95 transition-transform shadow-sm flex-1"
                >
                  Partager
                  <Share2 className="w-4 h-4 text-gray-500" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
