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
        'px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 touch-sm',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        selected
          ? 'bg-action-primary text-white shadow-sm'
          : [
              'bg-[#F5F5F5] text-[#555555]',
              'hover:bg-[#EEEEEE]',
              'active:bg-[#E0E0E0]',
            ],
      )}
    >
      {label}
    </button>
  )
}

