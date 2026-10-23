import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { buildSummary } from '../lib/summary'
import { Icon, Rail } from '../components/ui'

/** "Su año": lo que vieron juntos, sus géneros y quién cedió más */
export default function Resumen() {
  /** Hooks */
  const s = useStore()
  const nav = useNavigate()
  const year = new Date().getFullYear()
  // Las noches y el avance de series traen fecha y se cuentan solo del año; "La vimos" no guarda fecha en el teléfono
  const sum = useMemo(() => {
    const thisYear = (date: string) => date.startsWith(String(year))
    const nights = (s.settings.nights ?? []).filter((n) => thisYear(n.date))
    const progress = Object.fromEntries(Object.entries(s.settings.progress ?? {}).filter(([, p]) => thisYear(p.at)))
    return buildSummary(s.byId, s.votes, s.watched, nights, progress, s.keys)
  }, [s.byId, s.votes, s.watched, s.settings.nights, s.settings.progress, s.keys, year])
  const top = sum.genres[0]?.count ?? 1
  const couple = !s.guest

  return (
    <div className="screen">
      <div className="pad">
        <button className="btn icon" aria-label="Volver" onClick={() => nav(-1)} style={{ borderRadius: 22, width: 44, height: 44 }}>{Icon.back()}</button>
        <span className="eyebrow" style={{ display: 'block', marginTop: 16, color: 'var(--coral)' }}>Su {year} en Hoy Vemos</span>
        <h1 className="h1" style={{ marginTop: 6 }}>{couple ? 'Lo que vieron juntos' : 'Lo que viste'}</h1>
      </div>

      {sum.together.length === 0 ? (
        <div className="empty">
          Todavía no hay nada para resumir. Marquen "La vimos" en Mi lista, sigan una serie o elijan con "Decide tú", y aquí va quedando su año.
        </div>
      ) : (
        <>
          <div className="pad score-grid" style={{ marginTop: 20 }}>
            <div className="score"><span className="eyebrow" style={{ fontSize: 11 }}>Películas</span><b style={{ color: 'var(--gold)' }}>{sum.movies}</b></div>
            <div className="score"><span className="eyebrow" style={{ fontSize: 11 }}>Series</span><b>{sum.series}</b><span className="note">{sum.episodes} episodios</span></div>
            <div className="score"><span className="eyebrow" style={{ fontSize: 11 }}>Horas</span><b>{sum.hours}</b><span className="note">aproximadas</span></div>
          </div>

          {sum.favorite && (
            <div className="banner" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--coral)' }}>{Icon.heart(22)}</span>
              <span>{couple ? 'La que más les gustó a los dos' : 'Tu favorita'}: <b>{sum.favorite.title}</b>.</span>
            </div>
          )}

          {sum.genres.length > 0 && (
            <>
              <div className="row-head"><h2 className="h2">Sus géneros</h2></div>
              <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sum.genres.map((g) => (
                  <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 120, fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--line)' }}>
                      <span style={{ display: 'block', height: '100%', width: `${(g.count / top) * 100}%`, borderRadius: 5, background: 'var(--gold)' }} />
                    </span>
                    <span className="sub" style={{ margin: 0, width: 24, textAlign: 'right' }}>{g.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {couple && (sum.nights > 0 || sum.yielded) && (
            <>
              <div className="row-head"><h2 className="h2">Cómo decidieron</h2></div>
              <div className="pad">
                <p className="sub" style={{ margin: 0 }}>
                  {sum.nights > 0 && `Eligieron ${sum.nights} ${sum.nights === 1 ? 'noche' : 'noches'} con la app. `}
                  {sum.yielded
                    ? `${s.people[sum.yielded.who].name} cedió ${sum.yielded.times} ${sum.yielded.times === 1 ? 'vez' : 'veces'}; por eso la app le da más turnos.`
                    : 'Los turnos estuvieron parejos.'}
                </p>
              </div>
            </>
          )}

          <div className="row-head"><h2 className="h2">Todo lo que vieron</h2></div>
          <Rail items={sum.together} />
        </>
      )}

      <p className="note pad" style={{ marginTop: 20 }}>
        {couple
          ? `En total, ${s.people.a.name} marcó ${sum.seenBy.a} títulos como vistos y ${s.people.b.name} ${sum.seenBy.b}, contando el historial importado.`
          : `En total marcaste ${sum.seenBy.a} títulos como vistos, contando el historial importado.`}
      </p>
    </div>
  )
}
