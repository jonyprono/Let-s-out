import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { eventsApi } from '@/features/events/api';
import { toast } from 'sonner';

interface PendingEvaluationModalProps {
  event: any;
  onClose: () => void;
  onSubmit: () => void;
}

export function PendingEvaluationModal({ event, onClose, onSubmit }: PendingEvaluationModalProps) {
  const [rating, setRating] = useState(0);
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
        punctualityRating,
        attitudeRating,
        reliabilityRating,
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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col pt-8">
        
        {/* Header */}
        <div className="text-center mb-6 shrink-0">
          <div className="w-16 h-16 mx-auto bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-4 text-2xl">
            ⭐
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Comment s'est passé "{event.title}" ?</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Votre avis aide la communauté à identifier les organisateurs de confiance !
          </p>
        </div>

        {/* Global Rating */}
        <div className="mb-6 flex flex-col items-center">
          <p className="font-bold text-gray-700 mb-2">Note Globale</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`transition-colors p-1 ${rating >= star ? 'text-yellow-400' : 'text-gray-200 hover:text-gray-300'}`}
              >
                <Star className="w-8 h-8" fill={rating >= star ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-100 dark:border-white/10 my-4 shrink-0" />

        {/* Detailed Ratings */}
        <div className="space-y-4 mb-6 shrink-0">
          <p className="font-bold text-gray-800 dark:text-gray-200 text-center mb-2">Aidez-le à obtenir des badges :</p>
          
          <RatingRow label="Accueillant et souriant" value={attitudeRating} onChange={setAttitudeRating} icon="🤝" />
          <RatingRow label="Ponctuel (À l'heure prévue)" value={punctualityRating} onChange={setPunctualityRating} icon="⏱️" />
          <RatingRow label="Fiable (Lieu et détails conformes)" value={reliabilityRating} onChange={setReliabilityRating} icon="✅" />
        </div>

        {/* Comment */}
        <div className="mb-6 shrink-0">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Un petit mot ? (Optionnel)"
            className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 shrink-0 mt-auto">
          <Button 
            onClick={handleSubmit} 
            disabled={rating === 0 || isSubmitting}
            className="w-full h-12 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isSubmitting ? 'Envoi...' : 'Envoyer mon avis'}
          </Button>
          <button 
            onClick={onClose}
            className="text-gray-400 font-semibold text-sm hover:text-gray-600 dark:text-gray-300 transition-colors"
          >
            Évaluer plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

function RatingRow({ label, value, onChange, icon }: { label: string, value: number, onChange: (v: number) => void, icon: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-[#222222] p-3 rounded-xl border border-gray-100 dark:border-white/10 gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <div className="flex gap-1 self-start sm:self-auto">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`transition-colors p-1 -m-1 sm:p-0 sm:m-0 ${value >= star ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            <Star className="w-6 h-6 sm:w-5 sm:h-5" fill={value >= star ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}
