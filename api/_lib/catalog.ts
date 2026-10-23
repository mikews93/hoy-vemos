// Catálogo del lado del servidor para el proceso de madrugada: las mismas cuatro listas de TMDB que usa la app,
// con la nota de TMDB como aproximación (la app completa las de IMDb/OMDb al abrirse).
import type { Kind, Provider, Title } from '../../src/data/types.js'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const REGION = env.VITE_REGION || 'CO'
const IMG = 'https://image.tmdb.org/t/p/'

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ language: 'es-MX', ...params })
  const res = await fetch(`https://api.themoviedb.org/3${path}?${qs}`, { headers: { Authorization: `Bearer ${env.TMDB_TOKEN}`, accept: 'application/json' } })
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${path}`)
  return res.json() as Promise<T>
}

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
  seasons?: { season_number: number; episode_count: number; air_date?: string | null }[]
  next_episode_to_air?: { air_date?: string; season_number: number; episode_number: number } | null
  overview: string
  genres: { name: string }[]
  poster_path?: string
  vote_average: number
  vote_count: number
  production_countries?: { name: string }[]
  origin_country?: string[]
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] }
  'watch/providers'?: { results: Record<string, { flatrate?: { provider_name: string }[] }> }
}

const LISTS: [Kind, Record<string, string>][] = [
  ['movie', { sort_by: 'vote_average.desc', 'vote_count.gte': '3000', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ['movie', { sort_by: 'popularity.desc', 'vote_average.gte': '7', 'vote_count.gte': '500', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ['tv', { sort_by: 'vote_average.desc', 'vote_count.gte': '1000', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
  ['tv', { sort_by: 'popularity.desc', 'vote_average.gte': '7', 'vote_count.gte': '300', watch_region: REGION, with_watch_monetization_types: 'flatrate' }],
]

export async function titleById(id: string): Promise<Title> {
  const [kind, n] = id.split('-') as [Kind, string]
  const d = await tmdb<Detail>(`/${kind}/${n}`, { append_to_response: 'keywords,watch/providers' })
  const today = new Date().toISOString().slice(0, 10)
  const aired = (d.seasons ?? []).filter((s) => s.season_number > 0 && s.episode_count > 0 && s.air_date && s.air_date <= today).sort((a, b) => a.season_number - b.season_number)
  const next = d.next_episode_to_air
  const kw = d.keywords?.keywords ?? d.keywords?.results ?? []
  const providers: Provider[] = (d['watch/providers']?.results?.[REGION]?.flatrate ?? []).map((p) => ({ name: p.provider_name, kind: 'flatrate' }))
  return {
    id,
    kind,
    title: d.title ?? d.name ?? '',
    originalTitle: d.original_title ?? d.original_name,
    year: Number((d.release_date ?? d.first_air_date ?? '0').slice(0, 4)),
    runtime: d.runtime ?? d.episode_run_time?.[0],
    seasons: d.number_of_seasons,
    episodes: kind === 'tv' && aired.length ? aired.map((s) => s.episode_count) : undefined,
    nextEpisode: kind === 'tv' && next?.air_date ? { date: next.air_date, season: next.season_number, episode: next.episode_number } : undefined,
    genres: d.genres.map((g) => g.name),
    tags: kw.slice(0, 12).map((k) => k.name.toLowerCase()),
    country: d.production_countries?.[0]?.name ?? d.origin_country?.[0] ?? '',
    overview: d.overview,
    ratings: { imdb: Math.round(d.vote_average * 10) / 10, imdbVotes: Math.round(d.vote_count / 1000) },
    providers,
    poster: d.poster_path ? `${IMG}w500${d.poster_path}` : undefined,
    color: '#23344A',
  }
}

// Trae varios títulos de a 8 a la vez; los que fallan se saltan
export async function titlesById(ids: string[]): Promise<Title[]> {
  const out: Title[] = []
  for (let i = 0; i < ids.length; i += 8) {
    const batch = await Promise.allSettled(ids.slice(i, i + 8).map(titleById))
    batch.forEach((b) => b.status === 'fulfilled' && out.push(b.value))
  }
  return out
}

// Las dos primeras páginas de cada lista: ~160 títulos, suficiente para elegir 8 por hogar
export async function nightlyCatalog(pages = 2): Promise<Title[]> {
  const ids = new Set<string>()
  for (const [kind, params] of LISTS) {
    for (let page = 1; page <= pages; page++) {
      const res = await tmdb<{ results: { id: number }[] }>(`/discover/${kind}`, { ...params, page: String(page) })
      res.results.forEach((r) => ids.add(`${kind}-${r.id}`))
    }
  }
  return titlesById([...ids])
}
