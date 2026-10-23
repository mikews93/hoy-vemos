import type { Title } from '../data/types'

// Seguimiento de series: por cada serie se guarda el último episodio que vieron juntos.
// Es del hogar (en los ajustes), porque una serie se sigue en pareja.

export interface Progress {
  s: number // temporada
  e: number // episodio
  at: string // cuándo lo marcaron (ISO), para ordenar "Seguir viendo"
}

export interface Episode {
  s: number
  e: number
}

export type NextUp = { kind: 'episode'; ep: Episode } | { kind: 'waiting'; date: string } | { kind: 'finished' }

export const episodeLabel = (ep: Episode) => `T${ep.s} · E${ep.e}`

// Un episodio ya salió si va antes del próximo que se estrena (la temporada en curso cuenta los que aún no salen)
const aired = (t: Title, ep: Episode) => !t.nextEpisode || ep.s < t.nextEpisode.season || (ep.s === t.nextEpisode.season && ep.e < t.nextEpisode.episode)

export function nextUp(t: Title, p?: Progress): NextUp {
  const candidate = (): Episode | null => {
    if (!p) return { s: 1, e: 1 }
    if (!t.episodes) return { s: p.s, e: p.e + 1 } // sin datos de temporadas: se cuenta hacia adelante
    if (p.e < (t.episodes[p.s - 1] ?? 0)) return { s: p.s, e: p.e + 1 }
    if (p.s < t.episodes.length) return { s: p.s + 1, e: 1 }
    return null
  }
  const ep = candidate()
  if (ep && aired(t, ep)) return { kind: 'episode', ep }
  if (t.nextEpisode) return { kind: 'waiting', date: t.nextEpisode.date }
  return { kind: 'finished' }
}

// Marcar una temporada entera: queda en su último episodio
export function seasonDone(t: Title, season: number): Episode {
  return { s: season, e: t.episodes?.[season - 1] ?? 1 }
}

export const airDateLabel = (date: string) => new Date(date + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })
