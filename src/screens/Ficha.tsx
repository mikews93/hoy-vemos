import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Icon, Poster, metaLine } from '../components/ui'
import { TrailerModal } from '../components/Trailer'
import { REGION } from '../data/live'
import { learn, tasteFor } from '../lib/recommender'
import type { PersonId, Title, Votes } from '../data/types'

// Por qué le puede gustar a una persona: primero algo que ya le gustó y se parece; si no, su gusto más fuerte que el título tiene
function reasonFor(t: Title, v: Votes, byId: Map<string, Title>, catalog: Title[]): string | null {
  const liked = v.liked.map((x) => byId.get(x)).filter(Boolean) as Title[]
  const hits = liked.filter((l) => l.id !== t.id && (l.genres.some((g) => t.genres.includes(g)) || l.tags.some((x) => t.tags.includes(x)))).slice(0, 2)
  if (hits.length) return `porque le ${hits.length > 1 ? 'gustaron' : 'gustó'} ${hits.map((h) => h.title).join(' y ')}`
  const taste = tasteFor(t, learn(v, catalog))
  return taste ? `por lo mucho que le gusta ${/^[A-ZÁÉÍÓÚ]/.test(taste) ? `el género ${taste.toLowerCase()}` : `«${taste}»`}` : null
}

function coupleWhy(people: { name: string; why: string | null }[]): string | null {
  const known = people.filter((p) => p.why)
  if (!known.length) return null
  if (known.length === 2) return `Les puede gustar a los dos: a ${known[0].name} ${known[0].why}, y a ${known[1].name} ${known[1].why}.`
  return `A ${known[0].name} le puede gustar ${known[0].why}.`
}

export default function Ficha() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const s = useStore()
  const t = s.byId.get(id)
  const [showTrailer, setShowTrailer] = useState(false)
  if (!t) return <div className="empty" style={{ marginTop: 80 }}>No encontramos este título. <Link to="/">Volver al inicio</Link></div>

  const v = s.votes[s.active]
  const partner: PersonId = s.active === 'a' ? 'b' : 'a'
  const who = s.guest ? [s.active] : [s.active, partner]
  const why = coupleWhy(who.map((p) => ({ name: s.people[p].name, why: reasonFor(t, s.votes[p], s.byId, s.catalog) })))
  const isSeen = v.seen.includes(t.id)
  const isLiked = v.liked.includes(t.id)
  const flat = t.providers.filter((p) => p.kind === 'flatrate')
  const rent = t.providers.filter((p) => p.kind !== 'flatrate')
  const mine = (name: string) => s.settings.platforms.includes(name)

  return (
    <div style={{ paddingBottom: 24 }}>
      {showTrailer && t.trailer && <TrailerModal url={t.trailer} title={t.title} onClose={() => setShowTrailer(false)} />}
      <div style={{ height: 300, background: t.color, position: 'relative', overflow: 'hidden' }}>
        {t.backdrop && <img src={t.backdrop} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, background: 'linear-gradient(to top, var(--bg), rgba(15,14,19,0))' }} />
        <button className="btn icon" aria-label="Volver" onClick={() => nav(-1)} style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', left: 16, borderRadius: 22, width: 44, height: 44, background: 'var(--bg)' }}>{Icon.back()}</button>
        {t.trailer && (
          <button onClick={() => setShowTrailer(true)} aria-label="Ver tráiler" style={{ border: 0, cursor: 'pointer', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 64, height: 64, borderRadius: 32, background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.play(26)}</button>
        )}
      </div>

      <div className="pad" style={{ display: 'flex', gap: 16, marginTop: -70, position: 'relative', alignItems: 'flex-end' }}>
        <div style={{ width: 110, flexShrink: 0 }}><Poster t={t} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{t.title}</h1>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.originalTitle && t.originalTitle !== t.title ? `${t.originalTitle} · ` : ''}{t.year} · {metaLine(t)}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.genres.join(', ')}{t.country ? ` · ${t.country}` : ''}</span>
        </div>
      </div>

      <div className="pad score-grid" style={{ marginTop: 24 }}>
        <div className="score"><span className="eyebrow" style={{ fontSize: 11 }}>IMDb</span><b style={{ color: 'var(--gold)' }}>{t.ratings.imdb?.toFixed(1) ?? '–'}</b><span className="note">{t.ratings.imdbVotes ? `${t.ratings.imdbVotes} mil votos` : 'de 10'}</span></div>
        <div className="score"><span className="eyebrow" style={{ fontSize: 11 }}>Rotten T.</span><b>{t.ratings.rt != null ? `${t.ratings.rt}%` : '–'}</b><span className="note">crítica</span></div>
        <div className="score"><span className="eyebrow" style={{ fontSize: 11 }}>Metacritic</span><b>{t.ratings.mc ?? '–'}</b><span className="note">de 100</span></div>
      </div>

      {why && (
        <div style={{ margin: '16px 20px 0', padding: '14px 16px', borderRadius: 16, background: '#2A1A16', border: '1px solid #5A3027', display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.45 }}>
          <span style={{ color: 'var(--coral)', flexShrink: 0 }}>{Icon.star()}</span>
          <span>{why}</span>
        </div>
      )}

      <div className="pad" style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn primary" style={{ flex: 1, height: 52 }} aria-pressed={s.myList.includes(t.id)} onClick={() => s.toggleList(t.id)}>
          {s.myList.includes(t.id) ? Icon.check(18) : Icon.plus(18)}{s.myList.includes(t.id) ? 'En Mi lista' : 'Guardar'}
        </button>
        <button className="btn" style={{ flex: 1, height: 52 }} aria-pressed={isSeen} onClick={() => (isSeen ? s.clearVote(t.id) : s.vote(t.id, 'seen'))}>
          {Icon.check(18)}{isSeen ? 'Vista' : 'Ya la vi'}
        </button>
        <button className="btn icon" style={{ height: 52, width: 52, color: isLiked ? 'var(--coral)' : undefined }} aria-label="Me gustó" aria-pressed={isLiked} onClick={() => (isLiked ? s.clearVote(t.id) : s.vote(t.id, 'liked'))}>
          {isLiked ? Icon.heart(20) : Icon.heartLine(20)}
        </button>
        <button className="btn icon" style={{ height: 52, width: 52 }} aria-label="No me interesa" onClick={() => { s.vote(t.id, 'disliked'); nav(-1) }}>{Icon.ban()}</button>
      </div>

      <h2 className="h2 pad" style={{ fontSize: 20, marginTop: 28, marginBottom: 12 }}>Dónde ver</h2>
      {t.providers.length ? (
        <div className="panel" style={{ margin: '0 20px' }}>
          {[...flat, ...rent].map((p) => (
            <div className="list-row" key={p.name + p.kind}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2E2A36', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'var(--display)' }}>{p.name[0]}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.kind === 'flatrate' && mine(p.name) ? 'var(--ok)' : 'var(--muted)' }}>
                  {p.kind === 'flatrate' ? (mine(p.name) ? 'Incluida en tu suscripción' : 'Con suscripción') : 'Alquiler o compra'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ margin: '0 20px' }}>Sin datos de plataformas en tu país.</div>
      )}
      <p className="note pad" style={{ marginTop: 8 }}>Disponibilidad en {REGION}. Datos de JustWatch vía TMDB.</p>

      <h2 className="h2 pad" style={{ fontSize: 20, marginTop: 24, marginBottom: 8 }}>De qué trata</h2>
      <p className="pad" style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--text-2)' }}>{t.overview || 'Sin sinopsis disponible.'}</p>

      {t.cast && t.cast.length > 0 && (
        <>
          <h2 className="h2 pad" style={{ fontSize: 20, marginTop: 24, marginBottom: 12 }}>Reparto y dirección</h2>
          <div className="rail">
            {t.cast.map((c) => (
              <div key={c.name} style={{ width: 76, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: '#2E2A36', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{c.name[0]}</div>
                <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{c.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.role}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
