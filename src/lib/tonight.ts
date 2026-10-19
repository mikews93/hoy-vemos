import { useSyncExternalStore } from 'react'
import type { Title } from '../data/types'
import { today } from './store'

// "¿Cuánto tiempo tienen?" y "¿quiénes ven?": cómo es la noche de hoy en este teléfono.
// Filtra Hoy, Pareja, Explorar y "Decide tú" a la vez, y vuelve a "sin apuro, los dos" al día siguiente.

export type TimeBudget = 'any' | 'hour' | 'two'
export type Company = 'both' | 'me' | 'kids'

export interface Tonight {
  date: string
  time: TimeBudget
  who: Company
}

const KEY = 'hv.tonight.v1'
const listeners = new Set<() => void>()
const fresh = (): Tonight => ({ date: today(), time: 'any', who: 'both' })
let current: Tonight | null = null

function read(): Tonight {
  if (current?.date === today()) return current
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Tonight | null
    current = saved?.date === today() ? saved : fresh()
  } catch {
    current = fresh()
  }
  return current
}

function write(patch: Partial<Tonight>) {
  current = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // sin almacenamiento: vale para esta visita
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTonight(): [Tonight, (patch: Partial<Tonight>) => void] {
  return [useSyncExternalStore(subscribe, read), write]
}

export const TIME_LABELS: Record<TimeBudget, string> = { any: 'Sin apuro', hour: 'Menos de 1 h', two: 'Hasta 2 h' }
export const WHO_LABELS: Record<Company, string> = { both: 'Los dos', me: 'Solo yo', kids: 'Con niños' }

const KIDS = ['Familia', 'Animación', 'Kids', 'Infantil']
const NOT_FOR_KIDS = ['Terror', 'Crimen', 'Bélica', 'Suspense', 'Suspenso', 'War & Politics']

// En series cuenta lo que dura un episodio; sin duración conocida no se descarta
export function fitsTonight(t: Title, n: Tonight): boolean {
  if (n.who === 'kids' && (!t.genres.some((g) => KIDS.includes(g)) || t.genres.some((g) => NOT_FOR_KIDS.includes(g)))) return false
  if (n.time === 'hour') return t.kind === 'tv' ? (t.runtime ?? 45) <= 60 : (t.runtime ?? 999) <= 60
  if (n.time === 'two') return t.kind === 'tv' || (t.runtime ?? 0) <= 120
  return true
}
