import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTonightPicks } from '../components/Tonight'
import { Icon, Poster, metaLine, scoreLabel } from '../components/ui'
import type { Title } from '../data/types'

// Noche con invitados: de 3 a 6 personas votan sí o no en el mismo teléfono, pasándoselo, sobre las mismas
// propuestas. Gana la que más "sí" tiene; si empatan, la que tiene menos "no" y luego la de mejor nota.
// No necesita cuentas: los votos de los invitados no se guardan ni cambian los gustos de la pareja.

const MAX_PEOPLE = 6
const ROUND = 8

type Step = { kind: 'names' } | { kind: 'handoff'; person: number } | { kind: 'vote'; person: number; card: number } | { kind: 'result' }

export default function Invitados() {
  /** Hooks */
  const s = useStore()
  const nav = useNavigate()
  const picks = useTonightPicks()
  /** State */
  const [names, setNames] = useState<string[]>(() => (s.guest ? [s.people.a.name, '', ''] : [s.people.a.name, s.people.b.name, '']))
  const [step, setStep] = useState<Step>({ kind: 'names' })
  const [options, setOptions] = useState<Title[]>([])
  const [yes, setYes] = useState<Record<string, number>>({})
  const [no, setNo] = useState<Record<string, number>>({})

  const people = names.map((n) => n.trim()).filter(Boolean)

  /** Handlers */
  const start = () => {
    setOptions(picks.slice(0, ROUND))
    setYes({})
    setNo({})
    setStep({ kind: 'handoff', person: 0 })
  }
  const vote = (liked: boolean) => {
    if (step.kind !== 'vote') return
    const id = options[step.card].id
    ;(liked ? setYes : setNo)((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }))
    if (step.card + 1 < options.length) setStep({ ...step, card: step.card + 1 })
    else if (step.person + 1 < people.length) setStep({ kind: 'handoff', person: step.person + 1 })
    else setStep({ kind: 'result' })
  }

  // La noche con invitados no cuenta para los turnos de la pareja: solo se guarda en Mi lista
  const watchNow = (id: string) => {
    if (!s.myList.includes(id)) s.toggleList(id)
    nav(`/titulo/${id}`)
  }

  const ranking = [...options].sort((a, b) => (yes[b.id] ?? 0) - (yes[a.id] ?? 0) || (no[a.id] ?? 0) - (no[b.id] ?? 0) || (b.ratings.imdb ?? 0) - (a.ratings.imdb ?? 0))

  /** Conditional rendering */
  if (step.kind === 'handoff')
    return (
      <div className="overlay" style={{ position: 'static', minHeight: '100dvh' }}>
        <span className="eyebrow" style={{ color: 'var(--coral)' }}>Persona {step.person + 1} de {people.length}</span>
        <span style={{ fontFamily: 'var(--display)', fontSize: 38, fontWeight: 800, lineHeight: 1.05 }}>Pásale el teléfono a {people[step.person]}</span>
        <span className="sub">Que nadie mire: son {options.length} propuestas, sí o no.</span>
        <button className="btn primary block" style={{ maxWidth: 360, height: 52 }} onClick={() => setStep({ kind: 'vote', person: step.person, card: 0 })}>Soy {people[step.person]}, empezar</button>
      </div>
    )

  if (step.kind === 'vote') {
    const t = options[step.card]
    return (
      <div className="screen">
        <div className="pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 className="h2" style={{ fontSize: 24 }}>Vota {people[step.person]}</h1>
          <span className="sub" style={{ margin: 0 }}>{step.card + 1} de {options.length}</span>
        </div>
        <div className="pad" style={{ marginTop: 16, display: 'flex', gap: 16 }}>
          <div style={{ width: 140, flexShrink: 0 }}><Poster t={t} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800, lineHeight: 1.05 }}>{t.title}</h2>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{scoreLabel(t)} · {metaLine(t)}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.genres.slice(0, 3).join(', ')}</span>
          </div>
        </div>
        <p className="pad" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.overview}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '12px 0' }}>
          <button className="btn" onClick={() => vote(false)} aria-label="No" style={{ width: 72, height: 72, borderRadius: 36, padding: 0 }}>{Icon.x()}</button>
          <button className="btn" onClick={() => vote(true)} aria-label="Sí" style={{ width: 72, height: 72, borderRadius: 36, padding: 0, background: 'var(--coral)', borderColor: 'var(--coral)', color: 'var(--coral-ink)' }}>{Icon.heart(30, 'var(--coral-ink)')}</button>
        </div>
      </div>
    )
  }

  if (step.kind === 'result') {
    const [winner, ...others] = ranking
    return (
      <div className="screen">
        <div className="pad">
          <span className="eyebrow" style={{ color: 'var(--coral)' }}>Ganó</span>
          <h1 className="h1" style={{ fontSize: 36 }}>{winner.title}</h1>
          <p className="sub">{yes[winner.id] ?? 0} de {people.length} dijeron que sí.</p>
        </div>
        <div className="pad" style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ width: 150 }}><Poster t={winner} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={() => watchNow(winner.id)}>Verla ahora</button>
            <button className="btn" onClick={start}>Otra ronda</button>
          </div>
        </div>
        <div className="row-head"><h2 className="h2">Cómo quedó</h2></div>
        <div className="panel" style={{ margin: '0 20px' }}>
          {others.map((t) => (
            <div className="list-row" key={t.id}>
              <span style={{ flex: 1, fontWeight: 600 }}>{t.title}</span>
              <span className="sub" style={{ margin: 0 }}>{yes[t.id] ?? 0} sí · {no[t.id] ?? 0} no</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="pad">
        <button className="btn icon" aria-label="Volver" onClick={() => nav(-1)} style={{ borderRadius: 22, width: 44, height: 44 }}>{Icon.back()}</button>
        <h1 className="h1" style={{ marginTop: 16 }}>Noche con invitados</h1>
        <p className="sub">Cada uno vota sí o no a las mismas {ROUND} propuestas, pasándose el teléfono. Gana la que más gente quiere ver.</p>
      </div>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {names.map((n, i) => (
          <input key={i} className="input" aria-label={`Persona ${i + 1}`} placeholder={`Persona ${i + 1}`} value={n} onChange={(e) => setNames((all) => all.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        {names.length < MAX_PEOPLE && <button className="btn" onClick={() => setNames((all) => [...all, ''])}>{Icon.plus(18)}Agregar persona</button>}
      </div>
      <div className="pad" style={{ marginTop: 18 }}>
        {picks.length < 3 ? (
          <div className="empty" style={{ margin: 0 }}>No hay suficientes propuestas con los filtros de hoy. Cambien el tiempo o la compañía en <Link to="/">Hoy</Link>.</div>
        ) : (
          <button className="btn gold block" style={{ height: 54 }} disabled={people.length < 3} onClick={start}>
            {people.length < 3 ? 'Hacen falta al menos 3 personas' : `Empezar con ${people.length} personas`}
          </button>
        )}
      </div>
    </div>
  )
}
