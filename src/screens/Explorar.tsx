import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { buildExplore, moodSearch } from '../lib/recommender'
import { Icon, Rail, PosterCard } from '../components/ui'

const MOODS = ['Algo ligero', 'Para pensar', 'Menos de 100 min', 'Para llorar', 'Suspenso', 'Familia']
const TAG_COLORS = ['var(--gold)', 'var(--coral)', '#9FB7FF']

export default function Explorar() {
  const s = useStore()
  const [q, setQ] = useState('')
  const exclude = s.daily?.together ?? []
  const sections = useMemo(() => buildExplore(s.catalog, s.votes, s.settings, exclude), [s.catalog, s.votes, s.settings, exclude])
  const results = useMemo(() => moodSearch(s.catalog, q, s.settings, [s.votes.a, s.votes.b]), [s.catalog, q, s.settings, s.votes])

  return (
    <div className="screen">
      <div className="pad">
        <h1 className="h1">Explorar</h1>
        <p className="sub">Fuera de lo de siempre, pero cerca de sus gustos. Siempre IMDb {s.settings.minImdb.toFixed(1)} o más.</p>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <label className="field" htmlFor="mood">¿Qué tienen ganas de ver?</label>
        <div style={{ position: 'relative', marginTop: 8 }}>
          <span style={{ position: 'absolute', left: 16, top: 16, color: 'var(--muted)' }}>{Icon.search()}</span>
          <input id="mood" className="input" style={{ paddingLeft: 46 }} placeholder="Algo de suspenso y corto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
        {MOODS.map((m) => (
          <button key={m} className={`chip${q === m ? ' on' : ''}`} aria-pressed={q === m} onClick={() => setQ(q === m ? '' : m)}>{m}</button>
        ))}
      </div>

      {q ? (
        results.length ? (
          <div className="pad grid3" style={{ marginTop: 16 }}>
            {results.map((t) => <PosterCard key={t.id} t={t} />)}
          </div>
        ) : (
          <div className="empty">Nada con eso por ahora. Prueben con otras palabras, como "comedia", "familia" o "giros".</div>
        )
      ) : (
        sections.map((sec, i) => (
          <section key={sec.tag}>
            <div style={{ padding: '26px 20px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="eyebrow" style={{ fontSize: 11, color: TAG_COLORS[i % 3] }}>{sec.tag}</span>
              <h2 className="h2">{sec.title}</h2>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{sec.why}</span>
            </div>
            <Rail items={sec.items} />
          </section>
        ))
      )}
    </div>
  )
}
