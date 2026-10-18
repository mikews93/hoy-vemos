import type { Title, Votes, PersonId } from '../data/types'

// Recomendador por contenido: aprende pesos de géneros y etiquetas a partir de lo que cada persona
// marcó como "me gustó" / "no me interesa" / "ya la vi", y los combina con la calidad (nota IMDb).

export type Weights = Map<string, number>

export interface Settings {
  minImdb: number
  platforms: string[] // vacío = todas
}

const key = (k: 'g' | 't', v: string) => `${k}:${v}`

export function learn(votes: Votes, catalog: Title[]): Weights {
  const byId = new Map(catalog.map((t) => [t.id, t]))
  const w: Weights = new Map()
  const add = (t: Title | undefined, amount: number) => {
    if (!t) return
    t.genres.forEach((g) => w.set(key('g', g), (w.get(key('g', g)) ?? 0) + amount))
    t.tags.forEach((tag) => w.set(key('t', tag), (w.get(key('t', tag)) ?? 0) + amount * 0.7))
  }
  votes.liked.forEach((id) => add(byId.get(id), 2))
  votes.disliked.forEach((id) => add(byId.get(id), -2))
  votes.seen.forEach((id) => !votes.liked.includes(id) && add(byId.get(id), 0.3))
  votes.passed.forEach((id) => add(byId.get(id), -0.4))
  return w
}

export function affinity(t: Title, w: Weights): number {
  let s = 0
  t.genres.forEach((g) => (s += w.get(key('g', g)) ?? 0))
  t.tags.forEach((tag) => (s += w.get(key('t', tag)) ?? 0))
  return s / Math.sqrt(t.genres.length + t.tags.length || 1)
}

const quality = (t: Title) => ((t.ratings.imdb ?? 0) - 7) * 1.2

// Ruido estable por día para que la lista cambie cada día sin ser aleatoria al recargar
function dayNoise(id: string, day: string): number {
  let h = 2166136261
  for (const c of id + day) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export function available(t: Title, s: Settings): boolean {
  if (s.platforms.length === 0) return true
  return t.providers.some((p) => p.kind === 'flatrate' && s.platforms.includes(p.name))
}

export function eligible(t: Title, s: Settings, votes: Votes[]): boolean {
  if ((t.ratings.imdb ?? 0) < s.minImdb) return false
  if (!available(t, s)) return false
  return !votes.some((v) => v.seen.includes(t.id) || v.disliked.includes(t.id))
}

export interface Scored {
  title: Title
  score: number
  reason: string
}

function reasonFor(t: Title, liked: Title[]): string {
  let best: Title | undefined
  let bestOverlap = 0
  for (const l of liked) {
    const overlap = l.genres.filter((g) => t.genres.includes(g)).length + l.tags.filter((x) => t.tags.includes(x)).length * 1.5
    if (overlap > bestOverlap && l.id !== t.id) {
      best = l
      bestOverlap = overlap
    }
  }
  return best ? best.title : ''
}

export interface DailyPicks {
  date: string
  together: string[] // lista "Hoy para ustedes"
  reasons: Record<string, string>
}

// Arma la lista del día para la pareja: prioriza lo que les gusta a los dos (el mínimo de ambas afinidades)
export function buildDaily(catalog: Title[], votes: Record<PersonId, Votes>, s: Settings, date: string, size = 8): DailyPicks {
  const wa = learn(votes.a, catalog)
  const wb = learn(votes.b, catalog)
  const byId = new Map(catalog.map((t) => [t.id, t]))
  const likedA = votes.a.liked.map((id) => byId.get(id)).filter(Boolean) as Title[]
  const likedB = votes.b.liked.map((id) => byId.get(id)).filter(Boolean) as Title[]
  const pool = catalog.filter((t) => eligible(t, s, [votes.a, votes.b]))
  const scored = pool
    .map((t) => {
      const a = affinity(t, wa)
      const b = affinity(t, wb)
      const bothLiked = votes.a.liked.includes(t.id) && votes.b.liked.includes(t.id) ? 3 : 0
      return { t, score: Math.min(a, b) * 0.6 + (a + b) * 0.2 + quality(t) + bothLiked + dayNoise(t.id, date) * 1.5 }
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, size)
  const reasons: Record<string, string> = {}
  scored.forEach(({ t }) => {
    const ra = reasonFor(t, likedA)
    const rb = reasonFor(t, likedB)
    if (ra && rb && ra === rb) reasons[t.id] = `Porque a los dos les gustó ${ra}.`
    else if (ra && rb) reasons[t.id] = `Porque les gustaron ${ra} y ${rb}.`
    else if (ra || rb) reasons[t.id] = `Porque les gustó ${ra || rb}.`
    else reasons[t.id] = `Entre lo mejor puntuado en sus plataformas.`
  })
  return { date, together: scored.map(({ t }) => t.id), reasons }
}

export function forPerson(catalog: Title[], v: Votes, others: Votes, s: Settings, exclude: string[], size = 8): Title[] {
  const w = learn(v, catalog)
  return catalog
    .filter((t) => eligible(t, s, [v]) && !exclude.includes(t.id) && !v.passed.includes(t.id) && !others.seen.includes(t.id))
    .map((t) => ({ t, s: affinity(t, w) + quality(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, size)
    .map(({ t }) => t)
}

// Mazo del modo pareja: lo que la persona activa aún no votó, primero lo que la pareja ya marcó con "me gusta"
export function buildDeck(catalog: Title[], me: Votes, partner: Votes, s: Settings): Title[] {
  const w = learn(me, catalog)
  const voted = new Set([...me.liked, ...me.disliked, ...me.seen, ...me.passed])
  return catalog
    .filter((t) => eligible(t, s, [me, partner]) && !voted.has(t.id))
    .map((t) => ({ t, s: affinity(t, w) + quality(t) + (partner.liked.includes(t.id) ? 2.5 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map(({ t }) => t)
}

export interface ExploreSection {
  tag: string
  title: string
  why: string
  items: Title[]
}

// Explorar: separado del algoritmo principal, para salir de la burbuja sin bajar la calidad
export function buildExplore(catalog: Title[], votes: Record<PersonId, Votes>, s: Settings, exclude: string[]): ExploreSection[] {
  const all = [votes.a, votes.b]
  const pool = catalog.filter((t) => eligible(t, s, all) && !exclude.includes(t.id))
  const w = learn({ liked: [...votes.a.liked, ...votes.b.liked], disliked: [...votes.a.disliked, ...votes.b.disliked], seen: [], passed: [] }, catalog)
  const byId = new Map(catalog.map((t) => [t.id, t]))
  const liked = [...new Set([...votes.a.liked, ...votes.b.liked])].map((id) => byId.get(id)).filter(Boolean) as Title[]
  const sections: ExploreSection[] = []
  const used = new Set<string>()
  const take = (list: Title[], n = 6) => {
    const out = list.filter((t) => !used.has(t.id)).slice(0, n)
    out.forEach((t) => used.add(t.id))
    return out
  }

  const gems = take(pool.filter((t) => (t.ratings.imdbVotes ?? 999) < 250 && (t.ratings.imdb ?? 0) >= 7.5).sort((a, b) => (b.ratings.imdb ?? 0) - (a.ratings.imdb ?? 0)))
  if (gems.length) sections.push({ tag: 'Joyas ocultas', title: 'Muy bien puntuadas, poco vistas', why: 'Menos de 250 mil votos en IMDb', items: gems })

  const foreignLiked = liked.find((t) => t.country && !t.country.startsWith('EE. UU') && t.country !== 'United States of America')
  const country = foreignLiked?.country
  const isAbroad = (t: Title) => Boolean(t.country) && !t.country.startsWith('EE. UU') && t.country !== 'United States of America'
  const byScore = (a: Title, b: Title) => (b.ratings.imdb ?? 0) - (a.ratings.imdb ?? 0)
  const sameCountry = pool.filter((t) => country && t.country === country && !used.has(t.id))
  // Si no hay más de ese país, cualquier título fuera de Hollywood
  const abroad = take((sameCountry.length >= 2 ? sameCountry : pool.filter(isAbroad)).sort(byScore))
  const usedCountry = sameCountry.length >= 2
  if (abroad.length)
    sections.push({ tag: 'De otro país', title: usedCountry ? `Un viaje por ${country}` : 'Cine de otros países', why: usedCountry && foreignLiked ? `Porque les gustó ${foreignLiked.title}` : 'Fuera de Hollywood, con muy buena nota', items: abroad })

  const otherGenre = take(
    pool
      .filter((t) => t.genres.every((g) => (w.get(`g:${g}`) ?? 0) <= 0.5))
      .sort((a, b) => (b.ratings.imdb ?? 0) - (a.ratings.imdb ?? 0)),
  )
  if (otherGenre.length) sections.push({ tag: 'Otro género', title: 'Algo distinto que podría gustarles', why: 'Géneros que casi no ven, con muy buena nota', items: otherGenre })

  return sections
}

// Búsqueda por ánimo: coincidencia simple de palabras con géneros, etiquetas y sinopsis
export function moodSearch(catalog: Title[], q: string, s: Settings, votes: Votes[]): Title[] {
  const words = q.toLowerCase().split(/\s+/).filter((x) => x.length > 2)
  if (!words.length) return []
  const short = /corta|corto|100|rápid/.test(q.toLowerCase())
  return catalog
    .filter((t) => eligible(t, s, votes) && (!short || (t.kind === 'movie' ? (t.runtime ?? 999) <= 110 : (t.runtime ?? 99) <= 35)))
    .map((t) => {
      const hay = [...t.genres, ...t.tags, t.overview, t.title].join(' ').toLowerCase()
      return { t, s: words.filter((w) => hay.includes(w)).length + quality(t) * 0.1 }
    })
    .filter((x) => x.s >= 1)
    .sort((a, b) => b.s - a.s)
    .slice(0, 9)
    .map(({ t }) => t)
}

// Todo el catálogo que pasa los filtros, de lo que más les puede gustar a los dos a lo menos (fondo de Explorar)
export function browseAll(catalog: Title[], votes: Record<PersonId, Votes>, s: Settings, exclude: string[]): Title[] {
  const all = [votes.a, votes.b]
  const wa = learn(votes.a, catalog)
  const wb = learn(votes.b, catalog)
  return catalog
    .filter((t) => eligible(t, s, all) && !exclude.includes(t.id))
    .map((t) => ({ t, s: (affinity(t, wa) + affinity(t, wb)) * 0.5 + quality(t) }))
    .sort((a, b) => b.s - a.s)
    .map(({ t }) => t)
}
