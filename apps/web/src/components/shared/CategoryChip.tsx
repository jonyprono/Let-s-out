import { cn } from '@/lib/utils'
import { Basketball01Icon as Basketball, PaintBoardIcon as Palette, Pizza01Icon as PizzaSlice, Moon01Icon as HalfMoon, Airplane01Icon as Airplane, GameIcon as Gamepad, FavouriteIcon as Heart, MusicNote01Icon as MusicDoubleNote, StarIcon as Star, UserMultiple02Icon as Group, LaptopIcon as Laptop, Book01Icon as Book, Coffee01Icon as CoffeeCup, MapsIcon as Map } from 'hugeicons-react'

const LABEL_TO_ICON: Record<string, React.FC<any>> = {
  'Sport': Basketball,
  'Culture & Art': Palette,
  'Art & Culture': Palette,
  'Gastronomie': PizzaSlice,
  'Soirées': HalfMoon,
  'Voyages': Airplane,
  'Gaming': Gamepad,
  'Bien-être': Heart,
  'Musique': MusicDoubleNote,
  'Autre': Star,
  'Social': Group,
  'Bien-être & Santé': Heart,
  'Technologie': Laptop,
  'Techonologie': Laptop,
  'Science & Education': Book,
  'Lifestyle': CoffeeCup,
  'Tourisme': Map,
}

interface CategoryChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  showIcon?: boolean
}

/**
 * Pilule catégorie / centre d'intérêt — contrastes light & dark.
 */
export function CategoryChip({ label, selected = false, onClick, disabled, showIcon = true }: CategoryChipProps) {
  const Icon = LABEL_TO_ICON[label]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 touch-sm flex items-center gap-1.5',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        selected
          ? 'bg-[var(--brand-orange-500)] text-white shadow-sm'
          : [
              'bg-[#F5F5F5] text-[var(--color-text-primary)]',
              'hover:bg-gray-200 hover:text-gray-900 dark:text-white',
              'active:bg-[#E0E0E0]',
            ],
      )}
    >
      {showIcon && Icon && <Icon className="w-4 h-4" strokeWidth={2} />}
      <span className={!showIcon ? 'font-poppins font-medium text-[14px]' : ''}>{label}</span>
    </button>
  )
}

