import { useEffect, useMemo, useRef, useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown01Icon } from 'hugeicons-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { MAX_PLAUSIBLE_AGE, daysInMonth, parseISODate, toISODate } from '@/lib/age'

/**
 * Sélecteur de date de naissance maison — identique sur web, Android et iOS
 * (pas de <input type="date"> natif). Trois boutons Jour / Mois / Année,
 * chacun ouvre une liste dans une feuille du bas. Vide par défaut.
 *
 * `value` / `onChange` : "AAAA-MM-JJ" quand les 3 parties sont choisies, sinon null.
 */

type Part = 'day' | 'month' | 'year'

interface BirthdatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  invalid?: boolean
  describedBy?: string
}

export const BirthdatePicker = forwardRef<HTMLButtonElement, BirthdatePickerProps>(function BirthdatePicker(
  { value, onChange, invalid, describedBy },
  firstButtonRef,
) {
  const { t, i18n } = useTranslation()
  const initial = parseISODate(value)
  const [day, setDay] = useState<number | null>(initial?.d ?? null)
  const [month, setMonth] = useState<number | null>(initial?.m ?? null)
  const [year, setYear] = useState<number | null>(initial?.y ?? null)
  const [open, setOpen] = useState<Part | null>(null)

  // Resynchronise si la valeur change de l'extérieur (ex. réhydratation du store)
  useEffect(() => {
    const parsed = parseISODate(value)
    if (parsed) {
      setDay(parsed.d)
      setMonth(parsed.m)
      setYear(parsed.y)
    }
  }, [value])

  const currentYear = new Date().getFullYear()

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language || 'fr', { month: 'long', timeZone: 'UTC' })
    return Array.from({ length: 12 }, (_, i) => {
      const name = fmt.format(new Date(Date.UTC(2000, i, 1)))
      return name.charAt(0).toUpperCase() + name.slice(1)
    })
  }, [i18n.language])

  const maxDay = month ? daysInMonth(year ?? 0, month) : 31
  const options: Record<Part, { value: number; label: string }[]> = {
    day: Array.from({ length: maxDay }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    month: monthNames.map((label, i) => ({ value: i + 1, label })),
    year: Array.from({ length: MAX_PLAUSIBLE_AGE + 1 }, (_, i) => ({ value: currentYear - i, label: String(currentYear - i) })),
  }

  const emit = (d: number | null, m: number | null, y: number | null) => {
    // Un jour devenu impossible (ex. 31 puis « février ») est vidé, jamais corrigé en silence
    let safeDay = d
    if (safeDay && m && safeDay > daysInMonth(y ?? 0, m)) safeDay = null
    setDay(safeDay)
    setMonth(m)
    setYear(y)
    onChange(safeDay && m && y ? toISODate({ y, m, d: safeDay }) : null)
  }

  const select = (part: Part, v: number) => {
    if (part === 'day') emit(v, month, year)
    if (part === 'month') emit(day, v, year)
    if (part === 'year') emit(day, month, v)
    setOpen(null)
  }

  const fields: { part: Part; placeholder: string; display: string | null; grow: string }[] = [
    { part: 'day', placeholder: t('signupIntro.birthDay'), display: day ? String(day) : null, grow: 'flex-[1]' },
    { part: 'month', placeholder: t('signupIntro.birthMonth'), display: month ? monthNames[month - 1] : null, grow: 'flex-[1.6]' },
    { part: 'year', placeholder: t('signupIntro.birthYear'), display: year ? String(year) : null, grow: 'flex-[1.2]' },
  ]

  const current: Record<Part, number | null> = { day, month, year }

  return (
    <>
      <div className="flex gap-2.5 w-full min-w-0">
        {fields.map(({ part, placeholder, display, grow }, idx) => (
          <button
            key={part}
            ref={idx === 0 ? firstButtonRef : undefined}
            type="button"
            onClick={() => setOpen(part)}
            aria-haspopup="listbox"
            aria-expanded={open === part}
            aria-label={display ? `${placeholder} : ${display}` : placeholder}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={`${grow} min-w-0 h-[var(--input-height)] rounded-[var(--input-radius)] border px-3 flex items-center justify-between gap-1 bg-[var(--color-background-primary)] transition-colors focus:outline-none focus-visible:border-2 focus-visible:border-[var(--border-brand-primary)] ${
              invalid ? 'border-[var(--color-icon-danger)]' : 'border-[var(--border-primary)]'
            }`}
          >
            <span
              className={`truncate font-inter text-[14px] ${
                display ? 'font-semibold text-[var(--color-text-primary)]' : 'font-normal text-[var(--color-text-placeholder)]'
              }`}
            >
              {display ?? placeholder}
            </span>
            <ArrowDown01Icon size={16} strokeWidth={1.5} className="shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          </button>
        ))}
      </div>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? fields.find((f) => f.part === open)?.placeholder : undefined}
      >
        {open && (
          <PickerList
            options={options[open]}
            selected={current[open]}
            label={fields.find((f) => f.part === open)?.placeholder ?? ''}
            onSelect={(v) => select(open, v)}
          />
        )}
      </BottomSheet>
    </>
  )
})

function PickerList({
  options,
  selected,
  label,
  onSelect,
}: {
  options: { value: number; label: string }[]
  selected: number | null
  label: string
  onSelect: (value: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // Ouvre la liste sur l'élément choisi (sinon en haut, sans valeur suggérée) et lui donne le focus
  useEffect(() => {
    const target =
      listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ??
      listRef.current?.querySelector<HTMLButtonElement>('button')
    target?.scrollIntoView({ block: 'center' })
    target?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      className="overflow-y-auto overscroll-contain max-h-[50vh] -mx-5 px-5"
      style={{ scrollbarWidth: 'none' }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(opt.value)}
            className={`w-full h-[48px] rounded-[12px] px-4 flex items-center justify-center font-poppins text-[16px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-primary)] ${
              isSelected
                ? 'bg-[var(--brand-orange-100)] border border-[var(--brand-orange-500)] text-[var(--color-text-primary)] font-semibold'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]'
            }`}
          >
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
