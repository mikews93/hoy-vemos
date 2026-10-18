import { useState } from 'react'
import { useStore } from '../lib/store'
import { inviteLink } from '../lib/supabase'

// Invitar a la pareja: comparte un enlace con el código del hogar, o escribe el código que te pasaron
export function Invite() {
  const s = useStore()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!s.inviteCode) return null
  const link = inviteLink(s.inviteCode)

  const share = async () => {
    const text = `Te invito a Hoy Vemos para elegir juntos qué ver. Entra aquí: ${link} (código ${s.inviteCode})`
    try {
      if (navigator.share) await navigator.share({ title: 'Hoy Vemos', text })
      else {
        await navigator.clipboard.writeText(text)
        setMsg({ text: 'Copiamos la invitación. Pégala en WhatsApp o donde quieras.', ok: true })
      }
    } catch {
      // compartir cancelado
    }
  }

  const join = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await s.joinHousehold(code)
      setMsg({ text: 'Listo, ya están conectados.', ok: true })
      setCode('')
    } catch (e) {
      setMsg({ text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {s.partnerJoined ? (
        <p className="sub" style={{ margin: 0 }}>Estás conectado con <b>{s.people.b.name}</b>. Ven las mismas listas y sus votos llegan al instante.</p>
      ) : (
        <>
          <p className="sub" style={{ margin: 0 }}>Envíale este enlace a tu pareja. Cuando cree su cuenta quedarán conectados.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge" style={{ fontSize: 18, padding: '10px 14px', letterSpacing: '.18em', fontFamily: 'var(--display)' }}>{s.inviteCode}</span>
            <button className="btn primary" style={{ flex: 1, height: 48 }} onClick={share}>Enviar invitación</button>
          </div>
          <label className="field" style={{ marginTop: 6 }}>
            ¿Tu pareja ya te invitó? Escribe su código
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '.12em' }} value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoCapitalize="characters" />
              <button className="btn" style={{ height: 48 }} disabled={code.trim().length < 6 || busy} onClick={join}>Unirme</button>
            </div>
          </label>
        </>
      )}
      {msg && <p className="sub" role="status" style={{ margin: 0, color: msg.ok ? 'var(--ok)' : 'var(--coral)' }}>{msg.text}</p>}
    </div>
  )
}
