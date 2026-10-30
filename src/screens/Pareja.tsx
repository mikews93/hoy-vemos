import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { buildDeck, coupleScore, isMissing, learn } from '../lib/recommender'
import { fitsTonight, useTonight } from '../lib/tonight'
import { useEager } from '../lib/actions'
import { FinalDeTres } from '../components/Tonight'
import { Icon, metaLine, scoreLabel } from '../components/ui'
import { TrailerModal } from '../components/Trailer'
import type { PersonId, Title } from '../data/types'

export default function Pareja() {
  const s = useStore()
  const me: PersonId = s.active
  const partner: PersonId = me === 'a' ? 'b' : 'a'
  const [tonight, setTonight] = useTonight()
  const eager = useEager()
  const partnerEager = eager.of(partner)
  // El mazo se arma una vez por persona y filtros, y no se recalcula con cada voto (cada voto cambia s.pool): si se
  // reordenara, por un instante podía asomar otra tarjeta. Cuando llega otra página del catálogo, lo nuevo se suma
  // al final sin mover lo que ya estaba. Lo votado se saca al mostrar, y también lo que se votó aquí aunque la nube
  // tarde en confirmarlo, para que no reaparezca algo que ya pasaron o ya vieron.
  const filters = JSON.stringify([me, s.settings.minImdb, s.settings.platforms, s.settings.vetoes, s.settings.missing, tonight])
  const [deck, setDeck] = useState<{ filters: string; items: Title[] }>({ filters: '', items: [] })
  useEffect(() => {
    const fresh = buildDeck(s.pool, s.votes[me], s.votes[partner], s.settings, partnerEager).filter((t) => fitsTonight(t, tonight))
    setDeck((d) => {
      if (d.filters !== filters) return { filters, items: fresh }
      const have = new Set(d.items.map((t) => t.id))
      const added = fresh.filter((t) => !have.has(t.id))
      return added.length ? { filters, items: [...d.items, ...added] } : d
    })
  }, [s.catalog, filters]) // eslint-disable-line react-hooks/exhaustive-deps
  const [doneHere, setDoneHere] = useState<string[]>([])
  const mine = s.votes[me]
  const done = new Set([...doneHere, ...mine.liked, ...mine.disliked, ...mine.seen, ...mine.passed])
  const left = deck.items.filter((t) => !done.has(t.id))
  // El mazo no se acaba: cuando quedan pocas tarjetas se trae otra página del catálogo. Cada página gasta consultas
  // del límite diario de OMDb, así que solas se traen hasta tres por visita; después, con el botón "Buscar más".
  const { more } = s
  const autoLoads = useRef(0)
  const autoMore = autoLoads.current < 3
  useEffect(() => {
    if (left.length >= 6 || more.done || more.loading || !autoMore) return
    autoLoads.current++
    more.load()
  }, [left.length, more, autoMore])
  const [final, setFinal] = useState(false)
  const [match, setMatch] = useState<Title | null>(null)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [trailer, setTrailer] = useState<Title | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const card = left[0]
  const next = left[1]
  // cuántos de los dos mueren por verla (0, 1 o 2): las coincidencias con más ganas van primero
  const ganas = (id: string) => Number(eager.of('a').includes(id)) + Number(eager.of('b').includes(id))
  const matchCount = s.votes.a.liked.filter((id) => s.votes.b.liked.includes(id)).length
  // Coincidencias que aún no vieron, de la que más les gusta a los dos a la que menos: de aquí sale el final de tres
  const finalists = useMemo(() => {
    const wa = learn(s.votes.a, s.catalog)
    const wb = learn(s.votes.b, s.catalog)
    return s.votes.a.liked
      .filter((id) => s.votes.b.liked.includes(id) && !s.votes.a.seen.includes(id) && !s.votes.b.seen.includes(id) && !isMissing(s.settings, id))
      .map((id) => s.byId.get(id))
      .filter((t): t is Title => Boolean(t) && fitsTonight(t!, tonight))
      .map((t) => ({ t, s: coupleScore(t, wa, wb, s.turn) + ganas(t.id) * 1.5 }))
      .sort((x, y) => y.s - x.s)
      .map(({ t }) => t)
  }, [s.votes, s.catalog, s.byId, s.turn, tonight, s.settings.eager]) // eslint-disable-line react-hooks/exhaustive-deps
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

  const act = (kind: 'liked' | 'passed' | 'seen' | 'eager') => {
    if (!card) return
    s.vote(card.id, kind === 'eager' ? 'liked' : kind, me)
    eager.set(card.id, kind === 'eager', me)
    if ((kind === 'liked' || kind === 'eager') && s.votes[partner].liked.includes(card.id)) setMatch(card)
    setDrag({ x: 0, y: 0 })
    setDoneHere((d) => [...d, card.id])
  }

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => start.current && setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y) })
  // hacia arriba (sin irse mucho de lado) es "¡Muero por verla!"
  const up = drag.y < -40 && Math.abs(drag.x) < 80
  const onUp = () => {
    if (drag.y < -110 && Math.abs(drag.x) < 80) act('eager')
    else if (drag.x > 110) act('liked')
    else if (drag.x < -110) act('passed')
    else setDrag({ x: 0, y: 0 })
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
          <button key={p} className={`chip${me === p ? (p === 'a' ? ' on' : ' coral on') : ''}`} aria-pressed={me === p} onClick={() => { s.setActive(p); setDoneHere([]) }}>
            Elige {s.people[p].name}
          </button>
        ))}
      </div>
      )}
      {finalists.length >= 3 && (
        <div className="pad" style={{ marginTop: 12 }}>
          <button className="btn gold block" onClick={() => setFinal(true)}>Tienen {finalists.length} coincidencias: hagan el final de tres</button>
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
              style={{ background: card.color, transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`, transition: start.current !== null ? 'none' : undefined }}
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
                <span className="badge" style={{ position: 'absolute', top: 16, right: 16, background: partnerEager.includes(card.id) ? 'var(--gold)' : 'var(--coral)', color: partnerEager.includes(card.id) ? 'var(--bg)' : 'var(--coral-ink)', fontSize: 13, padding: '6px 10px' }}>
                  {partnerEager.includes(card.id) ? `${s.people[partner].name} muere por verla` : `A ${s.people[partner].name} le gustó`}
                </span>
              )}
              {up && <span className="stamp" style={{ left: '50%', transform: 'translateX(-50%) rotate(-4deg)', color: 'var(--gold)', borderColor: 'var(--gold)', whiteSpace: 'nowrap' }}>¡MUERO POR VERLA!</span>}
              {!up && drag.x > 40 && <span className="stamp" style={{ left: 24, color: 'var(--coral)', borderColor: 'var(--coral)' }}>ME GUSTA</span>}
              {!up && drag.x < -40 && <span className="stamp" style={{ right: 24, color: 'var(--text)', borderColor: 'var(--text)', transform: 'rotate(12deg)' }}>PASO</span>}
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
            {more.loading || s.loading || (!more.done && autoMore) ? (
              <span style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800 }}>Trayendo más títulos…</span>
            ) : (
              <>
                <span style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800 }}>{more.done ? 'Ya votaste todo lo que pasa sus filtros' : 'Ya votaste todo lo que trajimos'}</span>
                <span style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {s.cloud
                    ? `Abran un poco los filtros para seguir. Cuando ${s.people[partner].name} vote desde su teléfono, sus coincidencias aparecen aquí.`
                    : `Abran un poco los filtros para seguir, o pásale el teléfono a ${s.people[partner].name} para que vote.`}
                </span>
                {/* Para seguir votando sin salir de aquí: lo que más tranca el mazo son los filtros de esta noche y la nota mínima */}
                {!more.done && <button className="btn primary" onClick={more.load}>Buscar más títulos</button>}
                {(tonight.time !== 'any' || tonight.who !== 'both') && (
                  <button className="btn primary" onClick={() => setTonight({ time: 'any', who: 'both' })}>Quitar los filtros de esta noche</button>
                )}
                {s.settings.minImdb > 6 && (
                  <button className="btn" onClick={() => s.setSettings({ minImdb: Math.max(6, Math.round((s.settings.minImdb - 0.5) * 10) / 10) })}>
                    Bajar la nota mínima a {Math.max(6, s.settings.minImdb - 0.5).toFixed(1)}
                  </button>
                )}
                {!s.cloud && <button className="btn" onClick={() => { s.setActive(partner); setDoneHere([]) }}>Que elija {s.people[partner].name}</button>}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 0 8px' }}>
        <button className="btn" onClick={() => act('passed')} aria-label="Pasar" disabled={!card} style={{ width: 64, height: 64, borderRadius: 32, padding: 0 }}>{Icon.x()}</button>
        <button className="btn" onClick={() => act('seen')} disabled={!card} style={{ height: 44, borderRadius: 22, fontSize: 13, fontWeight: 600 }}>Ya la vi</button>
        <button className="btn" onClick={() => act('eager')} aria-label="¡Muero por verla!" title="¡Muero por verla! (o desliza hacia arriba)" disabled={!card} style={{ width: 56, height: 56, borderRadius: 28, padding: 0, color: 'var(--gold)', borderColor: 'var(--gold)' }}>
          {Icon.star(26)}
        </button>
        <button className="btn" onClick={() => act('liked')} aria-label="Me gusta" disabled={!card} style={{ width: 76, height: 76, borderRadius: 38, padding: 0, background: 'var(--coral)', borderColor: 'var(--coral)', color: 'var(--coral-ink)' }}>
          {Icon.heart(32, 'var(--coral-ink)')}
        </button>
      </div>

      {final && <FinalDeTres options={finalists} onClose={() => setFinal(false)} />}

      {match && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Coinciden">
          <span style={{ fontSize: 13, fontWeight: 700, color: ganas(match.id) === 2 ? 'var(--gold)' : 'var(--coral)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
            {ganas(match.id) === 2 ? 'Los dos mueren por verla' : 'A los dos les gustó'}
          </span>
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
