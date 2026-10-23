import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Title } from '../data/types'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icon = {
  play: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4" fill="currentColor" /></svg>),
  plus: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>),
  check: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><polyline points="20 6 9 17 4 12" /></svg>),
  x: (s = 24) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={2.4}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>),
  heart: (s = 20, fill = 'currentColor') => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><path fill={fill} d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>),
  heartLine: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>),
  back: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><polyline points="15 18 9 12 15 6" /></svg>),
  ban: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><circle cx="12" cy="12" r="9" /><line x1="6" y1="18" x2="18" y2="6" /></svg>),
  search: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>),
  star: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>),
  today: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><rect x="3" y="4" width="18" height="16" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /></svg>),
  compass: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><circle cx="12" cy="12" r="9" /><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5" /></svg>),
  bookmark: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M6 3h12v18l-6-4-6 4z" /></svg>),
  user: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>),
}

export const scoreLabel = (t: Title) => (t.ratings.imdb ? `IMDb ${t.ratings.imdb.toFixed(1)}` : 'Sin nota')

export function metaLine(t: Title): string {
  if (t.kind === 'tv') return `Serie${t.seasons ? ` · ${t.seasons} temp.` : ''}${t.providers[0] ? ` · ${t.providers[0].name}` : ''}`
  const h = t.runtime ? `${Math.floor(t.runtime / 60)} h ${String(t.runtime % 60).padStart(2, '0')}` : ''
  return `Película${h ? ` · ${h}` : ''}`
}

export function Poster({ t, match = false, size }: { t: Title; match?: boolean; size?: string }) {
  return (
    <div className="poster" style={{ background: t.color, width: size }}>
      {t.poster && <img src={t.poster} alt="" loading="lazy" />}
      <span className="badge pscore">{scoreLabel(t)}</span>
      {match && <span className="pmatch" aria-label="Coinciden">{Icon.heart(13, 'var(--coral-ink)')}</span>}
      {!t.poster && <span className="ptitle">{t.title}</span>}
    </div>
  )
}

export function PosterCard({ t, match, label }: { t: Title; match?: boolean; label?: string }) {
  return (
    <Link to={`/titulo/${t.id}`} className="card-item" aria-label={label ? `${t.title}, ${label}` : t.title}>
      <Poster t={t} match={match} />
      {label && <span className="meta" style={{ color: 'var(--gold)', fontWeight: 700 }}>{label}</span>}
      <span className="meta">{t.poster ? t.title : metaLine(t)}</span>
    </Link>
  )
}

export function Rail({ items, matchIds = [], labels = {} }: { items: Title[]; matchIds?: string[]; labels?: Record<string, string> }) {
  return (
    <div className="rail">
      {items.map((t) => (
        <PosterCard key={t.id} t={t} match={matchIds.includes(t.id)} label={labels[t.id]} />
      ))}
    </div>
  )
}

export function Section({ title, sub, action, children }: { title: ReactNode; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="row-head">
        <div>
          <h2 className="h2">{title}</h2>
          {sub && <p className="sub" style={{ margin: 0 }}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function TabBar() {
  const tabs = [
    { to: '/', label: 'Hoy', icon: Icon.today() },
    { to: '/pareja', label: 'Pareja', icon: Icon.heartLine() },
    { to: '/explorar', label: 'Explorar', icon: Icon.compass() },
    { to: '/lista', label: 'Mi lista', icon: Icon.bookmark() },
    { to: '/perfil', label: 'Perfil', icon: Icon.user() },
  ]
  return (
    <div className="tabbar">
      <nav aria-label="Secciones">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
