import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { forPerson } from '../lib/recommender'
import { Icon, Rail, Section, metaLine, scoreLabel } from '../components/ui'
import type { Title } from '../data/types'

type Filter = 'all' | 'movie' | 'tv' | 'short'

const passes = (t: Title, f: Filter) =>
  f === 'all' || (f === 'short' ? t.kind === 'movie' && (t.runtime ?? 999) <= 120 : t.kind === f)

export default function Hoy() {
  const s = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const me = s.people[s.active]
  const other = s.active === 'a' ? 'b' : 'a'

  const picks = useMemo(() => (s.daily?.together ?? []).map((id) => s.byId.get(id)).filter(Boolean) as Title[], [s.daily, s.byId])
  const visible = picks.filter((t) => passes(t, filter) && !s.votes.a.seen.includes(t.id) && !s.votes.b.seen.includes(t.id))
  const [hero, ...rest] = visible

  const matches = useMemo(
    () =>
      s.votes.a.liked
        .filter((id) => s.votes.b.liked.includes(id) && !s.votes.a.seen.includes(id) && !s.votes.b.seen.includes(id))
        .map((id) => s.byId.get(id))
        .filter(Boolean) as Title[],
    [s.votes, s.byId],
  )
  const mine = useMemo(
    () => forPerson(s.catalog, s.votes[s.active], s.votes[other], s.settings, picks.map((p) => p.id)).filter((t) => passes(t, filter)),
    [s.catalog, s.votes, s.active, other, s.settings, picks, filter],
  )

  const rawDate = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateLabel = rawDate[0].toUpperCase() + rawDate.slice(1)
  const seenCount = new Set([...s.votes[s.active].seen, ...s.votes[s.active].liked]).size

  if (s.loading) return <div className="empty" style={{ marginTop: 80 }}>Trayendo lo mejor de hoy…</div>

  return (
    <div className="screen">
      <div className="pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{dateLabel}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Hola, {me.name}</div>
        </div>
        <Link to="/perfil" aria-label="Cambiar persona" style={{ display: 'flex', textDecoration: 'none' }}>
          <span className="avatar a">{s.people.a.name[0]}</span>
          <span className="avatar b" style={{ marginLeft: -10 }}>{s.people.b.name[0]}</span>
        </Link>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <h1 className="h1">Hoy para<br />ustedes</h1>
        <p className="sub">
          {picks.length} títulos elegidos para hoy, todos con IMDb {s.settings.minImdb.toFixed(1)} o más
          {s.settings.platforms.length ? ' y en sus plataformas.' : '.'}
        </p>
      </div>

      {!s.live && <div className="banner">Modo demostración: catálogo de ejemplo con notas aproximadas. Con las claves de TMDB y OMDb se usan datos reales.</div>}

      <div className="chips" role="group" aria-label="Filtrar">
        <span className="chip on" style={{ display: 'inline-flex', alignItems: 'center' }}>IMDb {s.settings.minImdb.toFixed(1)}+</span>
        {([['all', 'Todo'], ['movie', 'Películas'], ['tv', 'Series'], ['short', 'Menos de 2 h']] as [Filter, string][]).map(([k, label]) => (
          <button key={k} className={`chip${filter === k ? ' coral on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {hero ? (
        <div className="hero" style={{ background: hero.color, marginTop: 12 }}>
          {hero.backdrop || hero.poster ? <img src={hero.backdrop ?? hero.poster} alt="" /> : null}
          <div className="shade" />
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
            <span className="badge" style={{ fontSize: 13, padding: '6px 10px' }}>{scoreLabel(hero)}</span>
            {hero.providers[0] && <span className="badge dark" style={{ fontSize: 13, padding: '6px 10px' }}>{hero.providers[0].name}</span>}
          </div>
          <div className="body">
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral)', letterSpacing: '.1em', textTransform: 'uppercase' }}>La elección de hoy</span>
            <Link to={`/titulo/${hero.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{hero.title}</h2>
            </Link>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{metaLine(hero)} · {hero.genres.slice(0, 2).join(', ')}</span>
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>{s.daily?.reasons[hero.id]}</span>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {hero.trailer ? (
                <a className="btn primary" style={{ flex: 1 }} href={hero.trailer} target="_blank" rel="noreferrer">{Icon.play()}Ver tráiler</a>
              ) : (
                <Link className="btn primary" style={{ flex: 1 }} to={`/titulo/${hero.id}`}>Ver ficha</Link>
              )}
              <button className="btn icon" aria-label={s.myList.includes(hero.id) ? 'Quitar de mi lista' : 'Agregar a mi lista'} aria-pressed={s.myList.includes(hero.id)} onClick={() => s.toggleList(hero.id)}>
                {s.myList.includes(hero.id) ? Icon.check() : Icon.plus()}
              </button>
              <button className="btn icon" aria-label="Ya la vimos" onClick={() => { s.vote(hero.id, 'seen', 'a'); s.vote(hero.id, 'seen', 'b') }}>{Icon.check()}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">
          {s.catalog.length ? 'No quedan títulos de hoy con este filtro. Prueben otro filtro o pasen por Explorar.' : 'No hay catálogo disponible.'}
        </div>
      )}

      {rest.length > 0 && (
        <Section title="Más para hoy">
          <Rail items={rest} matchIds={matches.map((m) => m.id)} />
        </Section>
      )}

      <Section
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--coral)', display: 'flex' }}>{Icon.heart(20)}</span>Coinciden los dos</span>}
        action={<Link to="/pareja">Elegir juntos</Link>}
      >
        {matches.length ? (
          <Rail items={matches} matchIds={matches.map((m) => m.id)} />
        ) : (
          <div className="empty" style={{ margin: '0 20px' }}>Cuando los dos le den "me gusta" a lo mismo en Pareja, aparece aquí.</div>
        )}
      </Section>

      {mine.length > 0 && (
        <Section title={`Para ti, ${me.name}`} sub={seenCount ? `Aprendido de las ${seenCount} que has calificado` : 'Califica títulos para afinar esto'}>
          <Rail items={mine} />
        </Section>
      )}
    </div>
  )
}
