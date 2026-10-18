import type { Title, Kind, Provider } from './types'

// Datos reales: TMDB (catálogo, pósters, tráileres, dónde ver) + OMDb (IMDb, Rotten Tomatoes, Metacritic).
// Dos formas de conectarse:
// - Proxy (Vercel): /api/tmdb y /api/omdb guardan las claves en el servidor. Se activa solo al publicar en Vercel
//   (o con VITE_API_PROXY=1), y es lo único seguro para una app pública.
// - Directo: con VITE_TMDB_TOKEN en el build (solo para uso privado, la clave queda en el JavaScript).
// El catálogo se guarda un día en el navegador.

const TOKEN = import.meta.env.VITE_TMDB_TOKEN as string | undefined
const OMDB = import.meta.env.VITE_OMDB_KEY as string | undefined
const PROXY = !TOKEN && import.meta.env.VITE_API_PROXY === '1'
export const REGION = (import.meta.env.VITE_REGION as string | undefined) || 'CO'
const IMG = 'https://image.tmdb.org/t/p/'
const CACHE_KEY = 'hv.liveCatalog.v1'
const EXTRA_KEY = 'hv.extraTitles.v1'
const COLORS = ['#23344A', '#2F4A3A', '#5A2A27', '#3B2E5A', '#6B4E1F', '#1F4A52', '#5C3B2E', '#283040']

export const hasLiveData = Boolean(TOKEN) || PROXY

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ language: 'es-MX', ...params })
  const res = PROXY
    ? await fetch(`/api/tmdb?${new URLSearchParams({ path })}&${qs}`)
    : await fetch(`https://api.themoviedb.org/3${path}?${qs}`, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } })
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${path}`)
  return res.json() as Promise<T>
}

interface Discover { results: { id: number }[] }

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

interface Omdb { imdbRating?: string; imdbVotes?: string; Metascore?: string; Ratings?: { Source: string; Value: string }[] }

async function omdb(imdbId: string) {
  if (!OMDB && !PROXY) return {}
  try {
    const res = await fetch(PROXY ? `/api/omdb?i=${imdbId}` : `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB}`)
    if (!res.ok) return {}
    const d = (await res.json()) as Omdb
    const rt = d.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value
    return {
      imdb: d.imdbRating && d.imdbRating !== 'N/A' ? Number(d.imdbRating) : undefined,
      imdbVotes: d.imdbVotes && d.imdbVotes !== 'N/A' ? Math.round(Number(d.imdbVotes.replace(/,/g, '')) / 1000) : undefined,
      rt: rt ? Number(rt.replace('%', '')) : undefined,
      mc: d.Metascore && d.Metascore !== 'N/A' ? Number(d.Metascore) : undefined,
    }
  } catch {
    return {}
  }
}

async function toTitle(kind: Kind, id: number, i: number): Promise<Title> {
  const d = await tmdb<Detail>(`/${kind}/${id}`, { append_to_response: 'external_ids,videos,credits,keywords,watch/providers' })
  const imdbId = d.imdb_id || d.external_ids?.imdb_id
  const scores = imdbId ? await omdb(imdbId) : {}
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
    // Sin OMDb se usa la nota de TMDB como aproximación
    ratings: { imdb: scores.imdb ?? Math.round(d.vote_average * 10) / 10, imdbVotes: scores.imdbVotes ?? Math.round(d.vote_count / 1000), rt: scores.rt, mc: scores.mc },
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

export async function loadLiveCatalog(): Promise<Title[]> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; items: Title[] } | null
    if (cached && Date.now() - cached.at < 24 * 3600 * 1000) return cached.items
  } catch {
    // caché ilegible: se vuelve a descargar
  }
  const lists: [Kind, Record<string, string>][] = [
    ['movie', { sort_by: 'vote_average.desc', 'vote_count.gte': '3000', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
    ['movie', { sort_by: 'popularity.desc', 'vote_average.gte': '7', 'vote_count.gte': '500', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
    ['tv', { sort_by: 'vote_average.desc', 'vote_count.gte': '1000', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
    ['tv', { sort_by: 'popularity.desc', 'vote_average.gte': '7', 'vote_count.gte': '300', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ]
  const ids = new Map<string, [Kind, number]>()
  for (const [kind, params] of lists) {
    const page = await tmdb<Discover>(`/discover/${kind}`, params)
    page.results.slice(0, 16).forEach((r) => ids.set(`${kind}-${r.id}`, [kind, r.id]))
  }
  const entries = [...ids.values()]
  const items: Title[] = []
  // de a 6 en paralelo para no saturar las APIs
  for (let i = 0; i < entries.length; i += 6) {
    const batch = await Promise.allSettled(entries.slice(i, i + 6).map(([k, id], j) => toTitle(k, id, i + j)))
    batch.forEach((b) => b.status === 'fulfilled' && items.push(b.value))
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }))
  } catch {
    // sin espacio en el navegador: se usa sin caché
  }
  return items
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
