import { useState } from 'react'
import { X, Plus, Trash2, Loader2, CheckSquare, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { chatApi, Message } from '../api'

interface CreatePollModalProps {
  conversationId: string
  isOpen: boolean
  onClose: () => void
  onCreated?: (message: Message) => void
}

const DURATION_OPTIONS = [
  { value: 1, label: '1 jour' },
  { value: 3, label: '3 jours' },
  { value: 7, label: '7 jours' },
  { value: 0, label: 'Sans limite' },
]

export function CreatePollModal({
  conversationId,
  isOpen,
  onClose,
  onCreated,
}: CreatePollModalProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [durationDays, setDurationDays] = useState<number>(7)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleAddOption = () => {
    if (options.length >= 20) {
      toast.info('Maximum 20 options par sondage.')
      return
    }
    setOptions((prev) => [...prev, ''])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.info('Un sondage doit comporter au moins 2 options.')
      return
    }
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
      toast.error('Veuillez saisir une question pour votre sondage.')
      return
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
    if (cleanOptions.length < 2) {
      toast.error('Veuillez remplir au moins 2 options de réponse.')
      return
    }

    setIsSubmitting(true)
    try {
      const newMsg = await chatApi.createPoll(conversationId, {
        question: trimmedQuestion,
        options: cleanOptions,
        allowMultiple,
        durationDays: durationDays > 0 ? durationDays : null,
      })
      toast.success('Sondage créé !')
      onCreated?.(newMsg)
      onClose()
      // Reset form
      setQuestion('')
      setOptions(['', ''])
      setAllowMultiple(false)
      setDurationDays(7)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Erreur lors de la création du sondage'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1E1E1E] rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FF7A00]/15 flex items-center justify-center text-[#FF7A00]">
              📊
            </div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">Créer un sondage</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: 'none' }}>
          {/* Question */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Posez une question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex : Quelle date vous convient le mieux ?"
              maxLength={200}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#2A2A2A] border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Options ({options.length}/20)
              </label>
              <span className="text-[11px] text-gray-400">Min. 2 options</span>
            </div>

            <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 text-center text-xs font-medium text-gray-400 shrink-0">
                    {idx + 1}.
                  </div>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={100}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#2A2A2A] border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#FF7A00] transition-colors"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 20 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-[#FF7A00] text-gray-600 dark:text-gray-400 hover:text-[#FF7A00] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter une option</span>
              </button>
            )}
          </div>

          {/* Options de configuration */}
          <div className="pt-2 space-y-3 border-t border-gray-100 dark:border-gray-800">
            {/* Réponses multiples */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-[#2A2A2A] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333] transition-colors">
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4 h-4 text-[#FF7A00]" />
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    Plusieurs réponses possibles
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Les participants peuvent choisir plus d&apos;une option
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF7A00] focus:ring-[#FF7A00] accent-[#FF7A00] cursor-pointer"
              />
            </label>

            {/* Durée du sondage */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Clock className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>Durée du sondage</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDurationDays(opt.value)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                      durationDays === opt.value
                        ? 'bg-[#FF7A00] text-white shadow-xs'
                        : 'bg-gray-50 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bouton de soumission */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF7A00]/25 active:scale-95 transition-all disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <span>Créer le sondage</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

