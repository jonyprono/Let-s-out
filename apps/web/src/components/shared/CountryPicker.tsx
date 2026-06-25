import { useState, useRef, useEffect } from 'react'
import { ArrowDown01Icon, Search01Icon, Cancel01Icon } from 'hugeicons-react'
import { COUNTRIES, Country } from '@/lib/countries'

interface CountryPickerProps {
  value: Country
  onChange: (country: Country) => void
  className?: string
}

const LIST_MAX_HEIGHT = 'min(16rem, calc(100dvh - 14rem))'

export function CountryPicker({ value, onChange, className }: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : COUNTRIES

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 80)
    } else {
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (c: Country) => {
    onChange(c)
    setOpen(false)
  }

  /* ── Libellé affiché : "(229)" — format exact Figma ── */
  const dialCode = value.code.replace('+', '')

  return (
    <div className="relative shrink-0 z-30" ref={containerRef}>
      {/* ── Trigger ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={className || "auth-country-btn flex items-center gap-[6px] h-[52px] px-[12px] border border-border-primary rounded-[12px] bg-background-white whitespace-nowrap active:opacity-80 transition-colors"}
        style={{ minWidth: 80 }}
      >
        {/* Drapeau et code pays */}
        <span className="text-[18px] leading-none">{value.flag}</span>
        <span className="auth-country-btn text-[var(--color-text-primary)] font-poppins text-[14px] font-medium ml-1">
          {value.cca2} ({dialCode})
        </span>
        {/* Chevron minimaliste grisé */}
        <ArrowDown01Icon
          size={14}
          strokeWidth={1.5}
          className={`text-[var(--color-text-secondary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown ─────────────────────────────────────── */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-card border border-border-primary rounded-2xl shadow-2xl z-50 w-[min(18rem,calc(100vw-3rem))] overflow-hidden flex flex-col text-foreground"
          style={{ maxHeight: LIST_MAX_HEIGHT }}
        >
          {/* Barre de recherche */}
          <div className="px-3 py-2.5 border-b border-border-primary shrink-0 bg-card">
            <div className="flex items-center gap-2 bg-neutral-gray-100 rounded-xl px-3 py-2">
              <Search01Icon width={16} height={16} strokeWidth={1} className="text-neutral-gray-400 shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-neutral-gray-400 border-none focus:ring-0"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="shrink-0">
                  <Cancel01Icon width={14} height={14} strokeWidth={1.4} className="text-neutral-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Liste des pays */}
          <div
            className="overflow-y-auto overscroll-contain flex-1 min-h-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-neutral-gray-400">Aucun pays trouvé</div>
            ) : (
              filtered.map((c, i) => (
                <button
                  key={`${c.code}-${c.name}-${i}`}
                  type="button"
                  onClick={() => select(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-gray-100 active:bg-neutral-gray-200 text-left transition-colors border-b border-neutral-gray-200 last:border-0 ${
                    value.code === c.code && value.name === c.name ? 'bg-neutral-gray-100' : ''
                  }`}
                >
                  <span className="text-xl leading-none w-7 text-center shrink-0">{c.flag}</span>
                  <span className="flex-1 text-[14px] text-foreground font-medium truncate">{c.name}</span>
                  <span className="text-[12px] text-neutral-gray-400 shrink-0">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
