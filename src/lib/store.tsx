import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Person, PersonId, Title, Votes } from '../data/types'
import { DEMO_CATALOG } from '../data/demo'
import { fillScores, hasLiveData, loadLiveCatalog, loadMoreLive, loadTitles, type LiveCatalog } from '../data/live'
import { buildDaily, sharedPool, turnOf, type DailyPicks, type Settings } from './recommender'
import { hasCloud, pendingInvite, supabase } from './supabase'

// Estado de la app. Dos modos con la misma interfaz:
// - Local (sin Supabase): un dispositivo compartido por la pareja, guardado en el navegador.
// - Nube (con Supabase): cada uno en su teléfono con su cuenta; "a" es quien usa la app y "b" su pareja.
//   Sin sesión se usa como invitado (solo, guardado en el navegador); al crear la cuenta eso pasa a la nube.
// La lista del día se genera la primera vez que se abre la app cada día y queda guardada en el historial.

interface Saved {
  onboarded: boolean
  people: Record<PersonId, Person>
  active: PersonId
  settings: Settings
  votes: Record<PersonId, Votes>
  myList: string[]
  watched: string[] // de la lista, las que ya vieron juntos
  history: DailyPicks[] // listas diarias guardadas, la más reciente primero
}

const STORAGE = 'hv.state.v1'
const GUEST = 'hv.guest.v1'
const emptyVotes = (): Votes => ({ liked: [], disliked: [], seen: [], passed: [] })

const initial: Saved = {
  onboarded: false,
  people: { a: { id: 'a', name: 'Mike' }, b: { id: 'b', name: 'Pareja' } },
  active: 'a',
  settings: { minImdb: 7, platforms: [] },
  votes: { a: emptyVotes(), b: emptyVotes() },
  myList: [],
  watched: [],
  history: [],
}

const guestInitial: Saved = { ...initial, people: { a: { id: 'a', name: '' }, b: { id: 'b', name: 'Tu pareja' } } }

function load(key: string, base: Saved): Saved {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...base, ...(JSON.parse(raw) as Saved) } : base
  } catch {
    return base
  }
}

function readGuest(): Saved | null {
  try {
    const raw = localStorage.getItem(GUEST)
    return raw ? { ...guestInitial, ...(JSON.parse(raw) as Saved) } : null
  } catch {
    return null
  }
}

export const guestName = () => readGuest()?.people.a.name ?? ''

export const today = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD en hora local

type VoteKind = keyof Votes

interface Store extends Saved {
  catalog: Title[]
  pool: Title[] // el catálogo sin lo que alguno de los dos vetó: de aquí sale todo lo compartido
  keys: Record<PersonId, string> // cómo se guarda cada persona en los ajustes del hogar (vetos, turnos)
  turn: PersonId | null // a quién le toca que pesen más sus gustos
  byId: Map<string, Title>
  loading: boolean
  more: More // trae otra página del catálogo (scroll infinito de Explorar)
  live: boolean
  cloud: boolean // cada uno en su teléfono con su cuenta
  guest: boolean // usa la app sin cuenta: Hoy, Explorar, fichas y su lista funcionan; lo de la pareja pide entrar
  partnerJoined: boolean
  inviteCode?: string
  email?: string
  daily: DailyPicks | undefined
  vote: (id: string, kind: VoteKind, who?: PersonId) => void
  clearVote: (id: string, who?: PersonId) => void
  toggleList: (id: string) => void
  markWatched: (id: string, on: boolean) => void // "ya la vimos": cuenta como vista para los dos
  setActive: (p: PersonId) => void
  rename: (p: PersonId, name: string) => void
  setSettings: (s: Partial<Settings>) => void
  finishOnboarding: () => void
  refreshDaily: () => void
  joinHousehold: (code: string) => Promise<void>
  signOut: () => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export interface More {
  load: () => void
  loading: boolean
  done: boolean
}

function useCatalog() {
  const [live, setLive] = useState<LiveCatalog | null>(null)
  const [catalog, setCatalog] = useState<Title[]>(hasLiveData ? [] : DEMO_CATALOG)
  const [loading, setLoading] = useState(hasLiveData)
  const [loadingMore, setLoadingMore] = useState(false)
  const busy = useRef(false)
  useEffect(() => {
    if (!hasLiveData) return
    busy.current = true
    loadLiveCatalog()
      .then((c) => {
        setLive(c)
        setCatalog(c.items.length ? c.items : DEMO_CATALOG)
        setLoading(false)
        // las notas que OMDb no dio la última vez se completan en segundo plano (sin otra página a la vez)
        setLoadingMore(true)
        return fillScores(c).then((f) => {
          if (!f) return
          setLive(f)
          setCatalog(f.items)
        })
      })
      .catch(() => setCatalog((x) => (x.length ? x : DEMO_CATALOG)))
      .finally(() => {
        busy.current = false
        setLoading(false)
        setLoadingMore(false)
      })
  }, [])
  const load = useCallback(() => {
    if (!live || live.done || busy.current) return
    busy.current = true
    setLoadingMore(true)
    loadMoreLive(live)
      .then((c) => {
        setLive(c)
        setCatalog(c.items)
      })
      // si falla se deja de pedir hasta recargar, para no repetir errores en bucle
      .catch(() => setLive((l) => l && { ...l, done: true }))
      .finally(() => {
        busy.current = false
        setLoadingMore(false)
      })
  }, [live])
  const more = useMemo<More>(() => ({ load, loading: loadingMore, done: !live || live.done }), [load, loadingMore, live])
  return { catalog, loading, more }
}

// Lo guardado (Mi lista, listas recientes) puede no estar en el catálogo de hoy: se agrega al catálogo
function useWithSaved(catalog: Title[], loading: boolean, saved: Saved): Title[] {
  const [extra, setExtra] = useState<Title[]>([])
  const wanted = [...saved.myList, ...saved.history.slice(0, 8).flatMap((h) => h.together)]
  const known = new Set([...catalog, ...extra].map((t) => t.id))
  const missing = [...new Set(wanted.filter((id) => !known.has(id)))].join(',')
  useEffect(() => {
    if (!hasLiveData || loading || !missing) return
    let alive = true
    loadTitles(missing.split(','))
      .then((items) => alive && items.length && setExtra((e) => [...e, ...items.filter((t) => !e.some((x) => x.id === t.id))]))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [missing, loading])
  return useMemo(() => (extra.length ? [...catalog, ...extra.filter((t) => !catalog.some((c) => c.id === t.id))] : catalog), [catalog, extra])
}

const without = (v: Votes, id: string): Votes => ({
  liked: v.liked.filter((x) => x !== id),
  disliked: v.disliked.filter((x) => x !== id),
  seen: v.seen.filter((x) => x !== id),
  passed: v.passed.filter((x) => x !== id),
})

// "ya la vi" junto a "me gustó" se guardan ambos
function withVote(prev: Votes, id: string, kind: VoteKind): Votes {
  const v = without(prev, id)
  const next: Votes = { ...v, [kind]: [...v[kind], id] }
  if (kind === 'liked' && prev.seen.includes(id)) next.seen = [...next.seen, id]
  return next
}

// Lo que vieron juntos cuenta como visto para los dos (así el recomendador no lo vuelve a sugerir)
const withWatched = (v: Votes, watched: string[]): Votes => ({ ...v, seen: [...new Set([...v.seen, ...watched])] })

function derived(saved: Saved, catalog: Title[], keys: Record<PersonId, string>) {
  return {
    byId: new Map(catalog.map((t) => [t.id, t])),
    pool: sharedPool(catalog, saved.settings),
    keys,
    turn: turnOf(saved.settings.nights, keys),
    votes: { a: withWatched(saved.votes.a, saved.watched), b: withWatched(saved.votes.b, saved.watched) },
    daily: saved.history[0]?.date === today() ? saved.history[0] : undefined,
  }
}

const LOCAL_KEYS: Record<PersonId, string> = { a: 'a', b: 'b' }

const makeDaily = (saved: Saved, catalog: Title[], keys: Record<PersonId, string>, date = today()) => {
  const d = derived(saved, catalog, keys)
  return buildDaily(d.pool, d.votes, saved.settings, date, 8, d.turn)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  return hasCloud ? <CloudStoreProvider>{children}</CloudStoreProvider> : <LocalStoreProvider>{children}</LocalStoreProvider>
}

function LocalStoreProvider({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const key = guest ? GUEST : STORAGE
  const [saved, setSaved] = useState<Saved>(() => load(key, guest ? guestInitial : initial))
  const base = useCatalog()
  const loading = base.loading
  const catalog = useWithSaved(base.catalog, loading, saved)

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(saved))
    } catch {
      // sin almacenamiento disponible: la app funciona pero no recuerda
    }
  }, [saved, key])

  // Genera y guarda la lista del día si aún no existe
  useEffect(() => {
    if (loading || !saved.onboarded || !catalog.length) return
    const d = today()
    if (saved.history[0]?.date === d) return
    const picks = makeDaily(saved, catalog, LOCAL_KEYS, d)
    setSaved((s) => ({ ...s, history: [picks, ...s.history].slice(0, 60) }))
  }, [loading, saved, catalog])

  const store = useMemo<Store>(() => {
    const who = (p?: PersonId) => p ?? saved.active
    const update = (fn: (s: Saved) => Saved) => setSaved(fn)
    const d = derived(saved, catalog, LOCAL_KEYS)
    return {
      ...saved,
      ...d,
      catalog,
      loading,
      more: base.more,
      live: hasLiveData,
      cloud: false,
      guest,
      partnerJoined: !guest,
      vote: (id, kind, p) => update((s) => ({ ...s, votes: { ...s.votes, [who(p)]: withVote(s.votes[who(p)], id, kind) } })),
      clearVote: (id, p) => update((s) => ({ ...s, votes: { ...s.votes, [who(p)]: without(s.votes[who(p)], id) }, watched: s.watched.filter((x) => x !== id) })),
      toggleList: (id) => update((s) => ({ ...s, myList: s.myList.includes(id) ? s.myList.filter((x) => x !== id) : [id, ...s.myList] })),
      markWatched: (id, on) =>
        update((s) => ({
          ...s,
          myList: s.myList.includes(id) ? s.myList : [id, ...s.myList],
          watched: on ? [...new Set([...s.watched, id])] : s.watched.filter((x) => x !== id),
        })),
      setActive: (p) => update((s) => ({ ...s, active: p })),
      rename: (p, name) => update((s) => ({ ...s, people: { ...s.people, [p]: { ...s.people[p], name } } })),
      setSettings: (x) => update((s) => ({ ...s, settings: { ...s.settings, ...x } })),
      finishOnboarding: () => update((s) => ({ ...s, onboarded: true })),
      refreshDaily: () =>
        update((s) => ({ ...s, history: [makeDaily(s, catalog, LOCAL_KEYS), ...s.history.filter((h) => h.date !== today())] })),
      joinHousehold: async () => {},
      signOut: () => {},
      reset: () => setSaved(guest ? guestInitial : initial),
    }
  }, [saved, catalog, loading, base.more, guest])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// ---------- Modo nube (Supabase) ----------

export type LoginMode = 'in' | 'up'
export interface LoginAsk {
  reason?: string // por qué se pide: "Para elegir juntos…"
  mode?: LoginMode
}

interface Auth {
  session: Session | null
  ready: boolean
  ask: LoginAsk | null // pantalla de entrar abierta
  askLogin: (a?: LoginAsk) => void
  closeLogin: () => void
}

const AuthCtx = createContext<Auth>({ session: null, ready: !hasCloud, ask: null, askLogin: () => {}, closeLogin: () => {} })
export const useAuth = () => useContext(AuthCtx)

interface CloudMeta {
  householdId?: string
  partnerId?: string
  inviteCode?: string
  partnerJoined: boolean
  email?: string
}

function CloudStoreProvider({ children }: { children: ReactNode }) {
  const sb = supabase!
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  // Con un enlace de invitación se abre directo la pantalla de crear cuenta
  const [ask, setAsk] = useState<LoginAsk | null>(() => (pendingInvite.get() ? { mode: 'up' } : null))

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) setAsk(null)
    })
    return () => data.subscription.unsubscribe()
  }, [sb])

  const auth = useMemo<Auth>(() => ({ session, ready, ask: session ? null : ask, askLogin: (a = {}) => setAsk(a), closeLogin: () => setAsk(null) }), [session, ready, ask])

  return (
    <AuthCtx.Provider value={auth}>
      {session ? (
        <CloudData key={session.user.id} userId={session.user.id} email={session.user.email}>{children}</CloudData>
      ) : (
        <LocalStoreProvider guest>{children}</LocalStoreProvider>
      )}
    </AuthCtx.Provider>
  )
}

function CloudData({ userId, email, children }: { userId: string; email?: string; children: ReactNode }) {
  const sb = supabase!
  const { askLogin } = useAuth()
  const base = useCatalog()
  const [saved, setSaved] = useState<Saved>(guestInitial)
  const catalog = useWithSaved(base.catalog, base.loading, saved)
  const [meta, setMeta] = useState<CloudMeta>({ partnerJoined: false, email })
  const [synced, setSynced] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const settingsTimer = useRef<number | undefined>(undefined)

  const fetchAll = useCallback(async () => {
    const { data: me } = await sb.from('profiles').select('id, name, household_id, onboarded').eq('id', userId).single()
    if (!me?.household_id) return
    const hid = me.household_id as string
    const [household, people, votes, list, daily] = await Promise.all([
      sb.from('households').select('invite_code, settings').eq('id', hid).single(),
      sb.from('profiles').select('id, name').eq('household_id', hid),
      sb.from('votes').select('user_id, title_id, kind').eq('household_id', hid),
      sb.from('list_items').select('title_id, watched_at, created_at').eq('household_id', hid).order('created_at', { ascending: false }),
      sb.from('daily_lists').select('date, together, reasons').eq('household_id', hid).order('date', { ascending: false }).limit(60),
    ])
    const partner = (people.data ?? []).find((p) => p.id !== userId)
    const toVotes = (uid?: string): Votes => {
      const v = emptyVotes()
      if (uid) (votes.data ?? []).filter((r) => r.user_id === uid).forEach((r) => v[r.kind as VoteKind].push(r.title_id))
      return v
    }
    setSaved({
      onboarded: me.onboarded,
      people: { a: { id: 'a', name: me.name }, b: { id: 'b', name: partner?.name || 'Tu pareja' } },
      active: 'a',
      settings: { ...initial.settings, ...(household.data?.settings as Settings | undefined) },
      votes: { a: toVotes(userId), b: toVotes(partner?.id) },
      myList: (list.data ?? []).map((r) => r.title_id),
      watched: (list.data ?? []).filter((r) => r.watched_at).map((r) => r.title_id),
      history: (daily.data ?? []).map((r) => ({ date: r.date, together: r.together, reasons: r.reasons as Record<string, string> })),
    })
    setMeta({ householdId: hid, partnerId: partner?.id, inviteCode: household.data?.invite_code, partnerJoined: Boolean(partner), email })
    setSynced(true)
  }, [sb, userId, email])

  // Varios cambios seguidos (o un voto propio que vuelve por realtime) se agrupan en una sola recarga
  const refetch = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void fetchAll(), 300)
  }, [fetchAll])

  // Primera carga; si llegó con un enlace de invitación, se une al hogar de su pareja,
  // y lo que hizo sin cuenta en este teléfono pasa a su cuenta
  useEffect(() => {
    const code = pendingInvite.get()
    const join = code ? sb.rpc('join_household', { code }).then(() => pendingInvite.clear()) : Promise.resolve()
    void join.then(() => adoptGuest(userId)).then(fetchAll, fetchAll)
  }, [sb, userId, fetchAll])

  // Realtime: votos, lista, lista del día y ajustes de la pareja llegan al instante
  useEffect(() => {
    const hid = meta.householdId
    if (!hid) return
    const f = `household_id=eq.${hid}`
    const ch = sb
      .channel(`hogar-${hid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: f }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: f }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_lists', filter: f }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: f }, refetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, refetch)
      // Los borrados no se pueden filtrar por hogar: se recarga y RLS deja ver solo lo propio
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'votes' }, refetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'list_items' }, refetch)
      .subscribe()
    const onFocus = () => document.visibilityState === 'visible' && refetch()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      void sb.removeChannel(ch)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [sb, meta.householdId, refetch])

  // La lista del día es del hogar: la arma el primero de los dos que abra la app
  const loading = base.loading || !synced
  const keys = useMemo<Record<PersonId, string>>(() => ({ a: userId, b: meta.partnerId ?? 'pareja' }), [userId, meta.partnerId])
  useEffect(() => {
    if (loading || !saved.onboarded || !catalog.length || !meta.householdId) return
    const d = today()
    if (saved.history[0]?.date === d) return
    const picks = makeDaily(saved, catalog, keys, d)
    setSaved((s) => ({ ...s, history: [picks, ...s.history] }))
    void sb
      .from('daily_lists')
      .upsert({ household_id: meta.householdId, ...picks }, { onConflict: 'household_id,date', ignoreDuplicates: true })
      .then(refetch)
  }, [loading, saved, catalog, meta.householdId, sb, refetch, keys])

  const store = useMemo<Store>(() => {
    const hid = meta.householdId
    const d = derived(saved, catalog, keys)
    // Cambio optimista en pantalla, luego al servidor; si falla se recarga lo que hay allá
    const write = (fn: (s: Saved) => Saved, op: () => PromiseLike<{ error: unknown }>) => {
      setSaved(fn)
      void Promise.resolve(op()).then(({ error }) => error && refetch())
    }
    const myVote = (id: string, kind: VoteKind) =>
      write(
        (s) => ({ ...s, votes: { ...s.votes, a: withVote(s.votes.a, id, kind) } }),
        async () => {
          const prev = saved.votes.a
          const kinds = withVote(prev, id, kind)
          const rows = (Object.keys(kinds) as VoteKind[]).filter((k) => kinds[k].includes(id)).map((k) => ({ user_id: userId, household_id: hid, title_id: id, kind: k }))
          const del = await sb.from('votes').delete().eq('user_id', userId).eq('title_id', id)
          if (del.error) return del
          return sb.from('votes').insert(rows)
        },
      )
    return {
      ...saved,
      ...d,
      catalog,
      loading,
      more: base.more,
      live: hasLiveData,
      cloud: true,
      guest: false,
      partnerJoined: meta.partnerJoined,
      inviteCode: meta.inviteCode,
      email: meta.email,
      // En la nube cada uno vota por sí mismo: un voto "para la pareja" no se guarda
      vote: (id, kind, p) => (p === 'b' ? undefined : myVote(id, kind)),
      clearVote: (id, p) => {
        if (p === 'b') return
        write(
          (s) => ({ ...s, votes: { ...s.votes, a: without(s.votes.a, id) }, watched: s.watched.filter((x) => x !== id) }),
          async () => {
            if (saved.watched.includes(id)) await sb.from('list_items').update({ watched_at: null }).eq('household_id', hid!).eq('title_id', id)
            return sb.from('votes').delete().eq('user_id', userId).eq('title_id', id)
          },
        )
      },
      toggleList: (id) =>
        saved.myList.includes(id)
          ? write((s) => ({ ...s, myList: s.myList.filter((x) => x !== id), watched: s.watched.filter((x) => x !== id) }), () => sb.from('list_items').delete().eq('household_id', hid!).eq('title_id', id))
          : write((s) => ({ ...s, myList: [id, ...s.myList] }), () => sb.from('list_items').insert({ household_id: hid, title_id: id })),
      markWatched: (id, on) =>
        write(
          (s) => ({
            ...s,
            myList: s.myList.includes(id) ? s.myList : [id, ...s.myList],
            watched: on ? [...new Set([...s.watched, id])] : s.watched.filter((x) => x !== id),
          }),
          () => sb.from('list_items').upsert({ household_id: hid, title_id: id, watched_at: on ? new Date().toISOString() : null }, { onConflict: 'household_id,title_id' }),
        ),
      setActive: () => {},
      rename: (p, name) => {
        if (p !== 'a') return
        write((s) => ({ ...s, people: { ...s.people, a: { ...s.people.a, name } } }), () => sb.from('profiles').update({ name }).eq('id', userId))
      },
      // Los ajustes son del hogar; el deslizador manda muchos cambios, se guarda el último
      setSettings: (x) => {
        const next = { ...saved.settings, ...x }
        setSaved((s) => ({ ...s, settings: next }))
        window.clearTimeout(settingsTimer.current)
        settingsTimer.current = window.setTimeout(() => {
          void sb.from('households').update({ settings: next }).eq('id', hid!).then(({ error }) => error && refetch())
        }, 400)
      },
      finishOnboarding: () => write((s) => ({ ...s, onboarded: true }), () => sb.from('profiles').update({ onboarded: true }).eq('id', userId)),
      refreshDaily: () => {
        const picks = makeDaily(saved, catalog, keys)
        write((s) => ({ ...s, history: [picks, ...s.history.filter((h) => h.date !== today())] }), () => sb.from('daily_lists').upsert({ household_id: hid, ...picks }, { onConflict: 'household_id,date' }))
      },
      joinHousehold: async (code) => {
        const { error } = await sb.rpc('join_household', { code })
        if (error) throw new Error(error.message)
        await fetchAll()
      },
      // Al salir queda la pantalla de entrar, por si quiere cambiar de cuenta
      signOut: () => void sb.auth.signOut().then(() => askLogin({ mode: 'in' })),
      // "Empezar de cero" en la nube borra solo tus votos; la lista y el historial son de los dos
      reset: () =>
        write((s) => ({ ...s, onboarded: false, votes: { ...s.votes, a: emptyVotes() } }), async () => {
          const r = await sb.from('votes').delete().eq('user_id', userId)
          if (r.error) return r
          return sb.from('profiles').update({ onboarded: false }).eq('id', userId)
        }),
    }
  }, [saved, catalog, loading, base.more, meta, sb, userId, refetch, fetchAll, askLogin, keys])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// Votos, lista, ajustes y la lista de hoy de quien usó la app sin cuenta pasan a su cuenta, una sola vez.
// No pisa lo que ya tenía: un título que ya calificó con la cuenta se queda como estaba, y los ajustes
// solo se copian a una cuenta nueva que aún no comparte hogar.
async function adoptGuest(userId: string) {
  const sb = supabase!
  const g = readGuest()
  if (!g) return
  const { data: me } = await sb.from('profiles').select('household_id, onboarded').eq('id', userId).single()
  const hid = me?.household_id as string | undefined
  if (!hid) return
  const [{ data: mine }, { count }] = await Promise.all([
    sb.from('votes').select('title_id').eq('user_id', userId),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('household_id', hid),
  ])
  const taken = new Set((mine ?? []).map((r) => r.title_id as string))
  const votes = (Object.keys(g.votes.a) as VoteKind[]).flatMap((kind) =>
    g.votes.a[kind].filter((id) => !taken.has(id)).map((id) => ({ user_id: userId, household_id: hid, title_id: id, kind })),
  )
  const now = new Date().toISOString()
  const items = g.myList.map((id) => ({ household_id: hid, title_id: id, watched_at: g.watched.includes(id) ? now : null }))
  const fresh = !me!.onboarded && g.onboarded
  const todays = g.history[0]?.date === today() ? g.history[0] : undefined
  const ops = [
    votes.length && sb.from('votes').upsert(votes, { onConflict: 'user_id,title_id,kind', ignoreDuplicates: true }),
    items.length && sb.from('list_items').upsert(items, { onConflict: 'household_id,title_id', ignoreDuplicates: true }),
    fresh && sb.from('profiles').update({ onboarded: true }).eq('id', userId),
    fresh && count === 1 && sb.from('households').update({ settings: g.settings }).eq('id', hid),
    fresh && todays && sb.from('daily_lists').upsert({ household_id: hid, ...todays }, { onConflict: 'household_id,date', ignoreDuplicates: true }),
  ].filter(Boolean) as unknown as PromiseLike<{ error: unknown }>[]
  const results = await Promise.all(ops)
  // si algo falló se deja guardado para intentarlo la próxima vez que abra la app
  if (results.every((r) => !r.error)) {
    try {
      localStorage.removeItem(GUEST)
    } catch {
      // nada que limpiar
    }
  }
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}
