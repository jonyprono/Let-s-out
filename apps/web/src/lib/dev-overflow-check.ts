/**
 * DÉVELOPPEMENT UNIQUEMENT : signale dans la console tout élément plus large que l'écran.
 *
 * html/body sont en `overflow: hidden`, donc un débordement horizontal ne crée pas de barre de
 * défilement visible : il se voit seulement sur iPhone (page qui « glisse » au focus ou au geste).
 * Ce contrôle mesure chaque élément visible et liste ceux qui dépassent la largeur de l'écran.
 * Chargé depuis main.tsx derrière `import.meta.env.DEV` : absent du build de production.
 */
const TOLERANCE_PX = 1

/**
 * Débordement sans effet visible, ignoré :
 * - conteneur rogné (overflow-x hidden/clip) : le surplus est coupé, la page ne glisse pas ;
 * - carrousel horizontal (overflow-x auto/scroll, overflow-y non défilant) : voulu.
 * Est en revanche signalé le cas piège : une zone à défilement VERTICAL (overflow-y auto) défile
 * aussi horizontalement dès qu'un enfant est trop large (overflow-x devient auto) → la page « glisse ».
 */
function isClippedByScroller(el: HTMLElement): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (s.overflowX === 'visible') continue
    if (s.overflowX === 'hidden' || s.overflowX === 'clip') return true
    const scrollsVertically = s.overflowY === 'auto' || s.overflowY === 'scroll'
    return !scrollsVertically
  }
  return false
}

function findOverflowing(): HTMLElement[] {
  const viewport = document.documentElement.clientWidth
  const found: HTMLElement[] = []
  document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    if ((r.right > viewport + TOLERANCE_PX || r.left < -TOLERANCE_PX) && !isClippedByScroller(el)) {
      // Ne garder que l'élément le plus haut de la chaîne (pas tous ses enfants)
      if (!found.some((parent) => parent.contains(el))) found.push(el)
    }
  })
  return found
}

let lastReport = ''

function check() {
  const items = findOverflowing()
  const report = items.map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)}`).join('\n')
  if (report === lastReport) return
  lastReport = report
  if (items.length) {
    console.warn(`[overflow] ${items.length} élément(s) plus large(s) que l'écran (${document.documentElement.clientWidth}px) :`, items)
  }
}

export function startDevOverflowCheck() {
  let timer: number | undefined
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(check, 500)
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
  window.addEventListener('resize', schedule)
  document.addEventListener('focusin', schedule)
  schedule()
}
