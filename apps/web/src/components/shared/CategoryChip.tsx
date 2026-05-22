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
          ? 'bg-[#FF9F1C] text-white border-[#FF9F1C] shadow-md shadow-[#FF9F1C]/30'
          : [
              'bg-card text-foreground border-border',
              'hover:border-[#FF9F1C]/50 hover:bg-accent',
              'active:bg-accent/80',
              'dark:bg-[#242424] dark:border-[#333333]',
              'dark:hover:bg-[#2d2d2d] dark:hover:border-[#FF9F1C]/40',
            ],
      )}
    >
      {label}
    </button>
  )
}
