import { useSeriesProgress } from '../lib/actions'
import { airDateLabel, episodeLabel, nextUp } from '../lib/series'
import { Icon } from './ui'
import type { Title } from '../data/types'

/** En la ficha de una serie: por dónde van, "vimos el siguiente" y marcar temporadas enteras */
export function SeriesTracker({ t }: { t: Title }) {
  /** Hooks */
  const progress = useSeriesProgress()
  const p = progress.of(t.id)
  const up = nextUp(t, p)
  const seasons = t.episodes?.length ?? 0

  const status = !p
    ? 'Todavía no la empiezan.'
    : up.kind === 'finished'
      ? 'La terminaron.'
      : `Van en ${episodeLabel(p)}.`

  return (
    <section className="pad" style={{ marginTop: 28 }} aria-label="Su avance">
      <h2 className="h2" style={{ fontSize: 20, marginBottom: 6 }}>Su avance</h2>
      <p className="sub" style={{ margin: 0 }}>
        {status}
        {up.kind === 'waiting' && ` Están al día: el próximo episodio sale el ${airDateLabel(up.date)}.`}
      </p>

      {up.kind === 'episode' && (
        <button className="btn gold block" style={{ marginTop: 12, height: 52 }} onClick={() => progress.watchNext(t.id)}>
          {Icon.check(18)}Vimos el {episodeLabel(up.ep)}
        </button>
      )}

      {seasons > 1 && (
        <>
          <p className="sub" style={{ margin: '14px 0 0' }}>¿Ya vieron temporadas enteras? Toca hasta dónde llegaron.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {Array.from({ length: seasons }, (_, i) => i + 1).map((n) => {
              const done = Boolean(p) && (p!.s > n || (p!.s === n && p!.e >= (t.episodes?.[n - 1] ?? Infinity)))
              return (
                <button key={n} className={`chip${done ? ' on' : ''}`} aria-pressed={done} onClick={() => progress.markSeason(t.id, n)}>
                  {done ? '✓ ' : ''}Temporada {n}
                </button>
              )
            })}
          </div>
        </>
      )}

      {p && (
        <button className="link" style={{ marginTop: 12, fontSize: 13 }} onClick={() => progress.reset(t.id)}>Empezar de cero</button>
      )}
    </section>
  )
}
