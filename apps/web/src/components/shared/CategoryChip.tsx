import { cn } from '@/lib/utils'

interface CategoryChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
}

/**
 * Pilule catégorie / centre d'intérêt — contrastes light & dark.
 */
export function CategoryChip({ label, selected = false, onClick, disabled }: CategoryChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-[13px] font-medium border transition-all duration-200 touch-sm',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        selected
          ? 'bg-action-primary text-white border-action-primary'
          : [
              'bg-transparent text-foreground border-neutral-gray-300',
              'hover:border-action-primary/50',
              'active:bg-neutral-gray-100',
            ],
      )}
    >
      {label}
    </button>
  )
}

