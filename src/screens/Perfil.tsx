import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { PLATFORMS } from '../data/demo'
import { RateGrid } from './Onboarding'
import { Invite } from '../components/Invite'
import { AccountButtons } from '../components/Account'
import { useVetoes } from '../lib/actions'
import { ImportHistory } from '../components/ImportHistory'
import type { PersonId } from '../data/types'

const canNotify = typeof Notification !== 'undefined'

export default function Perfil() {
  const s = useStore()
  const nav = useNavigate()
  const [rating, setRating] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const partner: PersonId = s.active === 'a' ? 'b' : 'a'
  const vetoes = useVetoes()
  const genres = useMemo(() => [...new Set(s.catalog.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b, 'es')), [s.catalog])
  const [notify, setNotify] = useState(canNotify ? Notification.permission : 'denied')

  if (rating)
    return (
      <div className="screen">
        <div className="pad">
          <h1 className="h1" style={{ fontSize: 32 }}>{s.people[s.active].name}, toca las que te gustaron</h1>
          <p className="sub">Así la lista de hoy tiene en cuenta los gustos de los dos.</p>
        </div>
        <RateGrid cta="Listo" onDone={() => { setRating(false); s.refreshDaily(); nav('/') }} />
      </div>
    )

  const mine = vetoes.of(s.active)
  const partnerVetoes = vetoes.of(partner)
  const toggleVeto = (g: string) => vetoes.set(s.active, mine.includes(g) ? mine.filter((x) => x !== g) : [...mine, g])
  const askNotify = () => void Notification.requestPermission().then(setNotify)

  const togglePlatform = (p: string) =>
    s.setSettings({ platforms: s.settings.platforms.includes(p) ? s.settings.platforms.filter((x) => x !== p) : [...s.settings.platforms, p] })

  return (
    <div className="screen">
      <div className="pad">
        <h1 className="h1">Perfil</h1>
        <p className="sub">{s.cloud ? `${s.people.a.name} · ${s.email ?? ''}` : s.guest ? `${s.people.a.name}, estás usando Hoy Vemos sin cuenta.` : `Este dispositivo lo comparten ${s.people.a.name} y ${s.people.b.name}.`}</p>
      </div>

      {s.guest && (
        <>
          <div className="row-head"><h2 className="h2">Tu cuenta</h2></div>
          <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="sub" style={{ margin: 0 }}>Todo se guarda en este teléfono. Con una cuenta puedes invitar a tu pareja, elegir juntos y compartir Mi lista; lo que ya marcaste pasa a la cuenta.</p>
            <AccountButtons reason="Crea tu cuenta para invitar a tu pareja." />
          </div>
        </>
      )}

      {s.cloud && (
        <>
          <div className="row-head"><h2 className="h2">{s.partnerJoined ? 'Tu pareja' : 'Invita a tu pareja'}</h2></div>
          <Invite />
        </>
      )}

      {s.cloud || s.guest ? (
        <div className="pad" style={{ marginTop: 14 }}>
          <button className="btn block" onClick={() => setRating(true)}>Calificar más favoritas</button>
        </div>
      ) : (
        <>
          <div className="row-head"><h2 className="h2">¿Quién está usando la app?</h2></div>
          <div className="pad" style={{ display: 'flex', gap: 10 }}>
            {(['a', 'b'] as PersonId[]).map((p) => (
              <button key={p} className={`chip${s.active === p ? (p === 'a' ? ' on' : ' coral on') : ''}`} style={{ height: 44, padding: '0 18px', fontSize: 14 }} aria-pressed={s.active === p} onClick={() => s.setActive(p)}>
                {s.people[p].name}
              </button>
            ))}
          </div>
          <div className="pad" style={{ marginTop: 14 }}>
            <button className="btn block" onClick={() => { s.setActive(partner); setRating(true) }}>Que {s.people[partner].name} califique sus favoritas</button>
          </div>
        </>
      )}

      <div className="row-head"><h2 className="h2">{s.cloud || s.guest ? 'Traer tu historial' : `Traer el historial de ${s.people[s.active].name}`}</h2></div>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="sub" style={{ margin: 0 }}>Sube lo que calificaste en IMDb o Letterboxd y la app aprende tus gustos de una vez.</p>
        <ImportHistory />
      </div>

      <div className="row-head"><h2 className="h2">Plataformas{s.cloud && s.partnerJoined ? ' (de los dos)' : ''}</h2></div>
      <div className="pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {PLATFORMS.map((p) => (
          <button key={p} className={`chip${s.settings.platforms.includes(p) ? ' on' : ''}`} aria-pressed={s.settings.platforms.includes(p)} onClick={() => togglePlatform(p)}>{p}</button>
        ))}
      </div>

      <div className="row-head"><h2 className="h2">Nota mínima</h2></div>
      <label className="field pad">
        IMDb {s.settings.minImdb.toFixed(1)} o más
        <input type="range" min={6} max={8.5} step={0.1} value={s.settings.minImdb} onChange={(e) => s.setSettings({ minImdb: Number(e.target.value) })} style={{ accentColor: '#F2B544' }} />
      </label>

      <div className="row-head"><h2 className="h2">{s.cloud || s.guest ? 'Lo que nunca quiero ver' : `Lo que ${s.people[s.active].name} nunca quiere ver`}</h2></div>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="sub" style={{ margin: 0 }}>
          Lo que marques no sale en la lista de hoy, en Pareja ni en Explorar.
          {!s.guest && partnerVetoes.length > 0 && ` ${s.people[partner].name} vetó: ${partnerVetoes.join(', ')}.`}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {genres.map((g) => (
            <button key={g} className={`chip${mine.includes(g) ? ' coral on' : ''}`} aria-pressed={mine.includes(g)} onClick={() => toggleVeto(g)}>
              {mine.includes(g) ? `Sin ${g.toLowerCase()}` : g}
            </button>
          ))}
        </div>
      </div>

      {canNotify && s.live && (
        <>
          <div className="row-head"><h2 className="h2">Avisos</h2></div>
          <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="sub" style={{ margin: 0 }}>Te avisamos en este teléfono cuando algo de Mi lista llega a sus plataformas. El aviso sale al abrir la app.</p>
            {notify === 'granted' ? (
              <span className="sub" style={{ margin: 0, color: 'var(--ok)' }}>Avisos activados en este teléfono.</span>
            ) : notify === 'denied' ? (
              <span className="sub" style={{ margin: 0 }}>Los avisos están bloqueados en el navegador.</span>
            ) : (
              <button className="btn" onClick={askNotify}>Activar avisos</button>
            )}
          </div>
        </>
      )}

      <div className="row-head"><h2 className="h2">Lista de hoy</h2></div>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="sub" style={{ margin: 0 }}>Se arma sola cada día al abrir la app. Si cambiaste filtros o gustos, puedes rehacerla ahora.</p>
        <button className="btn" onClick={() => { s.refreshDaily(); nav('/') }}>Rehacer la lista de hoy</button>
      </div>

      <div className="row-head"><h2 className="h2">Datos</h2></div>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="sub" style={{ margin: 0 }}>{s.live ? 'Usando datos reales de TMDB.' : 'Modo demostración con catálogo de ejemplo.'}</p>
        <p className="note" style={{ margin: 0 }}>Esta app usa la API de TMDB, pero no está respaldada ni certificada por TMDB. Notas de IMDb, Rotten Tomatoes y Metacritic vía OMDb; disponibilidad de JustWatch vía TMDB.</p>
        {confirmReset ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: 1, borderColor: 'var(--coral)', color: 'var(--coral)' }} onClick={() => { s.reset(); nav('/') }}>Sí, borrar todo</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>Cancelar</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>{s.cloud ? 'Borrar mis calificaciones' : 'Empezar de cero'}</button>
        )}
        {s.cloud && <button className="btn" onClick={s.signOut}>Cerrar sesión</button>}
      </div>
    </div>
  )
}
