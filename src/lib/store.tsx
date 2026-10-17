import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Person, PersonId, Title, Votes } from '../data/types'
import { DEMO_CATALOG } from '../data/demo'
import { hasLiveData, loadLiveCatalog } from '../data/live'
import { buildDaily, type DailyPicks, type Settings } from './recommender'

// Estado de la app guardado en el navegador (por ahora un solo dispositivo compartido por la pareja).
// La lista del día se genera la primera vez que se abre la app cada día y queda guardada en el historial.

interface Saved {
  onboarded: boolean
  people: Record<PersonId, Person>
  active: PersonId
  settings: Settings
  votes: Record<PersonId, Votes>
  myList: string[]
  history: DailyPicks[] // listas diarias guardadas, la más reciente primero
}

const STORAGE = 'hv.state.v1'
const emptyVotes = (): Votes => ({ liked: [], disliked: [], seen: [], passed: [] })

const initial: Saved = {
  onboarded: false,
  people: { a: { id: 'a', name: 'Mike' }, b: { id: 'b', name: 'Pareja' } },
  active: 'a',
  settings: { minImdb: 7, platforms: [] },
  votes: { a: emptyVotes(), b: emptyVotes() },
  myList: [],
  history: [],
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE)
    return raw ? { ...initial, ...(JSON.parse(raw) as Saved) } : initial
  } catch {
    return initial
  }
}

export const today = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD en hora local

type VoteKind = keyof Votes

interface Store extends Saved {
  catalog: Title[]
  byId: Map<string, Title>
  loading: boolean
  live: boolean
  daily: DailyPicks | undefined
  vote: (id: string, kind: VoteKind, who?: PersonId) => void
  clearVote: (id: string, who?: PersonId) => void
  toggleList: (id: string) => void
  setActive: (p: PersonId) => void
  rename: (p: PersonId, name: string) => void
  setSettings: (s: Partial<Settings>) => void
  finishOnboarding: () => void
  refreshDaily: () => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(load)
  const [catalog, setCatalog] = useState<Title[]>(hasLiveData ? [] : DEMO_CATALOG)
  const [loading, setLoading] = useState(hasLiveData)

  useEffect(() => {
    if (!hasLiveData) return
    loadLiveCatalog()
      .then((items) => setCatalog(items.length ? items : DEMO_CATALOG))
      .catch(() => setCatalog(DEMO_CATALOG))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(saved))
    } catch {
      // sin almacenamiento disponible: la app funciona pero no recuerda
    }
  }, [saved])

  // Genera y guarda la lista del día si aún no existe
  useEffect(() => {
    if (loading || !saved.onboarded || !catalog.length) return
    const d = today()
    if (saved.history[0]?.date === d) return
    const picks = buildDaily(catalog, saved.votes, saved.settings, d)
    setSaved((s) => ({ ...s, history: [picks, ...s.history].slice(0, 60) }))
  }, [loading, saved.onboarded, catalog, saved.history, saved.votes, saved.settings])

  const store = useMemo<Store>(() => {
    const who = (p?: PersonId) => p ?? saved.active
    const update = (fn: (s: Saved) => Saved) => setSaved(fn)
    const without = (v: Votes, id: string): Votes => ({
      liked: v.liked.filter((x) => x !== id),
      disliked: v.disliked.filter((x) => x !== id),
      seen: v.seen.filter((x) => x !== id),
      passed: v.passed.filter((x) => x !== id),
    })
    return {
      ...saved,
      catalog,
      byId: new Map(catalog.map((t) => [t.id, t])),
      loading,
      live: hasLiveData,
      daily: saved.history[0]?.date === today() ? saved.history[0] : undefined,
      vote: (id, kind, p) =>
        update((s) => {
          const k = who(p)
          const v = without(s.votes[k], id)
          // "ya la vi" junto a "me gustó" se guardan ambos
          const next: Votes = { ...v, [kind]: [...v[kind], id] }
          if (kind === 'liked' && s.votes[k].seen.includes(id)) next.seen = [...next.seen, id]
          return { ...s, votes: { ...s.votes, [k]: next } }
        }),
      clearVote: (id, p) => update((s) => ({ ...s, votes: { ...s.votes, [who(p)]: without(s.votes[who(p)], id) } })),
      toggleList: (id) => update((s) => ({ ...s, myList: s.myList.includes(id) ? s.myList.filter((x) => x !== id) : [id, ...s.myList] })),
      setActive: (p) => update((s) => ({ ...s, active: p })),
      rename: (p, name) => update((s) => ({ ...s, people: { ...s.people, [p]: { ...s.people[p], name } } })),
      setSettings: (x) => update((s) => ({ ...s, settings: { ...s.settings, ...x } })),
      finishOnboarding: () => update((s) => ({ ...s, onboarded: true })),
      refreshDaily: () =>
        update((s) => ({ ...s, history: [buildDaily(catalog, s.votes, s.settings, today()), ...s.history.filter((h) => h.date !== today())] })),
      reset: () => setSaved(initial),
    }
  }, [saved, catalog, loading])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}
