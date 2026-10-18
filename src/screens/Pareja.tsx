import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { buildDeck } from '../lib/recommender'
import { Icon, metaLine, scoreLabel } from '../components/ui'
import { TrailerModal } from '../components/Trailer'
import type { PersonId, Title } from '../data/types'

export default function Pareja() {
  const s = useStore()
  const me: PersonId = s.active
  const partner: PersonId = me === 'a' ? 'b' : 'a'
  // El mazo se calcula una vez por persona para que no se reordene al votar
  const deck = useMemo(() => buildDeck(s.catalog, s.votes[me], s.votes[partner], s.settings), [s.catalog, me, s.settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0)
  const [match, setMatch] = useState<Title | null>(null)
  const [drag, setDrag] = useState(0)
  const [trailer, setTrailer] = useState<Title | null>(null)
  const start = useRef<number | null>(null)

  const card = deck[idx]
  const next = deck[idx + 1]
  const matchCount = s.votes.a.liked.filter((id) => s.votes.b.liked.includes(id)).length
  const partnerVotes = s.votes[partner].liked.length + s.votes[partner].passed.length + s.votes[partner].disliked.length

  // En la nube la pareja vota desde su teléfono: si le da "me gusta" a algo que ya te gustó, la coincidencia aparece aquí al instante
  const partnerLiked = s.votes[partner].liked
  const prevPartner = useRef<string[] | null>(null)
  useEffect(() => {
    const prev = prevPartner.current
    prevPartner.current = partnerLiked
    if (!s.cloud || !prev) return
    const fresh = partnerLiked.find((id) => !prev.includes(id) && s.votes[me].liked.includes(id))
    const t = fresh && s.byId.get(fresh)
    if (t) setMatch(t)
  }, [partnerLiked]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = (kind: 'liked' | 'passed' | 'seen') => {
    if (!card) return
    s.vote(card.id, kind, me)
    if (kind === 'liked' && s.votes[partner].liked.includes(card.id)) setMatch(card)
    setDrag(0)
    setIdx((i) => i + 1)
  }

  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => start.current !== null && setDrag(e.clientX - start.current)
  const onUp = () => {
    if (drag > 110) act('liked')
    else if (drag < -110) act('passed')
    else setDrag(0)
    start.current = null
  }

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      {trailer?.trailer && <TrailerModal url={trailer.trailer} title={trailer.title} onClose={() => setTrailer(null)} />}
      <div className="pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="h2" style={{ fontSize: 26, fontWeight: 800 }}>Elegir juntos</h1>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.people[partner].name} ya votó {partnerVotes} títulos</span>
        </div>
        <span style={{ minWidth: 44, height: 32, borderRadius: 16, background: 'var(--coral)', color: 'var(--coral-ink)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px' }} aria-label={`${matchCount} coincidencias`}>
          {Icon.heart(14, 'var(--coral-ink)')}{matchCount}
        </span>
      </div>

      {!s.cloud && (
      <div className="chips" role="group" aria-label="¿Quién está eligiendo?">
        {(['a', 'b'] as PersonId[]).map((p) => (
          <button key={p} className={`chip${me === p ? (p === 'a' ? ' on' : ' coral on') : ''}`} aria-pressed={me === p} onClick={() => { s.setActive(p); setIdx(0) }}>
            Elige {s.people[p].name}
          </button>
        ))}
      </div>
      )}
      {s.cloud && !s.partnerJoined && (
        <div className="banner">Invita a tu pareja desde <Link to="/perfil">Perfil</Link> para ver sus coincidencias.</div>
      )}

      <div className="deck">
        {card ? (
          <>
            {next && <div className="swipe-card" style={{ background: next.color, transform: 'scale(.94) translateY(14px)', opacity: 0.55 }} aria-hidden="true" />}
            <div
              key={card.id}
              className="swipe-card"
              style={{ background: card.color, transform: `translateX(${drag}px) rotate(${drag / 18}deg)`, transition: start.current !== null ? 'none' : undefined }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {(card.poster || card.backdrop) && <img src={card.poster ?? card.backdrop} alt="" draggable={false} />}
              <div className="shade" />
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
                <span className="badge" style={{ fontSize: 13, padding: '6px 10px' }}>{scoreLabel(card)}</span>
                {card.providers[0] && <span className="badge dark" style={{ fontSize: 13, padding: '6px 10px' }}>{card.providers[0].name}</span>}
              </div>
              {s.votes[partner].liked.includes(card.id) && (
                <span className="badge" style={{ position: 'absolute', top: 16, right: 16, background: 'var(--coral)', color: 'var(--coral-ink)', fontSize: 13, padding: '6px 10px' }}>
                  A {s.people[partner].name} le gustó
                </span>
              )}
              {drag > 40 && <span className="stamp" style={{ left: 24, color: 'var(--coral)', borderColor: 'var(--coral)' }}>ME GUSTA</span>}
              {drag < -40 && <span className="stamp" style={{ right: 24, color: 'var(--text)', borderColor: 'var(--text)', transform: 'rotate(12deg)' }}>PASO</span>}
              <div style={{ position: 'relative', padding: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{card.title}</h2>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{metaLine(card)} · {card.year} · {card.genres.slice(0, 2).join(', ')}</span>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.overview}</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {card.trailer && (
                    <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setTrailer(card)}
                      style={{ background: 'none', border: 0, padding: 0, color: 'var(--gold)', font: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                      Ver tráiler
                    </button>
                  )}
                  <Link to={`/titulo/${card.id}`} style={{ fontSize: 14, fontWeight: 700 }}>Ver ficha</Link>
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={() => s.toggleList(card.id)} aria-pressed={s.myList.includes(card.id)}
                    style={{ background: 'none', border: 0, padding: 0, color: 'var(--gold)', font: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                    {s.myList.includes(card.id) ? 'En Mi lista' : '+ Mi lista'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="swipe-card" style={{ background: 'var(--surface)', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 32, gap: 12 }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800 }}>Ya votaste todo por hoy</span>
            <span style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.45 }}>
              {s.cloud
                ? `Bajen la nota mínima en Perfil. Cuando ${s.people[partner].name} vote desde su teléfono, sus coincidencias aparecen aquí.`
                : `Bajen la nota mínima en Perfil o pásale el teléfono a ${s.people[partner].name} para que vote.`}
            </span>
            {!s.cloud && <button className="btn primary" onClick={() => { s.setActive(partner); setIdx(0) }}>Que elija {s.people[partner].name}</button>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '20px 0 8px' }}>
        <button className="btn" onClick={() => act('passed')} aria-label="Pasar" disabled={!card} style={{ width: 64, height: 64, borderRadius: 32, padding: 0 }}>{Icon.x()}</button>
        <button className="btn" onClick={() => act('seen')} disabled={!card} style={{ height: 44, borderRadius: 22, fontSize: 13, fontWeight: 600 }}>Ya la vi</button>
        <button className="btn" onClick={() => act('liked')} aria-label="Me gusta" disabled={!card} style={{ width: 76, height: 76, borderRadius: 38, padding: 0, background: 'var(--coral)', borderColor: 'var(--coral)', color: 'var(--coral-ink)' }}>
          {Icon.heart(32, 'var(--coral-ink)')}
        </button>
      </div>

      {match && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Coinciden">
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral)', letterSpacing: '.14em', textTransform: 'uppercase' }}>A los dos les gustó</span>
          <span style={{ fontFamily: 'var(--display)', fontSize: 52, fontWeight: 800, lineHeight: 1 }}>¡Coinciden!</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '10px 0' }}>
            <span className="avatar a" style={{ width: 44, height: 44, borderRadius: 22 }}>{s.people.a.name[0]}</span>
            <div className="poster" style={{ width: 150, background: match.color }}>
              {match.poster && <img src={match.poster} alt="" />}
              {!match.poster && <span className="ptitle" style={{ fontSize: 22 }}>{match.title}</span>}
            </div>
            <span className="avatar b" style={{ width: 44, height: 44, borderRadius: 22 }}>{s.people.b.name[0]}</span>
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{match.title} · {scoreLabel(match)}{match.providers[0] ? ` · ${match.providers[0].name}` : ''}</span>
          <Link to={`/titulo/${match.id}`} className="btn primary block" style={{ maxWidth: 360, height: 52 }}>Verla esta noche</Link>
          <button className="btn block" style={{ maxWidth: 360, height: 52 }} aria-pressed={s.myList.includes(match.id)} onClick={() => !s.myList.includes(match.id) && s.toggleList(match.id)}>
            {s.myList.includes(match.id) ? <>{Icon.check(18)}Guardada en Mi lista</> : <>{Icon.plus(18)}Guardar en Mi lista</>}
          </button>
          <button className="btn block" style={{ maxWidth: 360, height: 52, background: 'transparent' }} onClick={() => setMatch(null)}>Seguir eligiendo</button>
        </div>
      )}
    </div>
  )
}
