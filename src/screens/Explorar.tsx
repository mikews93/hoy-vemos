import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { browseAll, buildExplore, moodSearch } from '../lib/recommender'
import { Icon, Rail, PosterCard } from '../components/ui'

const MOODS = ['Algo ligero', 'Para pensar', 'Menos de 100 min', 'Para llorar', 'Suspenso', 'Familia']
const TAG_COLORS = ['var(--gold)', 'var(--coral)', '#9FB7FF']

export default function Explorar() {
  const s = useStore()
  const [q, setQ] = useState('')
  const exclude = s.daily?.together ?? []
  const sections = useMemo(() => buildExplore(s.catalog, s.votes, s.settings, exclude), [s.catalog, s.votes, s.settings, exclude])
  const results = useMemo(() => moodSearch(s.catalog, q, s.settings, [s.votes.a, s.votes.b]), [s.catalog, q, s.settings, s.votes])
  const everything = useMemo(
    () => browseAll(s.catalog, s.votes, s.settings, [...exclude, ...sections.flatMap((sec) => sec.items.map((t) => t.id))]),
    [s.catalog, s.votes, s.settings, exclude, sections],
  )

  // Scroll infinito: al acercarse al final se pide otra página del catálogo
  const sentinel = useRef<HTMLDivElement>(null)
  const [nearEnd, setNearEnd] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setNearEnd(e.isIntersecting), { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [q])
  const { load, loading: loadingMore, done } = s.more
  // Si una página trae pocos títulos que pasen los filtros, el final sigue a la vista y se pide otra
  // (se mide de nuevo porque nearEnd puede venir de antes de que la grilla creciera)
  useEffect(() => {
    const el = sentinel.current
    if (!nearEnd || q || s.loading || loadingMore || done || !el) return
    if (el.getBoundingClientRect().top < window.innerHeight + 800) load()
  }, [nearEnd, q, s.loading, loadingMore, done, load, s.catalog.length])

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

      {!q && (
        <section>
          <div style={{ padding: '26px 20px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="eyebrow" style={{ fontSize: 11, color: 'var(--gold)' }}>Todo el catálogo</span>
            <h2 className="h2">Más para ustedes</h2>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Lo que pasa sus filtros, empezando por lo que más les puede gustar</span>
          </div>
          {everything.length > 0 && (
            <div className="pad grid3">
              {everything.map((t) => <PosterCard key={t.id} t={t} />)}
            </div>
          )}
          <div ref={sentinel} className="more-status" aria-live="polite">
            {loadingMore ? 'Buscando más títulos…' : done ? (everything.length ? 'Eso es todo por hoy.' : 'Nada más con estos filtros por ahora.') : ''}
          </div>
        </section>
      )}
    </div>
  )
}
