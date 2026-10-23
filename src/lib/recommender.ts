import type { Title, Votes, PersonId } from '../data/types.js'
import type { Progress } from './series.js'
import { topicKey, topicsOf } from './topics.js'
import { onPlatforms } from './platforms.js' // con .js para que la función de madrugada (api/nightly.ts) la cargue en Node

// Recomendador por contenido: aprende pesos de géneros y etiquetas a partir de lo que cada persona
// marcó como "me gustó" / "no me interesa" / "ya la vi", y los combina con la calidad (nota IMDb).

export type Weights = Map<string, number>

// Una noche elegida: cuánto le gustaba a cada uno lo que vieron (0 a 1), por la clave de cada persona
export interface Night {
  date: string
  id: string
  sat: Record<string, number>
}

export interface Settings {
  minImdb: number
  platforms: string[] // vacío = todas
  vetoes?: Record<string, string[]> // géneros que cada persona nunca quiere ver, por su clave
  nights?: Night[] // las últimas noches elegidas, para repartir los turnos
  progress?: Record<string, Progress> // series: último episodio que vieron juntos, por id de título
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

export const quality = (t: Title) => ((t.ratings.imdb ?? 0) - 7) * 1.2

// Ruido estable por día para que la lista cambie cada día sin ser aleatoria al recargar
function dayNoise(id: string, day: string): number {
  let h = 2166136261
  for (const c of id + day) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export function available(t: Title, s: Settings): boolean {
  if (s.platforms.length === 0) return true
  return t.providers.some((p) => p.kind === 'flatrate' && onPlatforms(p.name, s.platforms))
}

export function eligible(t: Title, s: Settings, votes: Votes[]): boolean {
  if ((t.ratings.imdb ?? 0) < s.minImdb) return false
  if (!available(t, s)) return false
  return !votes.some((v) => v.seen.includes(t.id) || v.disliked.includes(t.id))
}

// Vetos: lo que alguno de los dos nunca quiere ver no sale en nada de lo compartido
// Un veto es un género ("Terror") o un tema ("tema:animales"). Lo guardado antes de los temas no los trae:
// ahí se buscan en sus etiquetas.
export const isVetoed = (t: Title, vetoes: string[]) => {
  if (t.genres.some((g) => vetoes.includes(g))) return true
  const topics = t.topics ?? topicsOf(t.tags)
  return topics.some((id) => vetoes.includes(topicKey(id)))
}
export const allVetoes = (s: Settings) => [...new Set(Object.values(s.vetoes ?? {}).flat())]
export const sharedPool = (catalog: Title[], s: Settings) => {
  const v = allVetoes(s)
  return v.length ? catalog.filter((t) => !isVetoed(t, v)) : catalog
}

// Cuánto le gustaba a alguien lo que vieron, de 0 a 1: qué parte del catálogo le gusta menos que eso.
// Se usa la posición y no la afinidad cruda porque la afinidad crece con cada voto y no se compara entre dos personas.
export function satisfaction(t: Title, w: Weights, catalog: Title[]): number {
  const mine = affinity(t, w)
  return catalog.filter((x) => affinity(x, w) < mine).length / Math.max(catalog.length - 1, 1)
}

// Turnos justos: si en las últimas noches uno disfrutó bastante menos que el otro, ahora pesan más sus gustos
export function turnOf(nights: Night[] = [], keys: Record<PersonId, string>): PersonId | null {
  let gap = 0
  nights.slice(-6).forEach((n) => {
    const a = n.sat[keys.a]
    const b = n.sat[keys.b]
    if (a != null && b != null) gap += a - b
  })
  return gap > 0.4 ? 'b' : gap < -0.4 ? 'a' : null
}

// Puntaje para los dos: lo que les gusta a ambos (el mínimo) pesa más que el promedio, más el turno de quien cedió
export function coupleScore(t: Title, wa: Weights, wb: Weights, turn: PersonId | null = null): number {
  const a = affinity(t, wa)
  const b = affinity(t, wb)
  const lean = turn === 'a' ? a * 0.5 : turn === 'b' ? b * 0.5 : 0
  return Math.min(a, b) * 0.6 + (a + b) * 0.2 + lean + quality(t)
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
export function buildDaily(catalog: Title[], votes: Record<PersonId, Votes>, s: Settings, date: string, size = 8, turn: PersonId | null = null): DailyPicks {
  const wa = learn(votes.a, catalog)
  const wb = learn(votes.b, catalog)
  const byId = new Map(catalog.map((t) => [t.id, t]))
  const likedA = votes.a.liked.map((id) => byId.get(id)).filter(Boolean) as Title[]
  const likedB = votes.b.liked.map((id) => byId.get(id)).filter(Boolean) as Title[]
  const pool = catalog.filter((t) => eligible(t, s, [votes.a, votes.b]))
  const scored = pool
    .map((t) => {
      const bothLiked = votes.a.liked.includes(t.id) && votes.b.liked.includes(t.id) ? 3 : 0
      return { t, score: coupleScore(t, wa, wb, turn) + bothLiked + dayNoise(t.id, date) * 1.5 }
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
// Palabras que no dicen nada al buscar: si cuentan, "The Mentalist" empata con todo lo que dice "the"
const STOP = new Set(['the', 'and', 'los', 'las', 'una', 'uno', 'unos', 'del', 'con', 'por', 'para', 'que', 'algo', 'como', 'mas', 'pero'])
const plain = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function moodSearch(catalog: Title[], q: string, s: Settings, votes: Votes[]): Title[] {
  const words = plain(q).split(/[^a-z0-9ñ]+/).filter((x) => x.length > 2 && !STOP.has(x))
  if (!words.length) return []
  const short = /corta|corto|100|rapid/.test(plain(q))
  return catalog
    .filter((t) => eligible(t, s, votes) && (!short || (t.kind === 'movie' ? (t.runtime ?? 999) <= 110 : (t.runtime ?? 99) <= 35)))
    .map((t) => {
      // Lo que coincide con el nombre (en español o el original) va primero
      const name = plain(`${t.title} ${t.originalTitle ?? ''}`)
      const hay = plain([...t.genres, ...t.tags, t.overview].join(' '))
      return { t, s: words.reduce((n, w) => n + (name.includes(w) ? 3 : hay.includes(w) ? 1 : 0), 0) + quality(t) * 0.1 }
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

export type Who = 'both' | PersonId

// "Decide tú": ordena lo que pueden ver esta noche, de lo que más les va a gustar a lo menos.
// Suma puntos a lo que ya eligieron de alguna forma (coincidencias, lista de hoy, Mi lista).
// Nunca elige fuera de sus gustos ni empuja lo de moda: el error del "Surprise Me" de Netflix.
export function decideFor(
  pool: Title[],
  votes: Record<PersonId, Votes>,
  s: Settings,
  opts: { who: Who; turn: PersonId | null; boost: Record<string, number>; fits: (t: Title) => boolean; rewatch?: boolean },
): Title[] {
  const wa = learn(votes.a, pool)
  const wb = learn(votes.b, pool)
  const people = opts.who === 'both' ? [votes.a, votes.b] : [votes[opts.who]]
  const candidates = opts.rewatch
    ? rewatchable(pool, votes).filter((t) => available(t, s))
    : pool.filter((t) => eligible(t, s, people) && !people.some((v) => v.passed.includes(t.id)))
  const score = (t: Title) =>
    opts.who === 'both' ? coupleScore(t, wa, wb, opts.turn) : affinity(t, opts.who === 'a' ? wa : wb) + quality(t)
  return candidates
    .filter(opts.fits)
    .map((t) => ({ t, s: score(t) + (opts.boost[t.id] ?? 0) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, 12)
    .map(({ t }) => t)
}

// "Para repetir": lo que ya vieron y le encantó a alguno, para las noches sin energía para algo nuevo
export function rewatchable(catalog: Title[], votes: Record<PersonId, Votes>): Title[] {
  const liked = (id: string) => Number(votes.a.liked.includes(id)) + Number(votes.b.liked.includes(id))
  return catalog
    .filter((t) => liked(t.id) > 0 && (votes.a.seen.includes(t.id) || votes.b.seen.includes(t.id)))
    .filter((t) => !votes.a.disliked.includes(t.id) && !votes.b.disliked.includes(t.id))
    .sort((x, y) => liked(y.id) - liked(x.id) || (y.ratings.imdb ?? 0) - (x.ratings.imdb ?? 0))
}

// El gusto de una persona que mejor explica por qué le puede gustar un título (un género o una etiqueta)
export function tasteFor(t: Title, w: Weights): string | undefined {
  // las etiquetas pesan un poco más porque dicen más que un género ("viajes en el tiempo" frente a "Drama")
  const options = [...t.genres.map((g) => [g, w.get(key('g', g)) ?? 0] as const), ...t.tags.map((x) => [x, (w.get(key('t', x)) ?? 0) * 1.2] as const)]
  const [best, weight] = options.sort((a, b) => b[1] - a[1])[0] ?? []
  return weight && weight > 0.5 ? best : undefined
}

// Lo que entendió la IA de un pedido como "algo como Dark pero más corto"
export interface MoodFilter {
  genres: string[]
  keywords: string[] // en inglés, como las etiquetas de TMDB
  similar: string[] // títulos que nombró el pedido o que se le parecen
  kind?: 'movie' | 'tv'
  maxRuntime?: number
}

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function moodMatch(catalog: Title[], f: MoodFilter, s: Settings, votes: Votes[]): Title[] {
  const names = f.similar.map(norm)
  const refs = catalog.filter((t) => names.includes(norm(t.title)) || (t.originalTitle && names.includes(norm(t.originalTitle))))
  const refGenres = new Set(refs.flatMap((r) => r.genres))
  const refTags = new Set(refs.flatMap((r) => r.tags))
  const words = f.keywords.map(norm)
  return catalog
    .filter((t) => eligible(t, s, votes) && !refs.includes(t))
    .filter((t) => !f.kind || t.kind === f.kind)
    .filter((t) => !f.maxRuntime || (t.runtime ?? 0) <= f.maxRuntime)
    .map((t) => {
      const hay = norm([...t.tags, t.overview].join(' '))
      const s =
        t.genres.filter((g) => f.genres.includes(g)).length * 2 +
        words.filter((w) => hay.includes(w)).length +
        t.genres.filter((g) => refGenres.has(g)).length +
        t.tags.filter((x) => refTags.has(x)).length * 1.5 +
        quality(t) * 0.2
      return { t, s }
    })
    .filter((x) => x.s >= 2.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map(({ t }) => t)
}
