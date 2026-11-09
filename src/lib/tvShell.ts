// Puente con la app instalada en el televisor (tv/tizen/index.html). Esa app muestra Hoy Vemos dentro de un
// marco y es la única con permiso del televisor para abrir otras apps (Netflix, Prime Video…) o cerrarse.
// La web le pide esas cosas por postMessage y la app responde. En el navegador normal no hay puente.

const KEY = 'hv.shell'

function detect(): string | null {
  const q = new URLSearchParams(location.search).get('shell')
  try {
    if (q) localStorage.setItem(KEY, q)
    if (q === 'none') localStorage.removeItem(KEY)
    const saved = localStorage.getItem(KEY)
    return window.parent !== window ? saved : null
  } catch {
    return q && window.parent !== window ? q : null
  }
}

// 'tizen' cuando la web corre dentro de la app del Samsung
export const shell = detect()

// Las plataformas que la app del televisor sabe abrir (sus identificadores están en tv/tizen/index.html)
export const LAUNCHABLE = ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Apple TV+', 'Paramount+']

export const canLaunch = (platform: string | undefined) => Boolean(shell && platform && LAUNCHABLE.includes(platform))

let seq = 0

// Abre la app de esa plataforma en el televisor. Resuelve true si abrió, false si no está instalada o falló.
export function launchApp(platform: string, title: string): Promise<boolean> {
  if (!shell) return Promise.resolve(false)
  const id = ++seq
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      window.removeEventListener('message', onMsg)
      clearTimeout(timer)
      resolve(ok)
    }
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window.parent) return
      const d = e.data as { hv?: string; id?: number; ok?: boolean }
      if (d?.hv === 'launched' && d.id === id) done(Boolean(d.ok))
    }
    const timer = setTimeout(() => done(false), 6000)
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ hv: 'launch', id, platform, title }, '*')
  })
}

// Cerrar la app del televisor (Atrás en la pantalla de inicio)
export function exitApp(): boolean {
  if (!shell) return false
  window.parent.postMessage({ hv: 'exit' }, '*')
  return true
}
