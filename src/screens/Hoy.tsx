import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { forPerson } from '../lib/recommender'
import { fitsTonight, useTonight } from '../lib/tonight'
import { notifyArrivals, trackArrivals } from '../lib/arrivals'
import { DecideSheet, TonightBar } from '../components/Tonight'
import { Icon, Rail, Section, metaLine, scoreLabel } from '../components/ui'
import { TrailerModal } from '../components/Trailer'
import type { Title } from '../data/types'

type Filter = 'all' | 'movie' | 'tv'

const passes = (t: Title, f: Filter) => f === 'all' || t.kind === f

export default function Hoy() {
  const s = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [trailer, setTrailer] = useState<Title | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [tonight] = useTonight()
  const me = s.people[s.active]
  const other = s.active === 'a' ? 'b' : 'a'
  // la lista del día se arma una vez: si después alguien vetó un género, sus títulos se esconden igual
  const allowed = useMemo(() => new Set(s.pool.map((t) => t.id)), [s.pool])
  const fits = (t: Title) => allowed.has(t.id) && passes(t, filter) && fitsTonight(t, tonight)

  const picks = useMemo(() => (s.daily?.together ?? []).map((id) => s.byId.get(id)).filter(Boolean) as Title[], [s.daily, s.byId])
  const visible = picks.filter((t) => fits(t) && !s.votes.a.seen.includes(t.id) && !s.votes.b.seen.includes(t.id))
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
    () => forPerson(s.pool, s.votes[s.active], s.votes[other], s.settings, picks.map((p) => p.id), 30).filter((t) => passes(t, filter) && fitsTonight(t, tonight)).slice(0, 8),
    [s.pool, s.votes, s.active, other, s.settings, picks, filter, tonight],
  )

  // Lo que llegó en los últimos días a sus plataformas (comparando con lo que este teléfono vio antes)
  const [arrivals, setArrivals] = useState<Title[]>([])
  useEffect(() => {
    if (s.loading || !s.live) return
    const found = trackArrivals(s.catalog, s.settings.platforms)
    notifyArrivals(found, s.byId, s.myList)
    setArrivals(found.map((a) => s.byId.get(a.id)).filter((t): t is Title => Boolean(t) && (t!.ratings.imdb ?? 0) >= s.settings.minImdb))
  }, [s.loading, s.live, s.catalog, s.settings.platforms, s.settings.minImdb, s.byId, s.myList])

  const rawDate = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateLabel = rawDate[0].toUpperCase() + rawDate.slice(1)
  const seenCount = new Set([...s.votes[s.active].seen, ...s.votes[s.active].liked]).size

  if (s.loading) return <div className="empty" style={{ marginTop: 80 }}>Trayendo lo mejor de hoy…</div>

  return (
    <div className="screen">
      {trailer?.trailer && <TrailerModal url={trailer.trailer} title={trailer.title} onClose={() => setTrailer(null)} />}
      <div className="pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{dateLabel}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Hola, {me.name}</div>
        </div>
        <Link to="/perfil" aria-label="Cambiar persona" style={{ display: 'flex', textDecoration: 'none' }}>
          <span className="avatar a">{s.people.a.name[0]}</span>
          {!s.guest && <span className="avatar b" style={{ marginLeft: -10 }}>{s.people.b.name[0]}</span>}
        </Link>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <h1 className="h1">Hoy para<br />ustedes</h1>
        <p className="sub">
          {picks.length} títulos elegidos para hoy, todos con IMDb {s.settings.minImdb.toFixed(1)} o más
          {s.settings.platforms.length ? ' y en sus plataformas.' : '.'}
        </p>
      </div>

      <div className="pad" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn gold block" style={{ height: 56, fontSize: 17 }} onClick={() => setDeciding(true)}>{Icon.star(20)}Decide tú por nosotros</button>
        {s.turn && !s.guest && <span className="note" style={{ fontSize: 12, color: 'var(--text-2)' }}>Hoy pesan más los gustos de {s.people[s.turn].name}: la última vez cedió.</span>}
      </div>
      <TonightBar />

      {s.guest && (
        <div className="banner">Esta lista es solo con tus gustos. <Link to="/pareja">Elige con tu pareja</Link> creando una cuenta.</div>
      )}
      {s.cloud && !s.partnerJoined && (
        <div className="banner">Esta lista es solo con tus gustos. <Link to="/perfil">Invita a tu pareja</Link> para que se arme con los de los dos.</div>
      )}
      {!s.live && <div className="banner">Modo demostración: catálogo de ejemplo con notas aproximadas. Con las claves de TMDB y OMDb se usan datos reales.</div>}

      <div className="chips" role="group" aria-label="Filtrar">
        <span className="chip on" style={{ display: 'inline-flex', alignItems: 'center' }}>IMDb {s.settings.minImdb.toFixed(1)}+</span>
        {([['all', 'Todo'], ['movie', 'Películas'], ['tv', 'Series']] as [Filter, string][]).map(([k, label]) => (
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
                <button className="btn primary" style={{ flex: 1 }} onClick={() => setTrailer(hero)}>{Icon.play()}Ver tráiler</button>
              ) : (
                <Link className="btn primary" style={{ flex: 1 }} to={`/titulo/${hero.id}`}>Ver ficha</Link>
              )}
              <button className="btn icon" aria-label={s.myList.includes(hero.id) ? 'Quitar de mi lista' : 'Agregar a mi lista'} aria-pressed={s.myList.includes(hero.id)} onClick={() => s.toggleList(hero.id)}>
                {s.myList.includes(hero.id) ? Icon.check() : Icon.plus()}
              </button>
              <button className="btn icon" aria-label="Ya la vimos" onClick={() => s.markWatched(hero.id, true)}>{Icon.check()}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">
          {s.catalog.length ? 'No quedan títulos de hoy con este filtro. Prueben otro filtro, "Decide tú" o pasen por Explorar.' : 'No hay catálogo disponible.'}
        </div>
      )}

      {rest.length > 0 && (
        <Section title="Más para hoy">
          <Rail items={rest} matchIds={matches.map((m) => m.id)} />
        </Section>
      )}

      {arrivals.length > 0 && (
        <Section title="Recién llegó a sus plataformas" sub="En los últimos 7 días">
          <Rail items={arrivals} matchIds={matches.map((m) => m.id)} />
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

      <div className="pad" style={{ marginTop: 26 }}>
        <Link to="/invitados" className="btn block">Noche con invitados: que voten todos</Link>
      </div>

      {deciding && <DecideSheet onClose={() => setDeciding(false)} />}
    </div>
  )
}
