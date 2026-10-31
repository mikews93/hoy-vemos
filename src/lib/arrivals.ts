import type { Title } from '../data/types'
import { today } from './store'
import { onPlatforms, platformOf } from './platforms'

// TMDB cambia los nombres ("Netflix" / "Netflix Standard with Ads"): una salida se compara por plataforma
const platform = (name: string) => platformOf(name) ?? name

// "Recién llegó a sus plataformas" y "Se fue de sus plataformas". TMDB solo dice dónde está algo hoy, no cuándo
// llegó ni cuándo se va, así que se compara lo de hoy con lo que este teléfono vio en días anteriores. Un título
// nuevo en el catálogo no cuenta como llegada: solo un título que ya conocíamos y que ahora apareció en una
// plataforma. Por lo mismo, la salida se sabe el día que pasa, no antes.

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
  departures: Arrival[] // salidas de sus plataformas (provider = de dónde se fue)
}

function read(): Snapshot {
  try {
    return { seen: {}, arrivals: [], departures: [], ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Snapshot>) }
  } catch {
    return { seen: {}, arrivals: [], departures: [] }
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
      const nowPlatforms = now.map(platform)
      ;[...new Set(prev.p.filter((name) => wanted(name)).map(platform))]
        .filter((name) => !nowPlatforms.includes(name))
        .forEach((provider) => !snap.departures.some((a) => a.id === t.id && a.provider === provider) && snap.departures.push({ id: t.id, provider, day: d }))
    }
    if (!prev || prev.d !== d) snap.seen[t.id] = { p: now, d }
  }
  snap.arrivals = snap.arrivals.filter((a) => daysAgo(a.day) <= KEEP_DAYS)
  // si volvió a la plataforma, ya no cuenta como salida
  snap.departures = snap.departures.filter((a) => daysAgo(a.day) <= KEEP_DAYS && !snap.seen[a.id]?.p.map(platform).includes(a.provider))
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    // sin espacio: se vuelve a comparar mañana
  }
  return snap.arrivals
}

// Lo que se fue de sus plataformas en los últimos días (lo calcula trackArrivals al abrir Hoy)
export const recentDepartures = (): Arrival[] => read().departures

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
  // las salidas llevan "-" delante para no confundirlas con una llegada a la misma plataforma
  const events = [
    ...arrivals.map((a) => ({ a, key: `${a.id}|${a.provider}`, title: (t: Title) => `${t.title} llegó a ${a.provider}`, body: 'Está en su lista. ¿La ven hoy?' })),
    ...recentDepartures().map((a) => ({ a, key: `-${a.id}|${a.provider}`, title: (t: Title) => `${t.title} se fue de ${a.provider}`, body: 'Estaba en su lista. Miren en su ficha dónde más está.' })),
  ]
  const fresh = events.filter((e) => myList.includes(e.a.id) && !done.includes(e.key))
  fresh.forEach((e) => {
    const t = titles.get(e.a.id)
    if (t) new Notification(e.title(t), { body: e.body, icon: t.poster })
  })
  if (!fresh.length) return
  try {
    localStorage.setItem(NOTIFIED, JSON.stringify([...done, ...fresh.map((e) => e.key)].slice(-200)))
  } catch {
    // sin espacio: puede repetirse un aviso
  }
}
