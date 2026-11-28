import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'

/** Éléments communs aux écrans d'examen admin (ONG, certification de pages). */

export function StatusFilter<T extends string>({ value, onChange, options }: {
  value: T | undefined
  onChange: (v: T | undefined) => void
  options: readonly T[]
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      {[undefined, ...options].map((opt) => (
        <button
          key={opt ?? 'all'}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${value === opt ? 'bg-action-primary/15 text-action-primary' : 'bg-white/5 text-white/60 hover:text-white'}`}
        >
          <span>{opt ? t(`adminVerif.status.${opt}`) : t('adminVerif.status.ALL')}</span>
        </button>
      ))}
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation()
  const cls = status === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-400'
    : status === 'REJECTED' ? 'bg-red-500/15 text-red-400'
    : 'bg-amber-500/15 text-amber-400'
  return <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${cls}`}><span>{t(`adminVerif.status.${status}`)}</span></span>
}

/** Pièces justificatives : liens signés (10 min) ouverts dans un nouvel onglet (images ou PDF). */
export function DocumentLinks({ documents, labelPrefix }: { documents: Record<string, string | null>; labelPrefix: string }) {
  const { t } = useTranslation()
  const entries = Object.entries(documents)
  if (entries.length === 0) return <p className="text-sm text-white/40"><span>{t('adminVerif.noDocuments')}</span></p>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([key, url]) => (
        <a
          key={key}
          href={url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between gap-3 p-4 rounded-2xl border border-white/10 bg-black/20 ${url ? 'hover:border-action-primary/40' : 'opacity-50 pointer-events-none'}`}
        >
          <span className="text-sm font-semibold text-white"><span>{t(`${labelPrefix}.${key}`)}</span></span>
          <ExternalLink className="w-4 h-4 text-white/50 shrink-0" />
        </a>
      ))}
      <p className="sm:col-span-2 text-[11px] text-white/30"><span>{t('adminVerif.linksExpire')}</span></p>
    </div>
  )
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-4 rounded-2xl border border-white/5 bg-black/20 min-w-0">
      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1"><span>{label}</span></p>
      <div className="font-semibold text-white text-sm break-words">{value || '—'}</div>
    </div>
  )
}

/** Barre d'actions : approuver (contenu libre, ex. choix du badge) ou rejeter avec motif. */
export function ReviewActions({ approveLabel, onApprove, onReject, pending, approveExtra }: {
  approveLabel: string
  onApprove: () => void
  onReject: (reason: string) => void
  pending: boolean
  approveExtra?: ReactNode
}) {
  const { t } = useTranslation()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  if (rejecting) {
    return (
      <div className="space-y-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('adminVerif.rejectPlaceholder')}
          rows={3}
          className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm outline-none focus:border-red-500/50 resize-none text-white placeholder:text-white/30"
        />
        <div className="flex gap-3">
          <button type="button" onClick={() => setRejecting(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold text-white/70">
            <span>{t('adminVerif.cancel')}</span>
          </button>
          <button
            type="button"
            disabled={reason.trim().length < 3 || pending}
            onClick={() => onReject(reason.trim())}
            className="flex-[2] py-3 rounded-xl bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            <span>{t('adminVerif.confirmReject')}</span>
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {approveExtra}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setRejecting(true)}
          className="flex-1 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-bold flex items-center justify-center gap-2"
        >
          <XCircle className="w-4 h-4" /><span>{t('adminVerif.reject')}</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="flex-[1.5] py-3 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{approveLabel}</span>
        </button>
      </div>
    </div>
  )
}
