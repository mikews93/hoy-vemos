import { useState } from 'react'
import { useStore } from '../lib/store'
import { readHistory, resolveHistory } from '../lib/importHistory'

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; done: number; total: number }
  | { kind: 'done'; imported: number; missed: number }
  | { kind: 'error'; message: string }

/** Subir el historial de IMDb o Letterboxd para que la app conozca los gustos desde el primer día */
export function ImportHistory({ onDone }: { onDone?: () => void }) {
  /** State */
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  /** Hooks */
  const s = useStore()

  /** Handlers */
  const onFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = readHistory(await file.text())
    if (!parsed || !parsed.entries.length) {
      setStatus({ kind: 'error', message: 'Ese archivo no parece un historial de IMDb ni de Letterboxd. Elige el ratings.csv.' })
      return
    }
    try {
      setStatus({ kind: 'working', done: 0, total: Math.min(parsed.entries.length, 600) })
      const { votes, missed } = await resolveHistory(parsed, (done, total) => setStatus({ kind: 'working', done, total }))
      await s.importVotes(votes)
      setStatus({ kind: 'done', imported: votes.length, missed })
      onDone?.()
    } catch {
      setStatus({ kind: 'error', message: 'No pudimos terminar de importar. Revisa la conexión e inténtalo de nuevo; lo que ya entró no se duplica.' })
    }
  }

  /** Conditional rendering */
  if (!s.live) return <p className="sub" style={{ margin: 0 }}>Importar el historial necesita los datos reales de TMDB.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <details className="note" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>¿Cómo saco el archivo?</summary>
        <p style={{ margin: '6px 0' }}>
          <b>IMDb:</b> entra a <a href="https://www.imdb.com/list/ratings" target="_blank" rel="noreferrer">tus calificaciones</a>, abre el menú de los tres puntos y elige "Exportar". Llega un ratings.csv.
        </p>
        <p style={{ margin: '6px 0' }}>
          <b>Letterboxd:</b> en <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noreferrer">Settings → Data</a> toca "Export your data", descomprime el .zip y elige ratings.csv (o watched.csv si no calificas).
        </p>
      </details>
      <label className={`btn block${status.kind === 'working' ? '' : ' gold'}`} style={{ cursor: status.kind === 'working' ? 'default' : 'pointer' }}>
        {status.kind === 'working' ? `Buscando ${status.done} de ${status.total}…` : 'Elegir el archivo .csv'}
        <input type="file" accept=".csv,text/csv" hidden disabled={status.kind === 'working'} onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {status.kind === 'done' && (
        <p className="sub" style={{ margin: 0, color: 'var(--ok)' }} aria-live="polite">
          Listo: {status.imported} títulos aprendidos{status.missed ? ` (${status.missed} no se encontraron en TMDB)` : ''}. Ya no te los vamos a recomendar como nuevos.
        </p>
      )}
      {status.kind === 'error' && <p className="sub" style={{ margin: 0, color: 'var(--coral)' }} role="alert">{status.message}</p>}
    </div>
  )
}
