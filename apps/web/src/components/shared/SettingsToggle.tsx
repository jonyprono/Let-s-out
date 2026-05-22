interface PreferenceSegmentProps {
  leftLabel: string
  rightLabel: string
  activeRight: boolean
  onSelectLeft: () => void
  onSelectRight: () => void
}

/** Segmented control (style paramètres) — actif vert en mode sombre */
export function PreferenceSegment({
  leftLabel,
  rightLabel,
  activeRight,
  onSelectLeft,
  onSelectRight,
}: PreferenceSegmentProps) {
  const activeClass =
    'bg-white dark:bg-[#10B981] text-gray-900 dark:text-white shadow-sm'
  const inactiveClass = 'text-gray-500 dark:text-gray-400'

  return (
    <div className="flex items-center bg-gray-100 dark:bg-[#2A2A2A] rounded-full p-1 flex-shrink-0">
      <button
        type="button"
        onClick={onSelectLeft}
        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all min-w-[56px] touch-sm ${
          !activeRight ? activeClass : inactiveClass
        }`}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        onClick={onSelectRight}
        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all min-w-[56px] touch-sm ${
          activeRight ? activeClass : inactiveClass
        }`}
      >
        {rightLabel}
      </button>
    </div>
  )
}

/** @deprecated Use PreferenceSegment */
export const SettingsToggle = PreferenceSegment
export const ThemeSegment = PreferenceSegment
