import { idFromImdb, idFromName } from '../data/live'
import type { ImportedVote } from './store'

// Historial de IMDb (ratings.csv de "Your ratings") o de Letterboxd (ratings.csv, diary.csv o watched.csv del export).
// Todo lo importado cuenta como visto; la nota decide si además le gustó (7 o más de 10) o no (4 o menos).

export type Source = 'imdb' | 'letterboxd'

interface Entry {
  imdbId?: string
  name: string
  year?: number
  rating?: number // de 0 a 10
}

export interface Parsed {
  source: Source
  entries: Entry[]
}

const MAX_ENTRIES = 600

// CSV con comillas (los títulos traen comas)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

export function readHistory(text: string): Parsed | null {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''))
  if (!header) return null
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase())
  const num = (x: string | undefined) => (x && !Number.isNaN(Number(x)) ? Number(x) : undefined)

  const imdbCol = col('Const')
  if (imdbCol >= 0) {
    const rating = col('Your Rating')
    const title = col('Title')
    const year = col('Year')
    return {
      source: 'imdb',
      entries: rows
        .filter((r) => /^tt\d+$/.test(r[imdbCol] ?? ''))
        .map((r) => ({ imdbId: r[imdbCol], name: r[title] ?? '', year: num(r[year]), rating: num(r[rating]) })),
    }
  }

  const name = col('Name')
  if (name >= 0) {
    const rating = col('Rating')
    const year = col('Year')
    return {
      source: 'letterboxd',
      entries: rows
        .filter((r) => r[name])
        .map((r) => {
          const stars = num(r[rating])
          return { name: r[name], year: num(r[year]), rating: stars != null ? stars * 2 : undefined }
        }),
    }
  }
  return null
}

const kindsFor = (rating?: number): ImportedVote['kinds'] =>
  rating == null ? ['seen'] : rating >= 7 ? ['seen', 'liked'] : rating <= 4 ? ['seen', 'disliked'] : ['seen']

// Busca cada título en TMDB de a 4 a la vez. Primero los que tienen nota, que son los que enseñan gustos.
export async function resolveHistory(parsed: Parsed, onProgress: (done: number, total: number) => void): Promise<{ votes: ImportedVote[]; missed: number }> {
  const seen = new Set<string>()
  const entries = parsed.entries
    .filter((e) => {
      const key = e.imdbId ?? `${e.name.toLowerCase()}|${e.year ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => Math.abs((b.rating ?? 5.5) - 5.5) - Math.abs((a.rating ?? 5.5) - 5.5))
    .slice(0, MAX_ENTRIES)
  const votes: ImportedVote[] = []
  let missed = 0
  let done = 0
  for (let i = 0; i < entries.length; i += 4) {
    const batch = await Promise.allSettled(entries.slice(i, i + 4).map((e) => (e.imdbId ? idFromImdb(e.imdbId) : idFromName(e.name, e.year))))
    batch.forEach((b, j) => {
      if (b.status === 'fulfilled' && b.value) votes.push({ id: b.value, kinds: kindsFor(entries[i + j].rating) })
      else missed++
    })
    done += batch.length
    onProgress(done, entries.length)
  }
  return { votes, missed }
}
