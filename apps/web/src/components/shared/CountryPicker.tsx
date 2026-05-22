import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { COUNTRIES, Country } from '@/lib/countries'

interface CountryPickerProps {
  value: Country
  onChange: (country: Country) => void
}

const LIST_MAX_HEIGHT = 'min(16rem, calc(100dvh - 14rem))'

export function CountryPicker({ value, onChange }: CountryPickerProps) {
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

  return (
    <div className="relative shrink-0 z-30" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-3 py-3.5 border border-border rounded-xl bg-card text-[15px] font-medium whitespace-nowrap text-foreground active:opacity-80 transition-colors"
      >
        <span className="text-lg leading-none">{value.flag}</span>
        <span className="text-[13px] ml-0.5 text-foreground">
          ({value.code.replace('+', '')})
        </span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground ml-0.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-card border border-border rounded-2xl shadow-2xl z-50 w-[min(18rem,calc(100vw-3rem))] overflow-hidden flex flex-col text-foreground"
          style={{ maxHeight: LIST_MAX_HEIGHT }}
        >
          <div className="px-3 py-2.5 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="shrink-0 touch-sm">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div
            className="overflow-y-auto overscroll-contain flex-1 min-h-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground">Aucun pays trouvé</div>
            ) : (
              filtered.map((c, i) => (
                <button
                  key={`${c.code}-${c.name}-${i}`}
                  type="button"
                  onClick={() => select(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent active:bg-accent/80 text-left transition-colors border-b border-border last:border-0 ${
                    value.code === c.code && value.name === c.name ? 'bg-accent' : ''
                  }`}
                >
                  <span className="text-xl leading-none w-7 text-center shrink-0">{c.flag}</span>
                  <span className="flex-1 text-[14px] text-foreground font-medium truncate">{c.name}</span>
                  <span className="text-[12px] text-muted-foreground shrink-0">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
