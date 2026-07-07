import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown01Icon, Search01Icon, Cancel01Icon } from 'hugeicons-react'
import { COUNTRIES, Country } from '@/lib/countries'

interface CountryPickerProps {
  value: Country
  onChange: (country: Country) => void
  className?: string
}

export function CountryPicker({ value, onChange, className }: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const isForceLight = typeof document !== 'undefined' ? !!document.querySelector('.force-light') : false;

  // Use Intl.DisplayNames to translate country names to French on the fly
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' })
    } catch(e) {
      return null
    }
  }, [])

  const countriesFr = useMemo(() => {
    const list = COUNTRIES.map(c => {
      let frName = c.name
      if (regionNames) {
        try {
          frName = regionNames.of(c.cca2) || c.name
        } catch(e) {
          // ignore error
        }
      }
      return { ...c, frName }
    })
    // Ensure Benin is at the top (optional, or just sort everything)
    // Actually, sorting alphabetically is requested
    return list.sort((a, b) => a.frName.localeCompare(b.frName, 'fr', { sensitivity: 'base' }))
  }, [regionNames])

  // Diacritics removal for robust search (e.g. "benin" matches "Bénin")
  const normalizeStr = (str: string) => 
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const filtered = search.trim()
    ? countriesFr.filter(c =>
        normalizeStr(c.frName).includes(normalizeStr(search)) ||
        c.code.includes(search)
      )
    : countriesFr

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 80)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    } else {
      setSearch('')
    }
  }, [open])

  const select = (c: Country) => {
    onChange(c)
    setOpen(false)
  }

  /* ── Libellé affiché : "(229)" ── */
  const dialCode = value.code.replace('+', '')

  return (
    <div className="relative shrink-0 z-30">
      {/* ── Trigger ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || "auth-country-btn flex items-center gap-[6px] h-[52px] px-[12px] border border-border-primary rounded-[12px] bg-background-white whitespace-nowrap active:opacity-80 transition-colors"}
        style={{ minWidth: 80 }}
      >
        {/* Drapeau et code pays */}
        <span className="text-[18px] leading-none">{value.flag}</span>
        <span className="auth-country-btn text-[var(--color-text-primary)] font-poppins text-[14px] font-medium ml-1">
          ({dialCode})
        </span>
        {/* Chevron minimaliste grisé */}
        <ArrowDown01Icon
          size={14}
          strokeWidth={1.5}
          className={`text-[var(--color-text-secondary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Modal Portal ─────────────────────────────────────── */}
      {open && createPortal(
        <div 
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 ${isForceLight ? 'force-light' : ''}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className="bg-[var(--color-background-primary)] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden max-h-[80vh] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Barre de recherche */}
            <div className="px-4 py-3 border-b border-[#E0E0E0] shrink-0 bg-[var(--color-background-primary)]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-poppins font-semibold text-[16px] text-[var(--color-text-primary)]">Choisir un pays</span>
                <button type="button" onClick={() => setOpen(false)} className="p-1 active:scale-95 transition-transform">
                  <Cancel01Icon size={20} className="text-[var(--color-icon-secondary)]" />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[var(--color-background-secondary)] rounded-xl px-3 py-2.5">
                <Search01Icon width={18} height={18} strokeWidth={1.5} className="text-[#A3A3A3] shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un pays..."
                  className="flex-1 bg-transparent text-[14px] text-[var(--color-text-primary)] font-poppins outline-none placeholder:text-[#A3A3A3] border-none focus:ring-0"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="shrink-0 p-1">
                    <Cancel01Icon width={16} height={16} strokeWidth={1.5} className="text-[#A3A3A3]" />
                  </button>
                )}
              </div>
            </div>

            {/* Liste des pays */}
            <div
              className="overflow-y-auto overscroll-contain flex-1 min-h-0 bg-[var(--color-background-primary)]"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-[14px] text-[#A3A3A3] font-poppins">
                  Aucun pays trouvé
                </div>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={`${c.code}-${c.cca2}-${i}`}
                    type="button"
                    onClick={() => select(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA] active:bg-[#F2F2F2] text-left transition-colors border-b border-[#F0F0F0] last:border-0 ${
                      value.cca2 === c.cca2 ? 'bg-[#FAFAFA]' : ''
                    }`}
                  >
                    <span className="text-2xl leading-none w-8 text-center shrink-0">{c.flag}</span>
                    <span className="flex-1 text-[15px] text-[var(--color-text-primary)] font-medium font-poppins truncate">{c.frName}</span>
                    <span className="text-[13px] text-[#766F6E] shrink-0 font-medium">{c.code}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
