import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useChooseTonight } from '../lib/actions'
import { decideFor, eagerOf, type Who } from '../lib/recommender'
import { fitsTonight, TIME_LABELS, useTonight, WHO_LABELS, type Company, type TimeBudget } from '../lib/tonight'
import { Icon, Poster, metaLine, scoreLabel } from './ui'
import type { Title } from '../data/types'
import { episodeLabel, nextUp } from '../lib/series'

/** Chips de "¿cuánto tiempo tienen?" y "¿quiénes ven?" */
export function TonightBar() {
  const s = useStore()
  const [n, set] = useTonight()
  const who = (Object.keys(WHO_LABELS) as Company[]).filter((w) => !s.guest || w !== 'both')
  return (
    <div className="tonight" role="group" aria-label="Cómo es la noche de hoy">
      <div className="chips">
        {(Object.keys(TIME_LABELS) as TimeBudget[]).map((k) => (
          <button key={k} className={`chip${n.time === k ? ' on' : ''}`} aria-pressed={n.time === k} onClick={() => set({ time: k })}>{TIME_LABELS[k]}</button>
        ))}
      </div>
      <div className="chips" style={{ paddingTop: 8 }}>
        {who.map((k) => (
          <button key={k} className={`chip${n.who === k || (s.guest && k === 'me' && n.who === 'both') ? ' coral on' : ''}`} aria-pressed={n.who === k} onClick={() => set({ who: k })}>
            {k === 'me' && !s.guest ? `Solo ${s.people[s.active].name}` : WHO_LABELS[k]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Lo que cuenta como "ya lo eligieron" para que "Decide tú" lo prefiera */
function useBoost(): Record<string, number> {
  const s = useStore()
  return useMemo(() => {
    const boost: Record<string, number> = {}
    s.daily?.together.forEach((id) => (boost[id] = 1))
    s.myList.filter((id) => !s.watched.includes(id)).forEach((id) => (boost[id] = (boost[id] ?? 0) + 1.5))
    s.votes.a.liked.filter((id) => s.votes.b.liked.includes(id)).forEach((id) => (boost[id] = (boost[id] ?? 0) + 3))
    // "¡Muero por verla!" de cualquiera de los dos pesa un poco más que un "me gusta"
    ;(['a', 'b'] as const).forEach((p) => eagerOf(s.settings, s.keys[p], s.votes[p]).forEach((id) => (boost[id] = (boost[id] ?? 0) + 1.5)))
    // una serie que ya van viendo es la propuesta más fácil para esta noche
    Object.entries(s.settings.progress ?? {}).forEach(([id, p]) => {
      const t = s.byId.get(id)
      if (t && nextUp(t, p).kind === 'episode') boost[id] = (boost[id] ?? 0) + 2.5
    })
    return boost
  }, [s.daily, s.myList, s.watched, s.votes, s.settings, s.keys, s.byId])
}

export function useTonightPicks(rewatch = false): Title[] {
  const s = useStore()
  const [n] = useTonight()
  const boost = useBoost()
  const who: Who = s.guest || n.who === 'me' ? s.active : 'both'
  return useMemo(
    () => decideFor(s.pool, s.votes, s.settings, { who, turn: who === 'both' ? s.turn : null, boost, fits: (t) => fitsTonight(t, n), rewatch }),
    [s.pool, s.votes, s.settings, who, s.turn, boost, n, rewatch],
  )
}

/** "Decide tú": una sola propuesta para esta noche, con dos de respaldo */
export function DecideSheet({ onClose }: { onClose: () => void }) {
  /** State */
  const [rewatch, setRewatch] = useState(false)
  const [idx, setIdx] = useState(0)
  /** Hooks */
  const s = useStore()
  const choose = useChooseTonight()
  const picks = useTonightPicks(rewatch)
  /** Handlers */
  const toggleRewatch = () => {
    setRewatch((r) => !r)
    setIdx(0)
  }

  const pick = picks[idx % Math.max(picks.length, 1)]
  const backups = picks.length > 1 ? [1, 2].map((k) => picks[(idx + k) % picks.length]).filter((t, i, all) => t && t !== pick && all.indexOf(t) === i) : []
  const progress = pick && s.settings.progress?.[pick.id]
  const up = pick && progress ? nextUp(pick, progress) : undefined
  const why = pick && (up?.kind === 'episode' ? `Ya la van viendo: les toca el ${episodeLabel(up.ep)}.` : rewatch ? 'Ya la vieron y les encantó.' : s.daily?.reasons[pick.id])

  return (
    <div className="overlay decide" role="dialog" aria-modal="true" aria-label="Decide tú">
      <button className="btn icon close" aria-label="Cerrar" onClick={onClose}>{Icon.x(20)}</button>
      <span className="eyebrow" style={{ color: 'var(--coral)' }}>{rewatch ? 'Algo conocido' : 'Para esta noche'}</span>
      {pick ? (
        <>
          <div className="decide-card" style={{ background: pick.color }}>
            {(pick.backdrop || pick.poster) && <img src={pick.backdrop ?? pick.poster} alt="" />}
            <div className="shade" />
            <div className="body">
              <span className="badge" style={{ alignSelf: 'flex-start' }}>{scoreLabel(pick)}</span>
              <h2>{pick.title}</h2>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{metaLine(pick)} · {pick.genres.slice(0, 2).join(', ')}</span>
              {why && <span style={{ fontSize: 14, lineHeight: 1.4 }}>{why}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 420 }}>
            <button className="btn" style={{ flex: 1, height: 52 }} onClick={() => setIdx((i) => i + 1)} disabled={picks.length < 2}>Otra</button>
            <button className="btn primary" style={{ flex: 2, height: 52 }} onClick={() => choose(pick.id)}>{Icon.check(18)}Esta</button>
          </div>
          {backups.length > 0 && (
            <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="sub" style={{ margin: 0, textAlign: 'left' }}>Si no, una de estas:</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {backups.map((t) => (
                  <button key={t.id} className="backup" onClick={() => setIdx(picks.indexOf(t))} aria-label={`Proponer ${t.title}`}>
                    <div style={{ width: 56, flexShrink: 0 }}><Poster t={t} /></div>
                    <span>{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty" style={{ margin: 0 }}>
          {rewatch ? 'Todavía no hay nada que hayan visto y les haya encantado. Marquen "Me gustó" en lo que ya vieron.' : 'Nada encaja con el tiempo o la compañía de hoy. Prueben "Sin apuro" o bajen la nota mínima.'}
        </div>
      )}
      <button className={`chip${rewatch ? ' on' : ''}`} aria-pressed={rewatch} onClick={toggleRewatch}>Algo que ya vimos y nos encantó</button>
    </div>
  )
}

/** "Final de tres": cada uno descarta una por turno; la que queda es la de la noche */
export function FinalDeTres({ options, onClose }: { options: Title[]; onClose: () => void }) {
  /** State */
  const [left, setLeft] = useState(options.slice(0, 3))
  /** Hooks */
  const s = useStore()
  const choose = useChooseTonight()
  // A quien le toca (porque cedió la última vez) descarta al final, que es cuando se decide
  const second = s.turn ?? 'b'
  const first = second === 'a' ? 'b' : 'a'
  const removing = left.length === 3 ? first : second
  const winner = left.length === 1 ? left[0] : undefined

  return (
    <div className="overlay decide" role="dialog" aria-modal="true" aria-label="Final de tres">
      <button className="btn icon close" aria-label="Cerrar" onClick={onClose}>{Icon.x(20)}</button>
      <span className="eyebrow" style={{ color: 'var(--coral)' }}>Final de tres</span>
      <span style={{ fontFamily: 'var(--display)', fontSize: 30, fontWeight: 800, lineHeight: 1.05 }}>
        {winner ? `Esta noche: ${winner.title}` : `${s.people[removing].name}, quita una`}
      </span>
      {!winner && left.length === 2 && <span className="sub" style={{ margin: 0 }}>Pásale el teléfono a {s.people[removing].name}.</span>}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 420, justifyContent: 'center' }}>
        {left.map((t) => (
          <div key={t.id} style={{ flex: 1, maxWidth: winner ? 180 : 130, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <Poster t={t} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</span>
            {!winner && (
              <button className="btn" style={{ height: 40, width: '100%' }} aria-label={`Quitar ${t.title}`} onClick={() => setLeft((l) => l.filter((x) => x !== t))}>
                {Icon.x(16)}Quitar
              </button>
            )}
          </div>
        ))}
      </div>
      {winner && <button className="btn primary block" style={{ maxWidth: 360, height: 52 }} onClick={() => choose(winner.id)}>Verla esta noche</button>}
    </div>
  )
}
