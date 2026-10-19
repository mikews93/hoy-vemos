import { Link } from 'react-router-dom'
import { useAuth, useStore } from '../lib/store'
import { Icon, Rail, metaLine, scoreLabel } from '../components/ui'
import { rewatchable } from '../lib/recommender'
import type { Title } from '../data/types'

// Lista compartida "por ver": se guarda con el botón + (en Hoy, la ficha o Pareja) y se marca como vista al verla
function Row({ t }: { t: Title }) {
  const s = useStore()
  const watched = s.watched.includes(t.id)
  const oneSaw = (['a', 'b'] as const).find((p) => s.votes[p].seen.includes(t.id))
  return (
    <div className="list-row" style={{ gap: 12 }}>
      <Link to={`/titulo/${t.id}`} aria-label={t.title} style={{ width: 52, height: 78, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: t.color }}>
        {t.poster && <img src={t.poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </Link>
      <Link to={`/titulo/${t.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--text)', textDecoration: 'none' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{scoreLabel(t)} · {metaLine(t)}</span>
        {!watched && oneSaw && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.people[oneSaw].name} ya la vio</span>}
      </Link>
      <button className="btn" style={{ height: 40, fontSize: 13, padding: '0 12px', color: watched ? 'var(--ok)' : undefined }} aria-pressed={watched} onClick={() => s.markWatched(t.id, !watched)}>
        {Icon.check(16)}{watched ? 'Vista' : 'La vimos'}
      </button>
      <button className="btn icon" style={{ height: 40, width: 40 }} aria-label={`Quitar ${t.title} de la lista`} onClick={() => s.toggleList(t.id)}>{Icon.x(16)}</button>
    </div>
  )
}

export default function Lista() {
  const s = useStore()
  const { askLogin } = useAuth()
  const items = s.myList.map((id) => s.byId.get(id)).filter(Boolean) as Title[]
  const pending = items.filter((t) => !s.watched.includes(t.id))
  const done = items.filter((t) => s.watched.includes(t.id))
  const past = s.history.slice(1, 8)
  const again = rewatchable(s.pool, s.votes).slice(0, 12)

  return (
    <div className="screen">
      <div className="pad">
        <h1 className="h1">Mi lista</h1>
        <p className="sub">{pending.length ? `${pending.length} por ver${s.cloud && s.partnerJoined ? `, compartida con ${s.people.b.name}` : ''}.` : 'Toca + en cualquier título (en Hoy, en su ficha o en Pareja) para guardarlo aquí.'}</p>
      </div>
      {s.guest && pending.length > 0 && (
        <div className="banner">Tu lista se guarda en este teléfono. <button className="link" onClick={() => askLogin({ reason: 'Crea tu cuenta para compartir tu lista con tu pareja.', mode: 'up' })}>Crea una cuenta</button> para compartirla con tu pareja.</div>
      )}
      {pending.length > 0 && (
        <div className="panel" style={{ margin: '18px 20px 0' }}>
          {pending.map((t) => <Row key={t.id} t={t} />)}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="row-head"><h2 className="h2">Ya las vimos</h2></div>
          <div className="panel" style={{ margin: '0 20px' }}>
            {done.map((t) => <Row key={t.id} t={t} />)}
          </div>
        </>
      )}

      {again.length > 0 && (
        <>
          <div className="row-head">
            <div>
              <h2 className="h2">Para repetir</h2>
              <p className="sub" style={{ margin: 0 }}>Ya las vieron y les encantaron, para las noches sin energía</p>
            </div>
          </div>
          <Rail items={again} />
        </>
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
