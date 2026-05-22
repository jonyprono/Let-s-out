interface SettingsToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  'aria-label': string
}

/** Interrupteur iOS — notifications */
export function SettingsToggle({ enabled, onChange, 'aria-label': ariaLabel }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={() => onChange(!enabled)}
      className={`relative w-[52px] h-[30px] rounded-full transition-colors duration-200 flex-shrink-0 touch-sm ${
        enabled ? 'bg-[#FF9F1C]' : 'bg-gray-200 dark:bg-[#3A3A3A]'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[24px] h-[24px] bg-white rounded-full shadow-md transition-transform duration-200 ${
          enabled ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

interface ThemeSegmentProps {
  isDark: boolean
  onLight: () => void
  onDark: () => void
}

/** Sélecteur clair / sombre — style Figma */
export function ThemeSegment({ isDark, onLight, onDark }: ThemeSegmentProps) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-[#2A2A2A] rounded-full p-1 flex-shrink-0">
      <button
        type="button"
        onClick={onLight}
        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all min-w-[56px] touch-sm ${
          !isDark ? 'bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
        }`}
      >
        Clair
      </button>
      <button
        type="button"
        onClick={onDark}
        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all min-w-[56px] touch-sm ${
          isDark ? 'bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
        }`}
      >
        Sombre
      </button>
    </div>
  )
}
