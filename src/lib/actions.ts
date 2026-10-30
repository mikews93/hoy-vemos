import { useNavigate } from 'react-router-dom'
import { eagerOf, isMissing, learn, satisfaction } from './recommender'
import { today, useStore } from './store'
import type { PersonId } from '../data/types'
import { nextUp, seasonDone, type Episode, type Progress } from './series'

// "Esta noche vemos esta": guarda la noche (para repartir los turnos), la suma a Mi lista y abre su ficha.
// Funciona igual en un teléfono compartido y en la nube, porque solo usa ajustes del hogar y Mi lista.
export function useChooseTonight() {
  const s = useStore()
  const nav = useNavigate()
  return (id: string) => {
    const t = s.byId.get(id)
    if (!t) return
    const sat: Record<string, number> = {}
    // quien aún no calificó nada (o el invitado sin pareja) no cuenta para los turnos
    ;(['a', 'b'] as PersonId[])
      .filter((p) => s.votes[p].liked.length > 0)
      .forEach((p) => (sat[s.keys[p]] = satisfaction(t, learn(s.votes[p], s.catalog), s.catalog)))
    const nights = [...(s.settings.nights ?? []).filter((n) => n.date !== today()), { date: today(), id, sat }].slice(-12)
    s.setSettings({ nights })
    if (!s.myList.includes(id)) s.toggleList(id)
    nav(`/titulo/${id}`)
  }
}

export function useVetoes() {
  const s = useStore()
  const of = (p: PersonId) => s.settings.vetoes?.[s.keys[p]] ?? []
  const set = (p: PersonId, genres: string[]) => s.setSettings({ vetoes: { ...s.settings.vetoes, [s.keys[p]]: genres } })
  return { of, set }
}

// Avance de las series: "vimos el siguiente", "vimos toda la temporada", "empezar de cero".
// Al terminar el último episodio de una serie que ya no sigue, cuenta como vista para los dos.
export function useSeriesProgress() {
  const s = useStore()
  const all = s.settings.progress ?? {}
  const save = (id: string, ep: Episode | null) => {
    const { [id]: _old, ...rest } = all
    const next: Record<string, Progress> = ep ? { ...rest, [id]: { ...ep, at: new Date().toISOString() } } : rest
    s.setSettings({ progress: next })
    if (!ep) return
    const t = s.byId.get(id)
    // markWatched ya la deja en Mi lista; sumarla aparte la quitaría otra vez
    if (t && nextUp(t, next[id]).kind === 'finished') s.markWatched(id, true)
    else if (!s.myList.includes(id)) s.toggleList(id)
  }
  return {
    of: (id: string): Progress | undefined => all[id],
    watchNext: (id: string) => {
      const t = s.byId.get(id)
      const up = t && nextUp(t, all[id])
      if (up?.kind === 'episode') save(id, up.ep)
    },
    markSeason: (id: string, season: number) => {
      const t = s.byId.get(id)
      if (t) save(id, seasonDone(t, season))
    },
    reset: (id: string) => save(id, null),
  }
}

// "¡Muero por verla!": un "me gusta" con ganas. Se guarda en los ajustes del hogar por persona, como los vetos.
export function useEager() {
  const s = useStore()
  const of = (p: PersonId) => eagerOf(s.settings, s.keys[p], s.votes[p])
  const set = (id: string, on: boolean, p: PersonId = s.active) => {
    // en la nube cada uno marca solo lo suyo, igual que los votos
    if (s.cloud && p !== 'a') return
    const mine = (s.settings.eager?.[s.keys[p]] ?? []).filter((x) => x !== id)
    s.setSettings({ eager: { ...s.settings.eager, [s.keys[p]]: on ? [...mine, id].slice(-300) : mine } })
  }
  return { of, set }
}

// Notas privadas del hogar en Mi lista ("nos la recomendó Ana")
export function useNotes() {
  const s = useStore()
  return {
    of: (id: string) => s.settings.notes?.[id] ?? '',
    set: (id: string, text: string) => {
      const { [id]: _old, ...rest } = s.settings.notes ?? {}
      const clean = text.trim().slice(0, 140)
      s.setSettings({ notes: clean ? { ...rest, [id]: clean } : rest })
    },
  }
}

// "No estaba ahí": la plataforma no tenía lo que TMDB decía. Se esconde de todo lo compartido por un mes.
export function useMissing() {
  const s = useStore()
  return {
    of: (id: string) => s.settings.missing?.[id],
    report: (id: string, platform: string) => {
      // de paso se olvidan los reportes que ya vencieron, para que los ajustes no crezcan sin fin
      const live = Object.fromEntries(Object.entries(s.settings.missing ?? {}).filter(([x]) => isMissing(s.settings, x)))
      s.setSettings({ missing: { ...live, [id]: { p: platform, d: today() } } })
    },
    undo: (id: string) => {
      const { [id]: _old, ...rest } = s.settings.missing ?? {}
      s.setSettings({ missing: rest })
    },
  }
}
