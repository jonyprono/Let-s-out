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

export interface SettingsToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SettingsToggle({ checked, onChange }: SettingsToggleProps) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`w-[44px] h-[24px] rounded-[12px] flex items-center px-[2px] transition-colors shrink-0 box-border border-[0.5px] ${
        checked ? 'bg-[var(--brand-orange-500)] border-[var(--brand-orange-500)]' : 'bg-[#E5E7EB] border-[#E5E7EB]'
      }`}
    >
      <div
        className={`w-[20px] h-[20px] rounded-full bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.06)] transition-transform ${
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export const ThemeSegment = PreferenceSegment
