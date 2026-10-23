import { useEffect, useState } from 'react'
import { disablePush, enablePush, pushEnabled } from '../lib/push'

type State = 'checking' | 'off' | 'on' | 'working'

/** Activar o apagar los avisos con la app cerrada en este teléfono */
export function PushToggle() {
  /** State */
  const [state, setState] = useState<State>('checking')
  const [error, setError] = useState('')
  /** Effects */
  useEffect(() => {
    void pushEnabled().then((on) => setState(on ? 'on' : 'off'))
  }, [])
  /** Handlers */
  const toggle = async () => {
    const wasOn = state === 'on'
    setState('working')
    setError('')
    try {
      await (wasOn ? disablePush() : enablePush())
      setState(wasOn ? 'off' : 'on')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el aviso')
      setState(wasOn ? 'on' : 'off')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p className="sub" style={{ margin: 0 }}>
        De madrugada revisamos Mi lista y las series que siguen. Si algo llegó a sus plataformas o sale un episodio nuevo, te avisamos aunque la app esté cerrada.
        En iPhone primero hay que agregar la app a la pantalla de inicio.
      </p>
      <button className={`btn${state === 'on' ? '' : ' gold'}`} disabled={state === 'checking' || state === 'working'} onClick={() => void toggle()}>
        {state === 'on' ? 'Apagar avisos en este teléfono' : state === 'working' ? 'Un momento…' : 'Activar avisos en este teléfono'}
      </button>
      {state === 'on' && <span className="sub" style={{ margin: 0, color: 'var(--ok)' }}>Avisos activados en este teléfono.</span>}
      {error && <span className="sub" style={{ margin: 0, color: 'var(--coral)' }} role="alert">{error}</span>}
    </div>
  )
}
