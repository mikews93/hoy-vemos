import { useNavigate } from 'react-router-dom'
import { learn, satisfaction } from './recommender'
import { today, useStore } from './store'
import type { PersonId } from '../data/types'

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
