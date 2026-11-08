import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import qrcode from 'qrcode-generator'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/store'

// Entrar en el televisor con el celular (ver api/tv-link.ts): la TV muestra un QR y un código, el celular lo aprueba.

const call = async (body: Record<string, unknown>, token?: string) => {
  const res = await fetch('/api/tv-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

export const tvLinkUrl = (code: string) => `${location.origin}/#/tv/${code}`

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
  }, [text])
  return <div className="tv-qr" aria-label="Código QR para entrar desde el celular" dangerouslySetInnerHTML={{ __html: svg }} />
}

// En el televisor: pide un código, lo muestra y espera a que el celular lo apruebe
export function TvLogin({ onEmail }: { onEmail: () => void }) {
  const [link, setLink] = useState<{ code: string; secret: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let alive = true
    setLink(null)
    setMsg(null)
    call({ op: 'start' }).then(({ ok, data }) => {
      if (!alive) return
      if (ok) setLink({ code: String(data.code), secret: String(data.secret) })
      else setMsg(String(data.error ?? 'No se pudo pedir el código.'))
    }, () => alive && setMsg('Sin conexión. Revisa el internet del televisor.'))
    return () => {
      alive = false
    }
  }, [round])

  useEffect(() => {
    if (!link || !supabase) return
    let alive = true
    const tick = async () => {
      const { ok, data } = await call({ op: 'poll', code: link.code, secret: link.secret }).catch(() => ({ ok: false, data: {} as Record<string, unknown> }))
      if (!alive) return
      if (ok && data.token_hash) {
        const { error } = await supabase!.auth.verifyOtp({ token_hash: String(data.token_hash), type: 'magiclink' })
        if (error && alive) setMsg(error.message)
        return
      }
      // el código dura 10 minutos: luego se pide otro solo
      if (data.expired || (!ok && data.error)) return alive && setRound((r) => r + 1)
      timer = setTimeout(tick, 3000)
    }
    let timer = setTimeout(tick, 3000)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [link])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="tv-link">
        {link ? <Qr text={tvLinkUrl(link.code)} /> : <div className="tv-qr" style={{ background: 'var(--surface)' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Escanea el código con la cámara del celular donde ya usas Hoy Vemos, o abre <b>Perfil → Conectar un televisor</b> y escribe:
          </span>
          <span className="tv-code" aria-live="polite">{link ? link.code : '······'}</span>
          <span className="sub" style={{ margin: 0 }}>{msg ?? 'El televisor entra solo apenas lo apruebes en el celular.'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => setRound((r) => r + 1)}>Pedir otro código</button>
        <button type="button" className="btn" style={{ background: 'transparent' }} onClick={onEmail}>Entrar con correo y contraseña</button>
      </div>
    </div>
  )
}

// En el celular: #/tv/CODIGO (lo abre el QR) o #/tv para escribir el código a mano
export function TvApprove() {
  const params = useParams()
  const nav = useNavigate()
  const { session, askLogin } = useAuth()
  const [code, setCode] = useState((params.code ?? '').toUpperCase())
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<{ text: string; ok?: boolean } | null>(null)

  const approve = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!session) return askLogin({ mode: 'in', reason: 'Entra a tu cuenta para conectar el televisor.' })
    const c = code.trim().toUpperCase()
    if (c.length !== 6) return setState({ text: 'El código tiene 6 letras y números. Míralo en la pantalla del televisor.' })
    setBusy(true)
    const { ok, data } = await call({ op: 'approve', code: c }, session.access_token).catch(() => ({ ok: false, data: { error: 'Sin conexión.' } as Record<string, unknown> }))
    setBusy(false)
    setState(ok ? { text: 'Listo. Mira el televisor: ya está entrando con tu cuenta.', ok: true } : { text: String(data.error ?? 'No se pudo conectar.') })
  }

  return (
    <div className="screen">
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className="eyebrow">Hoy Vemos en la TV</span>
        <h1 className="h1" style={{ fontSize: 34 }}>Conectar un televisor</h1>
        <p className="sub" style={{ margin: 0 }}>
          Abre Hoy Vemos en el televisor y toca Entrar: aparece un código. Al aprobarlo aquí, el televisor entra con tu cuenta{session?.user.email ? ` (${session.user.email})` : ''}.
        </p>
        <form onSubmit={approve} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="field">
            Código del televisor
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              style={{ fontSize: 26, letterSpacing: '.2em', fontWeight: 800, textAlign: 'center', height: 64 }} />
          </label>
          {state && <p className="sub" role="status" style={{ margin: 0, color: state.ok ? 'var(--ok)' : 'var(--coral)' }}>{state.text}</p>}
          {state?.ok ? (
            <button type="button" className="btn primary block" onClick={() => nav('/')}>Volver a Hoy</button>
          ) : (
            <button className="btn gold block" style={{ height: 54 }} disabled={busy}>{busy ? 'Conectando…' : session ? 'Conectar este televisor' : 'Entrar y conectar'}</button>
          )}
        </form>
        <Link to="/perfil" style={{ fontSize: 14 }}>Volver a Perfil</Link>
      </div>
    </div>
  )
}
