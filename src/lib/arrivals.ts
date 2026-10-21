import type { Title } from '../data/types'
import { today } from './store'
import { onPlatforms } from './platforms'

// "Recién llegó a sus plataformas". TMDB solo dice dónde está algo hoy, no cuándo llegó ni cuándo se va,
// así que se compara lo de hoy con lo que este teléfono vio en días anteriores. Un título nuevo en el
// catálogo no cuenta como llegada: solo un título que ya conocíamos y que ahora apareció en una plataforma.

const KEY = 'hv.arrivals.v1'
const KEEP_DAYS = 7

export interface Arrival {
  id: string
  provider: string
  day: string
}

interface Snapshot {
  seen: Record<string, { p: string[]; d: string }> // plataformas de suscripción de cada título y el día que se vio
  arrivals: Arrival[]
}

function read(): Snapshot {
  try {
    return { seen: {}, arrivals: [], ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Snapshot>) }
  } catch {
    return { seen: {}, arrivals: [] }
  }
}

const daysAgo = (day: string) => (Date.parse(today()) - Date.parse(day)) / 86_400_000

// Idempotente dentro del día: se puede llamar cada vez que crece el catálogo
export function trackArrivals(catalog: Title[], platforms: string[]): Arrival[] {
  const snap = read()
  const d = today()
  const wanted = (name: string) => onPlatforms(name, platforms)
  for (const t of catalog) {
    const now = t.providers.filter((p) => p.kind === 'flatrate').map((p) => p.name)
    const prev = snap.seen[t.id]
    if (prev && prev.d !== d) {
      now
        .filter((name) => !prev.p.includes(name) && wanted(name))
        .forEach((provider) => !snap.arrivals.some((a) => a.id === t.id && a.provider === provider) && snap.arrivals.push({ id: t.id, provider, day: d }))
    }
    if (!prev || prev.d !== d) snap.seen[t.id] = { p: now, d }
  }
  snap.arrivals = snap.arrivals.filter((a) => daysAgo(a.day) <= KEEP_DAYS)
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    // sin espacio: se vuelve a comparar mañana
  }
  return snap.arrivals
}

const NOTIFIED = 'hv.arrivals.notified.v1'

// Aviso en este teléfono cuando algo de Mi lista llega a sus plataformas (solo con la app abierta: no hay servidor de avisos)
export function notifyArrivals(arrivals: Arrival[], titles: Map<string, Title>, myList: string[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  let done: string[] = []
  try {
    done = JSON.parse(localStorage.getItem(NOTIFIED) ?? '[]') as string[]
  } catch {
    // sin historial de avisos: se avisa de nuevo
  }
  const fresh = arrivals.filter((a) => myList.includes(a.id) && !done.includes(`${a.id}|${a.provider}`))
  fresh.forEach((a) => {
    const t = titles.get(a.id)
    if (t) new Notification(`${t.title} llegó a ${a.provider}`, { body: 'Está en su lista. ¿La ven hoy?', icon: t.poster })
  })
  if (!fresh.length) return
  try {
    localStorage.setItem(NOTIFIED, JSON.stringify([...done, ...fresh.map((a) => `${a.id}|${a.provider}`)].slice(-200)))
  } catch {
    // sin espacio: puede repetirse un aviso
  }
}
