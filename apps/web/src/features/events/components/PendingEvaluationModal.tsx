import { useState } from 'react';
import { Star } from 'lucide-react';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { eventsApi } from '@/features/events/api';
import { toast } from 'sonner';

interface PendingEvaluationModalProps {
  event: any;
  onClose: () => void;
  onSubmit: () => void;
}

function RatingRow({ label, value, onChange, icon }: { label: string, value: number, onChange: (v: number) => void, icon: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-[#222222] p-3 rounded-xl border border-gray-100 dark:border-white/10 gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <div className="flex gap-1 self-start sm:self-auto">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`transition-colors p-1 -m-1 sm:p-0 sm:m-0 ${value >= star ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            <Star className="w-6 h-6 sm:w-5 sm:h-5" fill={value >= star ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PendingEvaluationModal({ event, onClose, onSubmit }: PendingEvaluationModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [punctualityRating, setPunctualityRating] = useState(0);
  const [attitudeRating, setAttitudeRating] = useState(0);
  const [reliabilityRating, setReliabilityRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Veuillez donner une note globale');
      return;
    }

    setIsSubmitting(true);
    try {
      await eventsApi.submitReview(event.id, {
        rating,
        punctualityRating: punctualityRating || undefined,
        attitudeRating: attitudeRating || undefined,
        reliabilityRating: reliabilityRating || undefined,
        comment,
      });
      toast.success('Merci pour votre évaluation !');
      onSubmit();
    } catch (err) {
      toast.error("Erreur lors de l'envoi de l'évaluation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-3 text-center flex-shrink-0">
          <div className="w-14 h-14 mx-auto bg-orange-100 dark:bg-orange-900/30 text-orange-500 rounded-full flex items-center justify-center mb-3 text-2xl">⭐</div>
          <h2 className="text-[20px] font-black text-gray-900 dark:text-white mb-1">Comment s'est passé ?</h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 font-semibold">{event.title}</p>
          <p className="text-[12px] text-gray-400 mt-1">Votre avis aide la communauté à identifier les organisateurs de confiance !</p>
        </div>

        <div className="px-5 pb-8 flex flex-col gap-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Global Rating */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Note globale</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-100 dark:border-white/10" />

          {/* Detailed Ratings for badges */}
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 text-center">
              Aidez l'organisateur à obtenir des badges :
            </p>
            <RatingRow label="Accueillant et souriant" value={attitudeRating} onChange={setAttitudeRating} icon="🤝" />
            <RatingRow label="Ponctuel (À l'heure prévue)" value={punctualityRating} onChange={setPunctualityRating} icon="⏱️" />
            <RatingRow label="Fiable (Lieu et détails conformes)" value={reliabilityRating} onChange={setReliabilityRating} icon="✅" />
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Un petit mot ? (optionnel)..."
            rows={3}
            className="w-full min-h-[80px] flex-shrink-0 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-[#FF7A00] resize-none"
          />
        </div>

        {/* Actions (Pinned at bottom) */}
        <div className="px-5 pt-3 pb-safe-6 border-t border-gray-100 dark:border-white/10 flex-shrink-0 bg-white dark:bg-[#1A1A1A]">
          <PrimaryButton
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            loading={isSubmitting}
          >
            Envoyer mon avis
          </PrimaryButton>
          <button
            onClick={onClose}
            className="w-full mt-3 text-gray-400 font-semibold text-sm hover:text-gray-600 dark:text-gray-300 transition-colors text-center pb-2"
          >
            Évaluer plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
