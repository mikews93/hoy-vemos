import type { PersonId, Title, Votes } from '../data/types.js'
import type { Night } from './recommender.js'
import type { Progress } from './series.js'

// "Su año": lo que vieron juntos y lo que más les gustó, con lo que la app ya guarda
// (lo marcado "La vimos", las noches elegidas, el avance de las series y los votos de cada uno).

export interface Summary {
  together: Title[] // lo que vieron juntos
  movies: number
  series: number
  hours: number
  episodes: number
  genres: { name: string; count: number }[] // los más vistos o queridos, de mayor a menor
  favorite?: Title // lo que más les gustó a los dos
  nights: number // noches elegidas con "Decide tú", el final de tres o "Esta noche"
  yielded?: { who: PersonId; times: number } // quién cedió más noches
  seenBy: Record<PersonId, number> // lo que marcó como visto cada uno (incluye el historial importado)
}

// Episodios vistos según el avance: temporadas completas antes de la actual más los de la actual
function episodesWatched(t: Title, p: Progress): number {
  if (!t.episodes) return p.e
  return t.episodes.slice(0, p.s - 1).reduce((a, b) => a + b, 0) + p.e
}

export function buildSummary(
  byId: Map<string, Title>,
  votes: Record<PersonId, Votes>,
  watched: string[],
  nights: Night[],
  progress: Record<string, Progress>,
  keys: Record<PersonId, string>,
): Summary {
  const ids = [...new Set([...watched, ...nights.map((n) => n.id), ...Object.keys(progress)])]
  const together = ids.map((id) => byId.get(id)).filter((t): t is Title => Boolean(t))

  let minutes = 0
  let episodes = 0
  for (const t of together) {
    if (t.kind === 'movie') minutes += t.runtime ?? 110
    else {
      const p = progress[t.id]
      const eps = p ? episodesWatched(t, p) : (t.episodes ?? []).reduce((a, b) => a + b, 0)
      episodes += eps
      minutes += eps * (t.runtime ?? 45)
    }
  }

  const bothLiked = votes.a.liked.filter((id) => votes.b.liked.includes(id))
  const counts = new Map<string, number>()
  ;[...together, ...bothLiked.map((id) => byId.get(id)).filter((t): t is Title => Boolean(t))].forEach((t) =>
    t.genres.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)),
  )
  const genres = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

  const favorite = bothLiked
    .map((id) => byId.get(id))
    .filter((t): t is Title => Boolean(t))
    .sort((a, b) => (b.ratings.imdb ?? 0) - (a.ratings.imdb ?? 0))[0]

  // Cedió quien disfrutaba bastante menos lo que eligieron esa noche
  const yieldedBy: Record<PersonId, number> = { a: 0, b: 0 }
  nights.forEach((n) => {
    const a = n.sat[keys.a]
    const b = n.sat[keys.b]
    if (a == null || b == null || Math.abs(a - b) < 0.15) return
    yieldedBy[a < b ? 'a' : 'b']++
  })
  const who: PersonId = yieldedBy.a >= yieldedBy.b ? 'a' : 'b'

  return {
    together,
    movies: together.filter((t) => t.kind === 'movie').length,
    series: together.filter((t) => t.kind === 'tv').length,
    hours: Math.round(minutes / 60),
    episodes,
    genres,
    favorite,
    nights: nights.length,
    yielded: yieldedBy[who] > 0 && yieldedBy.a !== yieldedBy.b ? { who, times: yieldedBy[who] } : undefined,
    seenBy: { a: new Set(votes.a.seen).size, b: new Set(votes.b.seen).size },
  }
}
