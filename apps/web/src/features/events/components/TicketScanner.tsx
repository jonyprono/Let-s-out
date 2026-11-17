import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ScanLine, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { toast } from 'sonner'
import { eventsApi, type CheckInError, type CheckInSuccess } from '@/features/events/api'
import { hapticFeedback } from '@/lib/haptics'
import { useAuthStore } from '@/stores/auth.store'
import { isIosNativeScannerAvailable, isNativeScannerAvailable, openAppSettings, scanQrWithIosScanner, setScannerBackdrop, settingsPlatform } from '@/lib/camera-scan'

type Verdict =
  | { kind: 'valid'; data: CheckInSuccess }
  | { kind: 'refused'; status: number; data: CheckInError }

/**
 * Contrôle des billets à l'entrée (route /events/:id/check-in).
 * Réservé au créateur et aux co-organisateurs : l'écran le vérifie pour l'affichage, mais
 * l'autorité est le serveur (403 pour tout autre utilisateur).
 */
export function TicketScanner() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const [isScanning, setIsScanning] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const scanningRef = useRef(false)
  const handledRef = useRef(false)

  const { data: event } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => (await eventsApi.getById(id)).data as any,
    enabled: !!id,
  })
  const isOrganizer = !!event && !!user && (event.creatorId === user.id || (event.coHostIds || []).includes(user.id))

  // Libère toujours la caméra en quittant l'écran
  useEffect(() => () => {
    if (scanningRef.current) {
      BarcodeScanner.removeAllListeners().catch(() => {})
      BarcodeScanner.stopScan().catch(() => {})
      setScannerBackdrop(false)
    }
  }, [])

  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language || 'fr', opts).format(new Date(d))

  const submit = async (payload: string) => {
    if (!payload.trim() || isChecking) return
    setIsChecking(true)
    setVerdict(null)
    try {
      const data = await eventsApi.checkInTicket(id, payload.trim())
      setVerdict({ kind: 'valid', data })
      hapticFeedback.success()
    } catch (err: any) {
      const status = err?.response?.status
      const body = err?.response?.data as CheckInError | undefined
      if (status && body?.code) {
        setVerdict({ kind: 'refused', status, data: body })
        hapticFeedback.error()
      } else {
        toast.error(t('tickets.networkError'))
      }
    } finally {
      setIsChecking(false)
      setManualCode('')
    }
  }

  const stopScan = async () => {
    setScannerBackdrop(false)
    scanningRef.current = false
    setIsScanning(false)
    try {
      await BarcodeScanner.removeAllListeners()
      await BarcodeScanner.stopScan()
    } catch { /* déjà arrêté */ }
  }

  const showCameraDenied = () => {
    toast.error(t(settingsPlatform() === 'ios' ? 'tickets.cameraDeniedIos' : 'tickets.cameraDeniedAndroid'), {
      duration: 8000,
      action: {
        label: t('tickets.settings'),
        onClick: () => { openAppSettings().then((ok) => { if (!ok) toast.error(t('tickets.settingsOpenError')) }) },
      },
    })
  }

  const startScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.info(t('tickets.scanNativeOnly'))
      return
    }
    // iPhone : écran caméra natif du plugin officiel (permission iOS demandée au 1er scan)
    if (isIosNativeScannerAvailable()) {
      const res = await scanQrWithIosScanner(t('tickets.aimAtTicket'))
      if (res.status === 'ok') submit(res.value)
      else if (res.status === 'denied') showCameraDenied()
      else if (res.status === 'error') toast.error(t('tickets.scanStartError'))
      return
    }
    // Aucun plugin de scan dans ce build (ancienne version iOS) : message exact, saisie manuelle possible
    if (!isNativeScannerAvailable()) {
      toast.info(t('tickets.scanUnavailableIos'))
      return
    }
    if (Capacitor.getPlatform() === 'android') {
      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
        if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule()
      } catch { /* le scan tentera quand même */ }
    }
    try {
      // 1er scan : `prompt` → vraie fenêtre système. Déjà refusé : `denied` → explication + Réglages.
      const perm = await BarcodeScanner.checkPermissions()
      const granted = perm.camera === 'granted' || (await BarcodeScanner.requestPermissions()).camera === 'granted'
      if (!granted) {
        showCameraDenied()
        return
      }
      setVerdict(null)
      handledRef.current = false
      setScannerBackdrop(true)
      scanningRef.current = true
      setIsScanning(true)
      await BarcodeScanner.addListener('barcodesScanned', async (result: any) => {
        const value = result?.barcodes?.[0]?.rawValue || result?.barcodes?.[0]?.displayValue
        if (!value || handledRef.current) return
        handledRef.current = true // un seul envoi par ouverture de caméra
        await stopScan()
        submit(value)
      })
      await BarcodeScanner.startScan()
    } catch {
      toast.error(t('tickets.scanStartError'))
      stopScan()
    }
  }

  const onManualSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(manualCode)
  }

  // ── Caméra active ───────────────────────────────────────────────────
  if (isScanning) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-transparent">
        <div className="absolute top-0 inset-x-0 px-6 pt-safe-6 pb-6 flex items-center justify-between z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
          <button type="button" onClick={stopScan} aria-label={t('tickets.cancel')} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
            <ChevronLeft className="w-6 h-6 text-gray-800" aria-hidden="true" />
          </button>
          <span className="text-white font-bold"><span>{t('tickets.scanTitle')}</span></span>
          <div className="w-10" />
        </div>
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            <div className="absolute inset-0 shadow-[0_0_0_4000px_rgba(0,0,0,0.6)] rounded-3xl" />
            <div className="absolute inset-0 border-[3px] border-[var(--brand-orange-500)] rounded-3xl" />
          </div>
        </div>
        <div className="p-8 text-center bg-black/80 z-10" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
          <p className="text-white text-sm mb-6"><span>{t('tickets.aimAtTicket')}</span></p>
          {/* Mode scan uniquement : même bouton contrasté que « Rejoindre un événement privé » */}
          <button type="button" onClick={stopScan} className="px-8 py-3 bg-[#FF7A00] rounded-full text-white font-bold shadow-lg shadow-black/40 ring-1 ring-white/25 active:scale-95 transition-transform">
            <span>{t('tickets.cancel')}</span>
          </button>
        </div>
      </div>
    )
  }

  const refusal = verdict?.kind === 'refused' ? verdict.data : null
  const refusalTitle = refusal
    ? refusal.code === 'TICKET_ALREADY_USED' ? t('tickets.alreadyUsed')
      : refusal.code === 'TICKET_NOT_CONFIRMED' ? t('tickets.notConfirmed')
      : refusal.code === 'TICKET_WRONG_EVENT' ? t('tickets.wrongEvent')
      : refusal.code === 'CHECKIN_FORBIDDEN' ? t('tickets.forbidden')
      : t('tickets.notFound')
    : ''

  // ── Écran principal ────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#111]">
      <div className="px-4 pt-safe-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-white/10">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('tickets.back')} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white"><span>{t('tickets.checkInTitle')}</span></h1>
          {event?.title && <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate"><span>{event.title}</span></p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
        {event && !isOrganizer && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-[13px] text-red-800 dark:text-red-300" role="alert">
            <span>{t('tickets.forbidden')}</span>
          </div>
        )}

        {/* Verdict du dernier scan */}
        <div aria-live="assertive" className="min-h-[1px]">
          {isChecking && (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-500" role="status">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" /><span>{t('tickets.checking')}</span>
            </div>
          )}
          {verdict?.kind === 'valid' && (
            <div className="rounded-3xl bg-green-600 text-white p-6 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="w-16 h-16" aria-hidden="true" />
              <p className="text-[28px] font-extrabold tracking-wide uppercase"><span>{t('tickets.validBig')}</span></p>
              {verdict.data.tierName && (
                <p className="max-w-full px-5 py-2 rounded-2xl bg-white text-green-700 text-[30px] leading-tight font-black uppercase break-words">
                  <span>{verdict.data.tierName}</span>
                </p>
              )}
              <p className="text-[13px] uppercase tracking-wider opacity-80 mt-1"><span>{t('tickets.holder')}</span></p>
              <p className="text-[20px] font-bold -mt-1"><span>{verdict.data.participant.name}</span></p>
              <p className="text-[13px] opacity-90"><span>{t('tickets.validatedAt', { time: fmt(verdict.data.checkedInAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}</span></p>
            </div>
          )}
          {refusal && (
            <div className={`rounded-3xl p-6 flex flex-col items-center gap-2 text-center text-white ${refusal.code === 'TICKET_NOT_CONFIRMED' ? 'bg-amber-600' : 'bg-red-600'}`}>
              {refusal.code === 'TICKET_NOT_CONFIRMED'
                ? <AlertTriangle className="w-16 h-16" aria-hidden="true" />
                : <XCircle className="w-16 h-16" aria-hidden="true" />}
              <p className={`font-extrabold ${refusal.code === 'TICKET_ALREADY_USED' ? 'text-[28px] uppercase tracking-wide' : 'text-[22px]'}`}>
                <span>{refusal.code === 'TICKET_ALREADY_USED' ? t('tickets.alreadyUsedBig') : refusalTitle}</span>
              </p>
              {refusal.tierName && (
                <p className="max-w-full px-4 py-1.5 rounded-2xl bg-white/95 text-red-700 text-[22px] leading-tight font-black uppercase break-words">
                  <span>{refusal.tierName}</span>
                </p>
              )}
              {refusal.participant?.name && <p className="text-[17px] font-semibold"><span>{refusal.participant.name}</span></p>}
              {refusal.code === 'TICKET_ALREADY_USED' && refusal.firstCheckedInAt && (
                <p className="text-[14px] font-medium">
                  <span>
                    {t('tickets.firstScanAt', {
                      date: fmt(refusal.firstCheckedInAt, { day: 'numeric', month: 'long' }),
                      time: fmt(refusal.firstCheckedInAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    })}
                  </span>
                  {refusal.checkedInBy && <span>{' '}{t('tickets.by', { name: refusal.checkedInBy })}</span>}
                </p>
              )}
              <p className="text-[13px] opacity-90"><span>{t('tickets.denyEntry')}</span></p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={startScan}
          disabled={!isOrganizer || isChecking}
          className="w-full h-14 rounded-full bg-[var(--brand-orange-500)] text-white font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ScanLine className="w-6 h-6" aria-hidden="true" />
          <span>{verdict ? t('tickets.scanNext') : t('tickets.scanTicket')}</span>
        </button>

        {/* Saisie manuelle : web, ou QR abîmé / écran trop sombre */}
        <form onSubmit={onManualSubmit} className="flex flex-col gap-2">
          <label htmlFor="ticket-manual" className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
            <span>{t('tickets.manualLabel')}</span>
          </label>
          <div className="flex gap-2">
            <input
              id="ticket-manual"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="LO1.…"
              className="flex-1 min-w-0 h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 font-mono text-[16px] text-gray-900 dark:text-white"
            />
            <button type="submit" disabled={!isOrganizer || !manualCode.trim() || isChecking} className="px-4 h-11 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-semibold disabled:opacity-40">
              <span>{t('tickets.check')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
