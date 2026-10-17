import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { PosterCard } from '../components/ui'
import type { Title } from '../data/types'

export default function Lista() {
  const s = useStore()
  const items = s.myList.map((id) => s.byId.get(id)).filter(Boolean) as Title[]
  const pending = items.filter((t) => !s.votes.a.seen.includes(t.id) && !s.votes.b.seen.includes(t.id))
  const past = s.history.slice(1, 8)

  return (
    <div className="screen">
      <div className="pad">
        <h1 className="h1">Mi lista</h1>
        <p className="sub">{pending.length ? `${pending.length} por ver` : 'Guarda títulos con el botón + para verlos después.'}</p>
      </div>
      {pending.length > 0 && (
        <div className="pad grid3" style={{ marginTop: 18 }}>
          {pending.map((t) => <PosterCard key={t.id} t={t} />)}
        </div>
      )}

      <div className="row-head"><h2 className="h2">Listas de días anteriores</h2></div>
      {past.length ? (
        <div className="panel" style={{ margin: '0 20px' }}>
          {past.map((d) => (
            <div className="list-row" key={d.date} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                {new Date(d.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                {d.together.map((id, i) => {
                  const t = s.byId.get(id)
                  return t ? (
                    <span key={id}>{i > 0 && ' · '}<Link to={`/titulo/${id}`} style={{ color: 'var(--text-2)' }}>{t.title}</Link></span>
                  ) : null
                })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ margin: '0 20px' }}>Cada día se guarda aquí la lista que les preparamos.</div>
      )}
    </div>
  )
}
