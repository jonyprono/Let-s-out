/**
 * Ouvre le paiement FedaPay (checkout.js) avec la transaction préparée par notre API
 * (POST /payments/fedapay/initiate). Même rendu que JoinEventBottomSheet : la fenêtre
 * FedaPay est présentée comme une feuille du bas avec un fond assombri.
 */
export interface FedapayInitiateResponse {
  publicKey: string
  transactionId: number | string
  transactionToken?: string
  amount: number
  description?: string
}

const SCRIPT_SRC = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'

function loadScript(): Promise<any> {
  const w = window as any
  if (w.FedaPay) return Promise.resolve(w.FedaPay)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve((window as any).FedaPay))
    script.addEventListener('error', () => reject(new Error('FEDAPAY_SCRIPT')))
    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })
}

export function removeFedapayBackdrop() {
  document.getElementById('fedapay-backdrop')?.remove()
}

function styleAsBottomSheet() {
  let attempts = 0
  const timer = setInterval(() => {
    attempts++
    if (attempts > 20) { clearInterval(timer); return }
    const fedaEl = Array.from(document.querySelectorAll('body > div')).find((el) => {
      const s = window.getComputedStyle(el)
      return s.position === 'fixed' && parseInt(s.zIndex || '0') > 100 && el.id !== 'fedapay-backdrop'
    }) as HTMLElement | undefined
    if (!fedaEl || fedaEl.dataset.styledAsSheet) return
    clearInterval(timer)
    fedaEl.dataset.styledAsSheet = 'true'
    if (!document.getElementById('fedapay-backdrop')) {
      const backdrop = document.createElement('div')
      backdrop.id = 'fedapay-backdrop'
      backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9990;'
      document.body.appendChild(backdrop)
    }
    fedaEl.style.cssText = [
      'position: fixed !important', 'top: auto !important', 'bottom: 0 !important', 'left: 0 !important', 'right: 0 !important',
      'width: 100% !important', 'height: 85dvh !important', 'max-height: 85dvh !important',
      'border-radius: 20px 20px 0 0 !important', 'overflow: hidden !important', 'z-index: 9999 !important',
      'box-shadow: 0 -8px 32px rgba(0,0,0,0.25) !important', 'animation: slideUpSheet 0.35s cubic-bezier(0.32,0.72,0,1) !important',
    ].join(';')
    if (!document.getElementById('fedapay-sheet-style')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'fedapay-sheet-style'
      styleEl.textContent = '@keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }'
      document.head.appendChild(styleEl)
    }
    const iframe = fedaEl.querySelector('iframe') as HTMLElement | null
    if (iframe) iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;'
  }, 100)
}

export async function openFedapayCheckout(
  data: FedapayInitiateResponse,
  handlers: { onDismissed: () => void; onCompleted: () => void | Promise<void> },
) {
  const FedaPay = await loadScript()
  FedaPay.init({
    public_key: data.publicKey,
    transaction: { id: data.transactionId, token: data.transactionToken, amount: data.amount, description: data.description },
    onComplete: async (resp: any) => {
      removeFedapayBackdrop()
      if (resp?.reason === FedaPay.DIALOG_DISMISSED) handlers.onDismissed()
      else await handlers.onCompleted()
    },
  }).open()
  styleAsBottomSheet()
}
