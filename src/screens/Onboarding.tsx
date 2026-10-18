import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { PLATFORMS } from '../data/demo'
import { Icon } from '../components/ui'

const GOAL = 15

// Cuadrícula para calificar: toca lo que te gustó. Se usa en el onboarding y cuando la pareja califica.
export function RateGrid({ onDone, cta }: { onDone: () => void; cta: string }) {
  const s = useStore()
  const v = s.votes[s.active]
  // Los más conocidos primero (más votos), para que sea fácil reconocerlos
  const items = useMemo(() => [...s.catalog].sort((a, b) => (b.ratings.imdbVotes ?? 0) - (a.ratings.imdbVotes ?? 0)).slice(0, 24), [s.catalog])
  const count = v.liked.length

  return (
    <>
      <div className="pad grid3" style={{ marginTop: 20 }}>
        {items.map((t) => {
          const on = v.liked.includes(t.id)
          return (
            <button key={t.id} className={`pick${on ? ' on' : ''}`} style={{ background: t.color }} aria-pressed={on} aria-label={t.title}
              onClick={() => { if (on) s.clearVote(t.id); else { s.vote(t.id, 'seen'); s.vote(t.id, 'liked') } }}>
              {t.poster && <img src={t.poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              <span className="dot">{Icon.heart(14, on ? 'var(--coral-ink)' : '#6B6470')}</span>
              {!t.poster && <span style={{ position: 'absolute', left: 8, right: 8, bottom: 8, fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14, lineHeight: 1.05 }}>{t.title}</span>}
            </button>
          )
        })}
      </div>
      <div className="pad" style={{ position: 'sticky', bottom: 0, padding: '16px 20px calc(20px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 70%, rgba(15,14,19,0))', marginTop: 8 }}>
        <button className="btn gold block" style={{ height: 54, fontSize: 16 }} onClick={onDone} disabled={count < 3}>
          {count < 3 ? `Elige al menos 3 (${count})` : `${cta} · ${count} de ${GOAL}`}
        </button>
      </div>
    </>
  )
}

export default function Onboarding() {
  const s = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [a, setA] = useState(s.people.a.name)
  const [b, setB] = useState(s.people.b.name === 'Pareja' ? '' : s.people.b.name)

  const togglePlatform = (p: string) =>
    s.setSettings({ platforms: s.settings.platforms.includes(p) ? s.settings.platforms.filter((x) => x !== p) : [...s.settings.platforms, p] })

  return (
    <div className="screen" style={{ paddingBottom: 0, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="progress" aria-hidden="true">{[1, 2, 3].map((n) => <span key={n} className={n <= step ? 'on' : ''} />)}</div>
        <span className="eyebrow">Paso {step} de 3</span>
      </div>

      {step === 1 && (
        <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
          <h1 className="h1" style={{ fontSize: 34 }}>{s.cloud ? '¿Cómo te llamas?' : '¿Quiénes van a ver?'}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {s.cloud
              ? s.partnerJoined
                ? `Ya estás conectado con ${s.people.b.name}. Ahora cuéntanos tus gustos.`
                : 'Cada uno tiene sus gustos; la app busca lo que les guste a los dos. Al terminar puedes invitar a tu pareja.'
              : 'Cada uno tiene sus gustos; la app busca lo que les guste a los dos.'}
          </p>
          <label className="field">Tu nombre<input className="input" value={a} onChange={(e) => setA(e.target.value)} autoComplete="given-name" /></label>
          {!s.cloud && <label className="field">Nombre de tu pareja<input className="input" value={b} onChange={(e) => setB(e.target.value)} placeholder="Opcional" /></label>}
          <button className="btn gold block" style={{ height: 54, marginTop: 8 }} disabled={!a.trim()}
            onClick={() => {
              if (a.trim() !== s.people.a.name) s.rename('a', a.trim())
              if (!s.cloud) s.rename('b', b.trim() || 'Pareja')
              s.setActive('a')
              setStep(2)
            }}>Continuar</button>
        </div>
      )}

      {step === 2 && (
        <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
          <h1 className="h1" style={{ fontSize: 34 }}>¿Qué plataformas tienen?</h1>
          <p className="sub" style={{ margin: 0 }}>Solo les recomendamos lo que pueden ver. Si no eliges ninguna, mostramos todo.{s.cloud && s.partnerJoined ? ` Esto lo comparten con ${s.people.b.name}.` : ''}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {PLATFORMS.map((p) => (
              <button key={p} className={`chip${s.settings.platforms.includes(p) ? ' on' : ''}`} style={{ height: 44, padding: '0 16px', fontSize: 14 }} aria-pressed={s.settings.platforms.includes(p)} onClick={() => togglePlatform(p)}>{p}</button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            Nota mínima en IMDb: <span style={{ color: 'var(--gold)', fontSize: 20, fontFamily: 'var(--display)', fontWeight: 800 }}>{s.settings.minImdb.toFixed(1)}</span>
            <input type="range" min={6} max={8.5} step={0.1} value={s.settings.minImdb} onChange={(e) => s.setSettings({ minImdb: Number(e.target.value) })} style={{ accentColor: '#F2B544' }} />
          </label>
          <button className="btn gold block" style={{ height: 54, marginTop: 8 }} onClick={() => setStep(3)}>Continuar</button>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <h1 className="h1" style={{ fontSize: 32 }}>{s.people.a.name}, toca las que te gustaron</h1>
            <p className="sub" style={{ margin: 0 }}>Con {GOAL} ya armamos una buena primera lista. Si no la viste, déjala sin tocar.</p>
          </div>
          <RateGrid cta="Ver mi lista de hoy" onDone={() => { s.finishOnboarding(); nav('/') }} />
        </>
      )}
    </div>
  )
}
