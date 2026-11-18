import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { EVENT_CATEGORIES, getEventCategory, eventCategoryLabel } from '@/lib/event-categories'

interface EventCategorySheetProps {
  open: boolean
  onClose: () => void
  /** Catégorie actuellement choisie (pré-cochée à l'ouverture) */
  value?: string | null
  /** Appelée avec l'identifiant choisi ; la feuille se ferme ensuite (onClose) */
  onSelect: (id: string) => void
  /** Titre (texte traduit fourni par l'appelant) */
  title: string
}

/**
 * Sélecteur de catégorie d'événement : liste avec icônes et radios Let's Out, dans une feuille du
 * bas défilante. Composant UNIQUE (création d'événement, OUT VLOGS, Pages) : même rendu partout.
 * Une valeur historique (catégorie retirée de la création) est ajoutée en fin de liste pour rester
 * cochée et ne pas être perdue.
 * Voile au-dessus des fenêtres plein écran (z-[200]) : visible même ouverte depuis une modale.
 */
export function EventCategorySheet({ open, onClose, value, onSelect, title }: EventCategorySheetProps) {
  const { t } = useTranslation()
  const selectedRef = useRef<HTMLButtonElement>(null)

  const legacy = value && !EVENT_CATEGORIES.some((c) => c.id === value) ? getEventCategory(value) : undefined
  const list = legacy ? [...EVENT_CATEGORIES, legacy] : EVENT_CATEGORIES

  // À l'ouverture : la catégorie choisie est amenée à l'écran (longue liste)
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => selectedRef.current?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(id)
  }, [open])

  return (
    <BottomSheet title={title} open={open} onClose={onClose} overlayClassName="z-[200]">
      <div className="divide-y divide-[var(--border-tertiary)]" role="radiogroup" aria-label={title}>
        {list.map((cat) => {
          const selected = value === cat.id
          return (
            <button
              key={cat.id}
              ref={selected ? selectedRef : undefined}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => { onSelect(cat.id); onClose() }}
              className="w-full flex items-center gap-4 py-[13px] text-left active:bg-[var(--color-background-secondary)] transition-colors"
            >
              <cat.Icon className="w-[24px] h-[24px] text-[var(--color-icon-primary)] shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="flex-1 text-[length:var(--font-size-body-medium)] font-medium text-[var(--color-text-primary)] text-left">
                <span>{eventCategoryLabel(t, cat.id)}</span>
              </span>
              <div
                className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected ? 'border-[var(--brand-orange-500)]' : 'border-[var(--border-default)]'
                }`}
                aria-hidden="true"
              >
                {selected && <div className="w-[11px] h-[11px] rounded-full bg-[var(--brand-orange-500)]" />}
              </div>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
