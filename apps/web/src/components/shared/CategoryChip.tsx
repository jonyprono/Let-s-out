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
              'bg-[#F4F4F5] text-[#71717A]',
              'hover:bg-gray-200 hover:text-gray-900',
              'active:bg-[#E0E0E0]',
            ],
      )}
    >
      {label}
    </button>
  )
}

