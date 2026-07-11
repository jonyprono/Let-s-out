import { useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { eventsApi } from '@/features/events/api'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeImage } from '@/components/shared/SafeImage'
import { PrimaryButton } from '@/components/shared/PrimaryButton'

interface RateEventModalProps {
  event: any
  onClose: () => void
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
            className={`transition-colors p-1 ${value >= star ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            <Star className="w-6 h-6 sm:w-5 sm:h-5" fill={value >= star ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function RateEventModal({ event, onClose }: RateEventModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [punctualityRating, setPunctualityRating] = useState(0)
  const [attitudeRating, setAttitudeRating] = useState(0)
  const [reliabilityRating, setReliabilityRating] = useState(0)
  const [comment, setComment] = useState('')
  const qc = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: () => eventsApi.submitReview(event.id, {
      rating,
      punctualityRating: punctualityRating || undefined,
      attitudeRating: attitudeRating || undefined,
      reliabilityRating: reliabilityRating || undefined,
      comment,
    }),
    onSuccess: () => {
      toast.success('Merci pour votre avis !')
      qc.invalidateQueries({ queryKey: ['users', 'activity'] })
      qc.invalidateQueries({ queryKey: ['events', event.id, 'reviews'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'envoi')
    }
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center animate-in fade-in duration-200">
      <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-[24px] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[90dvh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0">
          <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">Noter l'événement</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400 font-bold leading-none">✕</span>
          </button>
        </div>

        <div className="px-5 py-2 pb-8 flex flex-col gap-5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Event info */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-[#2a2a2a] flex-shrink-0">
              <SafeImage src={event.coverUrl} alt={event.title} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">{event.title}</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Comment avez-vous trouvé cet événement ?</p>
            </div>
          </div>

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

          {/* Detailed ratings */}
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
            onChange={e => setComment(e.target.value)}
            placeholder="Un petit mot ? (optionnel)..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-white/10 rounded-xl text-[14px] resize-none focus:outline-none focus:border-[#FF7A00]"
          />

          {/* Submit */}
          <PrimaryButton
            onClick={() => submitMutation.mutate()}
            disabled={rating === 0 || submitMutation.isPending}
            loading={submitMutation.isPending}
          >
            Envoyer mon avis
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
