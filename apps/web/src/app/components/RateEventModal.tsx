import { useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { eventsApi } from '@/features/events/api'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeImage } from '@/components/shared/SafeImage'

interface RateEventModalProps {
  event: any
  onClose: () => void
}

export function RateEventModal({ event, onClose }: RateEventModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const qc = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: () => eventsApi.submitReview(event.id, { rating, comment }),
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
      <div className="w-full bg-white dark:bg-[#1A1A1A] dark:bg-[#1A1A1A] rounded-t-[24px] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0">
          <h3 className="text-[18px] font-bold text-gray-900 dark:text-white dark:text-white">Noter l'événement</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400 dark:text-gray-400 font-bold leading-none">✕</span>
          </button>
        </div>
        
        <div className="px-5 py-4 pb-12 flex flex-col items-center overflow-y-auto max-h-[85vh]">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#2a2a2a] mb-4 shadow-sm flex-shrink-0">
            <SafeImage src={event.coverUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
          <h4 className="text-[16px] font-bold text-gray-900 dark:text-white dark:text-white text-center mb-1">{event.title}</h4>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 dark:text-gray-400 text-center mb-6">Comment avez-vous trouvé cet événement ?</p>

          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="w-12 h-12 flex items-center justify-center active:scale-90 transition-transform"
              >
                <Star 
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoverRating || rating) 
                      ? 'fill-action-primary text-action-primary' 
                      : 'text-gray-300'
                  }`} 
                />
              </button>
            ))}
          </div>

          <div className="w-full mb-6">
            <textarea 
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Racontez votre expérience (optionnel)..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-white/10 rounded-xl text-[14px] resize-none focus:outline-none focus:border-action-primary"
            />
          </div>

          <button
            onClick={() => submitMutation.mutate()}
            disabled={rating === 0 || submitMutation.isPending}
            className="w-full bg-action-primary text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center mt-2 mb-8"
          >
            {submitMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer mon avis'}
          </button>
        </div>
      </div>
    </div>
  )
}
