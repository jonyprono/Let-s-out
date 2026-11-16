import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Pencil, Plus, Trash2, Ticket } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { intlLocale } from '@/lib/locale'
import { PAYOUT_NETWORKS, TIER_LIMITS, tierInputError, type PayoutInfo } from '../api'

/** Montant en F CFA, formaté selon la langue (« 15 000 F CFA ») */
export function formatFcfa(n: number | null | undefined) {
  return `${Math.round(Number(n) || 0).toLocaleString(intlLocale())} F CFA`
}

/** Part nette de l'organisateur sur un prix (même arrondi que le serveur) */
export function netOf(price: number, percent: number) {
  return price - Math.round((price * percent) / 100)
}

const inputCls =
  'w-full px-4 py-3.5 border rounded-[12px] text-[16px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] bg-[var(--color-background-primary)]'
const borderOk = 'border-[var(--border-default)]'
const borderErr = 'border-[var(--functional-red-500)]'
const labelCls = 'text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5'

// ── Encart commission (transparence) ──────────────────────────────────────────
export function CommissionNotice({ percent, delayHours }: { percent: number; delayHours?: number }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-[12px] bg-[var(--brand-orange-50,#FFF4E8)] dark:bg-[#2A1A0A] border border-[#FFD2A6] dark:border-[#5C3511] p-3.5 flex gap-3 items-start">
      <Info className="w-[18px] h-[18px] text-[#FF7A00] shrink-0 mt-[1px]" aria-hidden="true" />
      <div className="text-[12px] leading-[1.45] text-[var(--color-text-secondary)]" style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="font-semibold text-[var(--color-text-primary)] text-[13px]">
          <span>{t('ticketing.commission.title', { percent })}</span>
        </p>
        <p className="mt-0.5"><span>{t('ticketing.commission.feesIncluded')}</span></p>
        {delayHours !== undefined && (
          <p className="mt-0.5"><span>{t('ticketing.commission.payoutRule', { hours: delayHours })}</span></p>
        )}
      </div>
    </div>
  )
}

// ── Carte d'une catégorie ─────────────────────────────────────────────────────
export interface TierCardData {
  name: string
  description?: string | null
  price: number
  totalQuantity: number
  soldQuantity?: number
  isActive?: boolean
}

export function TierCard({
  tier, percent, onEdit, onDelete, onToggleActive, busy,
}: {
  tier: TierCardData
  percent: number
  onEdit?: () => void
  onDelete?: () => void
  onToggleActive?: () => void
  busy?: boolean
}) {
  const { t } = useTranslation()
  const sold = tier.soldQuantity ?? 0
  const inactive = tier.isActive === false
  const soldOut = sold >= tier.totalQuantity
  const pct = tier.totalQuantity > 0 ? Math.min(100, Math.round((sold / tier.totalQuantity) * 100)) : 0
  return (
    <div className={`rounded-[12px] border border-[var(--border-default)] bg-[var(--color-background-primary)] p-3.5 ${inactive ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#FFF1E3] dark:bg-[#3A230D] flex items-center justify-center shrink-0">
          <Ticket className="w-[18px] h-[18px] text-[#FF7A00]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span>{tier.name}</span>
            </p>
            {inactive && (
              <span className="text-[10px] font-semibold px-1.5 py-[1px] rounded bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]">
                <span>{t('ticketing.tier.paused')}</span>
              </span>
            )}
            {!inactive && soldOut && (
              <span className="text-[10px] font-semibold px-1.5 py-[1px] rounded bg-[#FDE8E8] text-[#C81E1E] dark:bg-[#3B1414] dark:text-[#F98080]">
                <span>{t('ticketing.tier.soldOut')}</span>
              </span>
            )}
          </div>
          {tier.description ? (
            <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2"><span>{tier.description}</span></p>
          ) : null}
          <p className="text-[15px] font-bold text-[#FF7A00] mt-1"><span>{formatFcfa(tier.price)}</span></p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            <span>{t('ticketing.tier.netPerTicket', { amount: formatFcfa(netOf(tier.price, percent)) })}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button type="button" onClick={onEdit} disabled={busy} aria-label={t('ticketing.tier.edit')}
              className="w-8 h-8 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center active:scale-95 disabled:opacity-50">
              <Pencil className="w-4 h-4 text-[var(--color-icon-primary)]" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} disabled={busy} aria-label={t('ticketing.tier.delete')}
              className="w-8 h-8 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center active:scale-95 disabled:opacity-50">
              <Trash2 className="w-4 h-4 text-[var(--functional-red-500,#E02424)]" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
          <span>{t('ticketing.tier.soldOf', { sold: sold.toLocaleString(intlLocale()), total: tier.totalQuantity.toLocaleString(intlLocale()) })}</span>
          {onToggleActive && (
            <button type="button" onClick={onToggleActive} disabled={busy} className="font-semibold text-[#FF7A00] disabled:opacity-50">
              <span>{inactive ? t('ticketing.tier.resume') : t('ticketing.tier.pause')}</span>
            </button>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-background-secondary)] overflow-hidden">
          <div className="h-full rounded-full bg-[#FF7A00]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── Formulaire d'une catégorie (ajout / modification) ─────────────────────────
export interface TierFormValues { name: string; description: string; price: string; totalQuantity: string }

export function TierFormSheet({
  open, onClose, initial, minQuantity = 0, percent, saving, onSubmit,
}: {
  open: boolean
  onClose: () => void
  initial?: Partial<TierFormValues> | null
  /** Billets déjà vendus : le quota ne peut pas descendre en dessous */
  minQuantity?: number
  percent: number
  saving?: boolean
  onSubmit: (v: { name: string; description: string | null; price: number; totalQuantity: number }) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [v, setV] = useState<TierFormValues>({ name: '', description: '', price: '', totalQuantity: '' })
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setV({ name: initial?.name ?? '', description: initial?.description ?? '', price: initial?.price ?? '', totalQuantity: initial?.totalQuantity ?? '' })
      setTouched(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const err = tierInputError(v, minQuantity)
  const descTooLong = v.description.trim().length > TIER_LIMITS.descriptionMax
  const show = (f: string) => touched && err === f
  const price = Number(v.price)

  const submit = () => {
    setTouched(true)
    if (err || descTooLong) return
    onSubmit({ name: v.name.trim(), description: v.description.trim() || null, price: Number(v.price), totalQuantity: Number(v.totalQuantity) })
  }

  return (
    <BottomSheet title={initial?.name ? t('ticketing.tier.editTitle') : t('ticketing.tier.addTitle')} open={open} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className={labelCls}><span>{t('ticketing.tier.name')}</span></p>
          <input value={v.name} maxLength={TIER_LIMITS.nameMax} onChange={(e) => setV({ ...v, name: e.target.value })}
            placeholder={t('ticketing.tier.namePlaceholder')} className={`${inputCls} ${show('name') ? borderErr : borderOk}`} />
          {show('name') && <p className="text-[11px] text-[var(--functional-red-500)] mt-1 ml-1"><span>{t('ticketing.errors.name', { max: TIER_LIMITS.nameMax })}</span></p>}
        </div>
        <div>
          <p className={labelCls}><span>{t('ticketing.tier.description')}</span></p>
          <textarea value={v.description} rows={2} maxLength={TIER_LIMITS.descriptionMax} onChange={(e) => setV({ ...v, description: e.target.value })}
            placeholder={t('ticketing.tier.descriptionPlaceholder')} className={`${inputCls} ${borderOk} resize-none`} />
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 ml-1"><span>{t('createEvent.fields.optional')}</span></p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={labelCls}><span>{t('ticketing.tier.price')}</span></p>
            <div className="relative flex items-center">
              <input type="number" inputMode="numeric" min={TIER_LIMITS.priceMin} step={1} value={v.price}
                onChange={(e) => setV({ ...v, price: e.target.value })} placeholder="5000"
                className={`${inputCls} pr-12 ${show('price') ? borderErr : borderOk}`} />
              <span className="absolute right-3 text-[12px] font-semibold text-[var(--color-text-secondary)] pointer-events-none">F</span>
            </div>
          </div>
          <div>
            <p className={labelCls}><span>{t('ticketing.tier.quantity')}</span></p>
            <input type="number" inputMode="numeric" min={Math.max(1, minQuantity)} step={1} value={v.totalQuantity}
              onChange={(e) => setV({ ...v, totalQuantity: e.target.value })} placeholder="100"
              className={`${inputCls} ${show('totalQuantity') ? borderErr : borderOk}`} />
          </div>
        </div>
        {show('price') && <p className="text-[11px] text-[var(--functional-red-500)] -mt-2 ml-1"><span>{t('ticketing.errors.price', { min: formatFcfa(TIER_LIMITS.priceMin) })}</span></p>}
        {show('totalQuantity') && (
          <p className="text-[11px] text-[var(--functional-red-500)] -mt-2 ml-1">
            <span>{minQuantity > 0 ? t('ticketing.errors.quantityBelowSold', { sold: minQuantity }) : t('ticketing.errors.quantity')}</span>
          </p>
        )}
        {Number.isFinite(price) && price >= TIER_LIMITS.priceMin && (
          <div className="rounded-[10px] bg-[var(--color-background-secondary)] px-3 py-2.5 text-[12px] text-[var(--color-text-secondary)] space-y-0.5">
            <div className="flex justify-between"><span>{t('ticketing.summary.ticketPrice')}</span><span className="font-medium text-[var(--color-text-primary)]">{formatFcfa(price)}</span></div>
            <div className="flex justify-between"><span>{t('ticketing.summary.commission', { percent })}</span><span>{`− ${formatFcfa(price - netOf(price, percent))}`}</span></div>
            <div className="flex justify-between font-semibold text-[var(--color-text-primary)]"><span>{t('ticketing.summary.youReceive')}</span><span>{formatFcfa(netOf(price, percent))}</span></div>
          </div>
        )}
        <PrimaryButton onClick={submit} loading={saving} disabled={saving}>
          <span>{initial?.name ? t('ticketing.tier.save') : t('ticketing.tier.add')}</span>
        </PrimaryButton>
      </div>
    </BottomSheet>
  )
}

export function AddTierButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full h-11 rounded-[12px] border border-dashed border-[#FF7A00] text-[#FF7A00] font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50">
      <Plus className="w-4 h-4" aria-hidden="true" />
      <span>{t('ticketing.tier.addButton')}</span>
    </button>
  )
}

// ── Coordonnées Mobile Money ──────────────────────────────────────────────────
export function PayoutAccountFields({
  value, onChange, errorField, disabled,
}: {
  value: PayoutInfo
  onChange: (v: PayoutInfo) => void
  errorField?: 'phone' | 'network' | 'name' | null
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <div>
        <p className={labelCls}><span>{t('ticketing.payout.network')}</span></p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('ticketing.payout.network')}>
          {PAYOUT_NETWORKS.map((n) => {
            const selected = value.network === n
            return (
              <button key={n} type="button" role="radio" aria-checked={selected} disabled={disabled}
                onClick={() => onChange({ ...value, network: n })}
                className={`h-11 rounded-[12px] border text-[13px] font-semibold transition-colors disabled:opacity-60 ${selected
                  ? 'border-[#FF7A00] bg-[#FFF1E3] text-[#FF7A00] dark:bg-[#3A230D]'
                  : `${errorField === 'network' ? borderErr : borderOk} bg-[var(--color-background-primary)] text-[var(--color-text-primary)]`}`}>
                {/* Noms d'opérateurs : jamais traduits */}
                <span>{n}</span>
              </button>
            )
          })}
        </div>
        {errorField === 'network' && <p className="text-[11px] text-[var(--functional-red-500)] mt-1 ml-1"><span>{t('ticketing.errors.network')}</span></p>}
      </div>
      <div>
        <p className={labelCls}><span>{t('ticketing.payout.phone')}</span></p>
        <input type="tel" inputMode="tel" autoComplete="tel" value={value.phone} disabled={disabled}
          onChange={(e) => onChange({ ...value, phone: e.target.value })} placeholder="+229 01 97 00 00 00"
          className={`${inputCls} ${errorField === 'phone' ? borderErr : borderOk}`} />
        {errorField === 'phone' && <p className="text-[11px] text-[var(--functional-red-500)] mt-1 ml-1"><span>{t('ticketing.errors.phone')}</span></p>}
      </div>
      <div>
        <p className={labelCls}><span>{t('ticketing.payout.holderName')}</span></p>
        <input value={value.name} maxLength={80} autoComplete="name" disabled={disabled}
          onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder={t('ticketing.payout.holderPlaceholder')}
          className={`${inputCls} ${errorField === 'name' ? borderErr : borderOk}`} />
        {errorField === 'name' && <p className="text-[11px] text-[var(--functional-red-500)] mt-1 ml-1"><span>{t('ticketing.errors.holderName')}</span></p>}
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] ml-1"><span>{t('ticketing.payout.privacy')}</span></p>
    </div>
  )
}
