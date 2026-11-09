// Modo televisor: la misma app, pero para manejarla con el control remoto desde el sofá.
// - Se activa sola en los navegadores de Samsung (Tizen), LG (webOS) y Android TV / Fire TV, o con ?tv=1 en la
//   dirección (así la abren las apps de televisor). ?tv=0 lo apaga. Queda recordado en este aparato.
// - Las flechas mueven el foco al botón o póster más cercano en esa dirección, OK lo abre y Atrás cierra lo que
//   esté abierto o vuelve a la pantalla anterior.

import { exitApp, shell } from './tvShell'

const KEY = 'hv.tv'
const TV_UA = /Tizen|Web0S|webOS|SMART-TV|SmartTV|HbbTV|Android TV|GoogleTV|AFT[A-Z]|BRAVIA|CrKey/i

function detect(): boolean {
  const q = new URLSearchParams(location.search).get('tv')
  try {
    if (q === '1') localStorage.setItem(KEY, '1')
    if (q === '0') localStorage.removeItem(KEY)
    if (localStorage.getItem(KEY) === '1') return true
  } catch {
    if (q === '1') return true
  }
  return q !== '0' && TV_UA.test(navigator.userAgent)
}

export const isTV = detect()

// Todo lo que se puede elegir con el control
const FOCUSABLE = 'a[href], summary, button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type Dir = 'up' | 'down' | 'left' | 'right'
const ARROWS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Up: 'up', Down: 'down', Left: 'left', Right: 'right' }
// Atrás: Samsung 10009, LG 461; en el computador sirve Escape para probar
const BACK_CODES = new Set([10009, 461])
const isBack = (e: KeyboardEvent) => BACK_CODES.has(e.keyCode) || e.key === 'GoBack' || e.key === 'XF86Back' || e.key === 'BrowserBack' || e.key === 'Escape'

// Lo de encima (un tráiler, la pantalla de entrar, "¡Coinciden!") atrapa el foco: no se puede salir con las flechas hacia lo de atrás
function scope(): ParentNode {
  const open = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(visible)
  return open[open.length - 1] ?? document
}

function visible(el: HTMLElement): boolean {
  if (el.closest('[aria-hidden="true"], [inert]')) return false
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  const st = getComputedStyle(el)
  return st.visibility !== 'hidden' && st.display !== 'none'
}

const candidates = () => [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible)

// El más cercano en esa dirección; lo que queda de lado pesa más que lo que queda lejos, para que en una fila se
// siga por la fila y en una columna por la columna
function nearest(from: DOMRect, dir: Dir, list: HTMLElement[], self: Element | null): HTMLElement | null {
  // a los lados se busca primero en la misma fila; solo si no hay nada ahí se baja o sube a otra
  if (dir === 'left' || dir === 'right') {
    const row = list.filter((el) => {
      const r = el.getBoundingClientRect()
      return r.bottom > from.top + 4 && r.top < from.bottom - 4
    })
    const inRow = closest(from, dir, row, self)
    if (inRow) return inRow
  }
  return closest(from, dir, list, self)
}

function closest(from: DOMRect, dir: Dir, list: HTMLElement[], self: Element | null): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestScore = Infinity
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  for (const el of list) {
    if (el === self || el.contains(self) || (self && self.contains(el))) continue
    const r = el.getBoundingClientRect()
    const ex = r.left + r.width / 2
    const ey = r.top + r.height / 2
    let main: number
    let side: number
    if (dir === 'down') {
      if (r.top < from.bottom - 4 && ey <= cy + 4) continue
      main = Math.max(0, r.top - from.bottom)
      side = r.right < from.left ? from.left - r.right : r.left > from.right ? r.left - from.right : 0
    } else if (dir === 'up') {
      if (r.bottom > from.top + 4 && ey >= cy - 4) continue
      main = Math.max(0, from.top - r.bottom)
      side = r.right < from.left ? from.left - r.right : r.left > from.right ? r.left - from.right : 0
    } else if (dir === 'right') {
      if (r.left < from.right - 4 && ex <= cx + 4) continue
      main = Math.max(0, r.left - from.right)
      side = r.bottom < from.top ? from.top - r.bottom : r.top > from.bottom ? r.top - from.bottom : 0
    } else {
      if (r.right > from.left + 4 && ex >= cx - 4) continue
      main = Math.max(0, from.left - r.right)
      side = r.bottom < from.top ? from.top - r.bottom : r.top > from.bottom ? r.top - from.bottom : 0
    }
    // de lado y adelante a la vez se castiga más en filas (izquierda/derecha) para no saltar de fila sin querer
    const score = main + side * (dir === 'left' || dir === 'right' ? 4 : 2)
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
}

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  // que se vea el título de la sección de arriba al bajar a una fila
  const r = el.getBoundingClientRect()
  if (r.top < 90) window.scrollBy({ top: r.top - 90, behavior: 'smooth' })
}

// Primer elemento a la vista: con él empieza el foco cuando nada lo tiene
function first(list: HTMLElement[]): HTMLElement | undefined {
  const onScreen = list.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < innerHeight
  })
  return (onScreen.length ? onScreen : list).sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    return ra.top - rb.top || ra.left - rb.left
  })[0]
}

function move(dir: Dir): boolean {
  const list = candidates()
  const cur = document.activeElement as HTMLElement | null
  const inScope = cur && cur !== document.body && list.includes(cur)
  if (!inScope) {
    const f = first(list)
    if (f) focusEl(f)
    return Boolean(f)
  }
  const next = nearest(cur!.getBoundingClientRect(), dir, list, cur)
  if (next) focusEl(next)
  return true
}

// Atrás cierra lo que esté abierto encima; si no hay nada, vuelve; en la pantalla de inicio sale de la app
function back(e: KeyboardEvent) {
  const s = scope()
  if (s !== document) {
    const close = (s as HTMLElement).querySelector<HTMLElement>('[data-back], .close, [aria-label^="Cerrar"], [aria-label="Seguir sin cuenta"]')
    if (close) {
      e.preventDefault()
      close.click()
      return
    }
    // los que escuchan Escape (el tráiler) se cierran solos
    if (e.key !== 'Escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    e.preventDefault()
    return
  }
  if (e.key === 'Escape') return
  const atHome = location.hash === '' || location.hash === '#/' || location.hash === '#'
  if (!atHome) {
    e.preventDefault()
    history.back()
    return
  }
  // dentro de la app del Samsung, la que cierra es la app que la contiene
  if (exitApp()) {
    e.preventDefault()
    return
  }
  const tizen = (window as unknown as { tizen?: { application: { getCurrentApplication(): { exit(): void } } } }).tizen
  if (tizen) {
    e.preventDefault()
    tizen.application.getCurrentApplication().exit()
  }
  // en LG, sin prevenir, el sistema ofrece salir
}

function onKey(e: KeyboardEvent) {
  if (!e.isTrusted && e.key === 'Escape') return
  const el = document.activeElement as HTMLElement | null
  const typing = el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes((el as HTMLInputElement).type)))
  if (isBack(e)) {
    // en un campo de texto, Atrás primero solo suelta el campo (y cierra el teclado de la TV)
    if (typing && e.key !== 'Escape') {
      e.preventDefault()
      el!.blur()
      return
    }
    back(e)
    return
  }
  const dir = ARROWS[e.key] ?? ({ 37: 'left', 38: 'up', 39: 'right', 40: 'down' } as Record<number, Dir>)[e.keyCode]
  if (!dir) return
  // escribiendo, izquierda y derecha mueven el cursor del texto; la barra de nota mínima se mueve con ellas
  if (typing && (dir === 'left' || dir === 'right')) return
  if (el?.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range' && (dir === 'left' || dir === 'right')) return
  if (el?.tagName === 'SELECT') return
  if (move(dir)) e.preventDefault()
}

export function startTV() {
  if (!isTV) return
  document.documentElement.classList.add('tv')
  window.addEventListener('keydown', onKey)
  // Si el foco quedó en la app que contiene a la web, ella reenvía aquí las teclas del control
  if (shell) {
    window.addEventListener('message', (m) => {
      const d = m.data as { hv?: string; key?: string; keyCode?: number }
      if (m.source !== window.parent || d?.hv !== 'key') return
      window.focus()
      onKey({ key: d.key ?? '', keyCode: d.keyCode ?? 0, isTrusted: true, preventDefault() {} } as unknown as KeyboardEvent)
    })
  }
  // al cambiar de pantalla el foco se queda en algo que ya no existe: se pone en lo primero de la nueva
  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body && document.contains(document.activeElement)) return
      const f = first(candidates())
      if (f) f.focus({ preventScroll: true })
    }, 120)
  })
}
