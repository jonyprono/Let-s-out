interface SettingsToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  'aria-label': string
}

/** Segmented switch aligned with the theme selector */
export function SettingsToggle({ enabled, onChange, 'aria-label': ariaLabel }: SettingsToggleProps) {
  return (
    <div
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      className="flex items-center bg-gray-100 dark:bg-[#2A2A2A] rounded-full p-1 flex-shrink-0"
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all min-w-[56px] touch-sm ${
          !enabled ? 'bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
        }`}
      >
        Off
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all min-w-[56px] touch-sm ${
          enabled ? 'bg-[#FF9F1C] dark:bg-[#10B981] text-white shadow-sm' : 'text-gray-500'
        }`}
      >
        On
      </button>
    </div>
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
          isDark ? 'bg-[#10B981] text-white shadow-sm' : 'text-gray-500'
        }`}
      >
        Sombre
      </button>
    </div>
  )
}
