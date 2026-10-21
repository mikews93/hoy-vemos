import type { Title, Kind, Provider, Ratings } from './types'
import type { MoodFilter } from '../lib/recommender'

// Datos reales: TMDB (catálogo, pósters, tráileres, dónde ver) + OMDb (IMDb, Rotten Tomatoes, Metacritic).
// Dos formas de conectarse:
// - Proxy (Vercel): /api/tmdb y /api/omdb guardan las claves en el servidor. Se activa solo al publicar en Vercel
//   (o con VITE_API_PROXY=1), y es lo único seguro para una app pública.
// - Directo: con VITE_TMDB_TOKEN en el build (solo para uso privado, la clave queda en el JavaScript).
// El catálogo se guarda un día en el navegador y crece por páginas al bajar en Explorar.

const TOKEN = import.meta.env.VITE_TMDB_TOKEN as string | undefined
const OMDB = import.meta.env.VITE_OMDB_KEY as string | undefined
const PROXY = !TOKEN && import.meta.env.VITE_API_PROXY === '1'
export const REGION = (import.meta.env.VITE_REGION as string | undefined) || 'CO'
const IMG = 'https://image.tmdb.org/t/p/'
const CACHE_KEY = 'hv.liveCatalog.v3'
const EXTRA_KEY = 'hv.extraTitles.v2'
const SCORES_KEY = 'hv.scores.v1'
const COLORS = ['#23344A', '#2F4A3A', '#5A2A27', '#3B2E5A', '#6B4E1F', '#1F4A52', '#5C3B2E', '#283040']

export const hasLiveData = Boolean(TOKEN) || PROXY
// La búsqueda por ánimo con IA solo existe publicada en Vercel (api/mood.ts guarda la clave)
export const hasMoodAi = PROXY

export async function askMood(q: string): Promise<MoodFilter> {
  const res = await fetch(`/api/mood?${new URLSearchParams({ q })}`)
  if (!res.ok) throw new Error(`IA ${res.status}`)
  return res.json() as Promise<MoodFilter>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Los proxies limitan los pedidos por minuto de cada IP (api/_lib/guard.ts), y en casa los dos teléfonos
// comparten IP. Cada navegador se frena solo por debajo de ese tope en vez de chocar con él.
function pacer(perMinute: number) {
  const sent: number[] = []
  return async function pace() {
    for (;;) {
      const now = Date.now()
      while (sent.length && sent[0] < now - 60_000) sent.shift()
      if (sent.length < perMinute) {
        sent.push(now)
        return
      }
      await wait(sent[0] + 60_000 - now + 50)
    }
  }
}
const paceTmdb = pacer(400)
const paceOmdb = pacer(90)

// Si igual llega un "demasiados pedidos" (429), se espera y se reintenta en vez de perder el título
async function get(url: string, pace: () => Promise<void>, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await pace()
    const res = await fetch(url, init)
    if (res.status !== 429 || attempt >= 2) return res
    await wait(Math.min(Number(res.headers.get('retry-after')) || 20, 60) * 1000)
  }
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ language: 'es-MX', ...params })
  const res = PROXY
    ? await get(`/api/tmdb?${new URLSearchParams({ path })}&${qs}`, paceTmdb)
    : await get(`https://api.themoviedb.org/3${path}?${qs}`, paceTmdb, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } })
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${path}`)
  return res.json() as Promise<T>
}

interface Discover { results: { id: number }[]; total_pages?: number }

interface Detail {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  overview: string
  genres: { name: string }[]
  poster_path?: string
  backdrop_path?: string
  vote_average: number
  vote_count: number
  production_countries?: { name: string }[]
  origin_country?: string[]
  external_ids?: { imdb_id?: string }
  imdb_id?: string
  videos?: { results: { site: string; type: string; key: string }[] }
  credits?: { cast: { name: string; character: string }[]; crew: { name: string; job: string }[] }
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] }
  'watch/providers'?: { results: Record<string, { flatrate?: { provider_name: string }[]; rent?: { provider_name: string }[]; buy?: { provider_name: string }[] }> }
}

interface Omdb { Response?: string; Error?: string; imdbRating?: string; imdbVotes?: string; Metascore?: string; Ratings?: { Source: string; Value: string }[] }
type Scores = Pick<Ratings, 'imdb' | 'imdbVotes' | 'rt' | 'mc'>

// Las notas casi no cambian: se guardan 30 días en el navegador por id de IMDb, así cada día
// solo se gasta el límite diario de OMDb en títulos nuevos
const SCORES_TTL = 30 * 24 * 3600 * 1000
let scoreCache: Record<string, { at: number; s: Scores }> | undefined
function scoresStore() {
  if (!scoreCache) {
    try {
      scoreCache = JSON.parse(localStorage.getItem(SCORES_KEY) ?? '{}') as Record<string, { at: number; s: Scores }>
    } catch {
      scoreCache = {}
    }
  }
  return scoreCache
}
let saveTimer: ReturnType<typeof setTimeout> | undefined
function saveScores() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const now = Date.now()
      const c = scoresStore()
      for (const id of Object.keys(c)) if (now - c[id].at > SCORES_TTL) delete c[id]
      localStorage.setItem(SCORES_KEY, JSON.stringify(c))
    } catch {
      // sin espacio: se vuelven a pedir
    }
  }, 500)
}

// null = OMDb no respondió (límite diario, clave o red): el título queda pendiente y se reintenta después
async function omdb(imdbId: string): Promise<Scores | null> {
  if (!OMDB && !PROXY) return {}
  const hit = scoresStore()[imdbId]
  if (hit && Date.now() - hit.at < SCORES_TTL) return hit.s
  try {
    const res = await get(PROXY ? `/api/omdb?i=${imdbId}` : `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB}`, paceOmdb)
    if (!res.ok) return null
    const d = (await res.json()) as Omdb
    // sin clave en el servidor el proxy responde {}: no hay notas que esperar
    if (!d.Response) return {}
    // límite diario o clave mala: se reintenta más tarde; "no encontrada" se guarda como sin notas
    if (d.Response === 'False' && /limit|key/i.test(d.Error ?? '')) return null
    const rt = d.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value
    const s: Scores = {
      imdb: d.imdbRating && d.imdbRating !== 'N/A' ? Number(d.imdbRating) : undefined,
      imdbVotes: d.imdbVotes && d.imdbVotes !== 'N/A' ? Math.round(Number(d.imdbVotes.replace(/,/g, '')) / 1000) : undefined,
      rt: rt ? Number(rt.replace('%', '')) : undefined,
      mc: d.Metascore && d.Metascore !== 'N/A' ? Number(d.Metascore) : undefined,
    }
    scoresStore()[imdbId] = { at: Date.now(), s }
    saveScores()
    return s
  } catch {
    return null
  }
}

// Sin OMDb se usa la nota de TMDB como aproximación
const withScores = (base: Ratings, s: Scores): Ratings => ({ imdb: s.imdb ?? base.imdb, imdbVotes: s.imdbVotes ?? base.imdbVotes, rt: s.rt, mc: s.mc })

async function toTitle(kind: Kind, id: number, i: number): Promise<Title> {
  const d = await tmdb<Detail>(`/${kind}/${id}`, { append_to_response: 'external_ids,videos,credits,keywords,watch/providers' })
  const imdbId = d.imdb_id || d.external_ids?.imdb_id
  const scores = imdbId ? await omdb(imdbId) : {}
  const tmdbRatings: Ratings = { imdb: Math.round(d.vote_average * 10) / 10, imdbVotes: Math.round(d.vote_count / 1000) }
  const wp = d['watch/providers']?.results?.[REGION]
  const providers: Provider[] = [
    ...(wp?.flatrate ?? []).map((p) => ({ name: p.provider_name, kind: 'flatrate' as const })),
    ...(wp?.rent ?? []).map((p) => ({ name: p.provider_name, kind: 'rent' as const })),
  ]
  const trailer = d.videos?.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
  const director = d.credits?.crew.find((c) => c.job === 'Director')
  const kw = d.keywords?.keywords ?? d.keywords?.results ?? []
  return {
    id: `${kind}-${d.id}`,
    kind,
    title: d.title ?? d.name ?? '',
    originalTitle: d.original_title ?? d.original_name,
    year: Number((d.release_date ?? d.first_air_date ?? '0').slice(0, 4)),
    runtime: d.runtime ?? d.episode_run_time?.[0],
    seasons: d.number_of_seasons,
    genres: d.genres.map((g) => g.name),
    tags: kw.slice(0, 12).map((k) => k.name.toLowerCase()),
    country: d.production_countries?.[0]?.name ?? d.origin_country?.[0] ?? '',
    overview: d.overview,
    ratings: withScores(tmdbRatings, scores ?? {}),
    imdbId,
    scoresPending: scores === null || undefined,
    providers,
    poster: d.poster_path ? `${IMG}w500${d.poster_path}` : undefined,
    backdrop: d.backdrop_path ? `${IMG}w1280${d.backdrop_path}` : undefined,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    cast: [
      ...(director ? [{ name: director.name, role: 'Dirección' }] : []),
      ...(d.credits?.cast ?? []).slice(0, 5).map((c) => ({ name: c.name, role: c.character })),
    ],
    color: COLORS[i % COLORS.length],
  }
}

// Las cuatro listas de TMDB de las que sale el catálogo. Cada "página" trae hasta 20 de cada una.
const LISTS: [Kind, Record<string, string>][] = [
  ['movie', { sort_by: 'vote_average.desc', 'vote_count.gte': '3000', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ['movie', { sort_by: 'popularity.desc', 'vote_average.gte': '7', 'vote_count.gte': '500', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ['tv', { sort_by: 'vote_average.desc', 'vote_count.gte': '1000', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ['tv', { sort_by: 'popularity.desc', 'vote_average.gte': '7', 'vote_count.gte': '300', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
]
// Tope de páginas por lista: cada página nueva cuesta hasta ~80 consultas a OMDb (límite diario del plan gratis)
export const MAX_PAGES = 10

export interface LiveCatalog {
  items: Title[]
  pages: number // páginas ya traídas de cada lista
  done: boolean // ya no hay más páginas
}

interface Cached extends LiveCatalog {
  at: number
}

function readCache(): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null
    if (c && Date.now() - c.at < 24 * 3600 * 1000) return { ...c, pages: c.pages ?? 1, done: c.done ?? false }
  } catch {
    // caché ilegible: se vuelve a descargar
  }
  return null
}

function writeCache(c: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // sin espacio en el navegador: se usa sin caché
  }
}

// Trae la página `page` de cada lista y arma los títulos que aún no están en `known`
async function fetchPage(page: number, known: Set<string>, offset: number): Promise<{ items: Title[]; last: boolean }> {
  const ids = new Map<string, [Kind, number]>()
  let last = true
  for (const [kind, params] of LISTS) {
    const res = await tmdb<Discover>(`/discover/${kind}`, { ...params, page: String(page) })
    if (page < (res.total_pages ?? 1)) last = false
    res.results.forEach((r) => !known.has(`${kind}-${r.id}`) && ids.set(`${kind}-${r.id}`, [kind, r.id]))
  }
  const entries = [...ids.values()]
  const items: Title[] = []
  // de a 6 en paralelo para no saturar las APIs
  for (let i = 0; i < entries.length; i += 6) {
    const batch = await Promise.allSettled(entries.slice(i, i + 6).map(([k, id], j) => toTitle(k, id, offset + i + j)))
    batch.forEach((b) => b.status === 'fulfilled' && items.push(b.value))
  }
  return { items, last }
}

// Primera página de cada lista; el resto llega con loadMoreLive al bajar en Explorar. Se guarda un día.
export async function loadLiveCatalog(): Promise<LiveCatalog> {
  const cached = readCache()
  if (cached) return cached
  const { items, last } = await fetchPage(1, new Set(), 0)
  const c: Cached = { at: Date.now(), items, pages: 1, done: last }
  writeCache(c)
  return c
}

// Siguiente página: se suma al catálogo del día (y a su caché) para que la lista diaria también la aproveche
export async function loadMoreLive(current: LiveCatalog): Promise<LiveCatalog> {
  if (current.done) return current
  const page = current.pages + 1
  const { items, last } = await fetchPage(page, new Set(current.items.map((t) => t.id)), current.items.length)
  const next: LiveCatalog = { items: [...current.items, ...items], pages: page, done: last || page >= MAX_PAGES }
  const at = readCache()?.at ?? Date.now()
  writeCache({ ...next, at })
  return next
}

// Títulos que quedaron sin notas porque OMDb no respondió: se reintentan al abrir la app (de a pocos,
// para no gastar el límite diario de una vez). Devuelve null si no había nada pendiente.
export async function fillScores(current: LiveCatalog, max = 60): Promise<LiveCatalog | null> {
  const pending = current.items.filter((t) => t.scoresPending && t.imdbId).slice(0, max)
  if (!pending.length) return null
  const fixed = new Map<string, Title>()
  for (const t of pending) {
    const s = await omdb(t.imdbId!)
    if (s === null) break // OMDb sigue sin responder: se prueba la próxima vez
    fixed.set(t.id, { ...t, ratings: withScores(t.ratings, s), scoresPending: undefined })
  }
  if (!fixed.size) return null
  const next: LiveCatalog = { ...current, items: current.items.map((t) => fixed.get(t.id) ?? t) }
  writeCache({ ...next, at: readCache()?.at ?? Date.now() })
  return next
}

// Títulos guardados (Mi lista, listas anteriores) que ya no salen en el catálogo del día: se traen uno por uno
export async function loadTitles(ids: string[]): Promise<Title[]> {
  let cache: Record<string, Title> = {}
  try {
    cache = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? '{}') as Record<string, Title>
  } catch {
    // caché ilegible: se vuelve a descargar
  }
  const missing = ids.filter((id) => !cache[id] && /^(movie|tv)-\d+$/.test(id))
  for (let i = 0; i < missing.length; i += 6) {
    const batch = await Promise.allSettled(
      missing.slice(i, i + 6).map((id, j) => {
        const [kind, n] = id.split('-')
        return toTitle(kind as Kind, Number(n), i + j)
      }),
    )
    batch.forEach((b) => b.status === 'fulfilled' && (cache[b.value.id] = b.value))
  }
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(cache))
  } catch {
    // sin espacio: se vuelven a pedir la próxima vez
  }
  return ids.map((id) => cache[id]).filter(Boolean)
}
