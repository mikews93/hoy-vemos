import { useEffect, useState } from 'react'
import { googleEnabled, pendingInvite, supabase } from '../lib/supabase'
import { guestName, type LoginMode } from '../lib/store'
import { Icon } from '../components/ui'

// Entrar o crear cuenta con Google, con un enlace al correo (sin contraseña) o con correo y contraseña. Se abre encima de la app cuando algo necesita cuenta (reason dice qué).
// Si llegó con un enlace de invitación, al entrar queda unido a su pareja. Lo que hizo sin cuenta pasa a la cuenta.
export default function Login({ reason, initialMode, onClose }: { reason?: string; initialMode?: LoginMode; onClose: () => void }) {
  const invited = Boolean(pendingInvite.get())
  const [mode, setMode] = useState<LoginMode>(invited ? 'up' : initialMode ?? 'up')
  const [name, setName] = useState(guestName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null)
  const [google, setGoogle] = useState(false)

  // El botón de Google solo aparece cuando el proveedor está activado en Supabase
  useEffect(() => {
    let alive = true
    googleEnabled().then((on) => alive && setGoogle(on))
    return () => {
      alive = false
    }
  }, [])

  const back = () => `${location.origin}${location.pathname}`

  // Sale a Google y vuelve con ?code=; la invitación y lo hecho sin cuenta siguen en este dispositivo
  const withGoogle = async () => {
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back() } })
    if (error) {
      setBusy(false)
      setMsg({ text: error.message })
    }
  }

  // Enlace mágico: entra o crea la cuenta con solo abrir el correo
  const magicLink = async () => {
    if (!supabase) return
    if (!email.trim()) return setMsg({ text: 'Escribe tu correo arriba y vuelve a tocar aquí.' })
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: back(), data: name.trim() ? { name: name.trim() } : undefined } })
    setBusy(false)
    setMsg(error ? { text: /rate limit/i.test(error.message) ? 'Se enviaron muchos correos seguidos. Prueba en un rato.' : error.message } : { text: 'Te enviamos un enlace para entrar. Ábrelo en este teléfono.', ok: true })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const redirect = back()
    const res =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: redirect } })
    setBusy(false)
    if (res.error) {
      const m = res.error.message
      setMsg({ text: /invalid login/i.test(m) ? 'Correo o contraseña incorrectos.' : /already registered/i.test(m) ? 'Ese correo ya tiene cuenta. Entra con tu contraseña.' : m })
      return
    }
    // Con "confirmar correo" activo en Supabase no hay sesión hasta que abra el enlace
    if (mode === 'up' && !res.data.session) setMsg({ text: 'Te enviamos un correo para confirmar la cuenta. Ábrelo en este teléfono.', ok: true })
  }

  const reset = async () => {
    if (!supabase || !email.trim()) return setMsg({ text: 'Escribe tu correo arriba y vuelve a tocar aquí.' })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: back() })
    setMsg(error ? { text: error.message } : { text: 'Te enviamos un correo para cambiar la contraseña.', ok: true })
  }

  return (
    <div className="screen" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
      <button className="btn icon" aria-label="Seguir sin cuenta" onClick={onClose} style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', right: 16, borderRadius: 22, width: 44, height: 44 }}>{Icon.x(20)}</button>
      <form className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={submit}>
        <span className="eyebrow">Hoy Vemos</span>
        <h1 className="h1" style={{ fontSize: 36 }}>{invited ? 'Te invitaron a elegir juntos' : mode === 'in' ? 'Hola de nuevo' : 'Crea tu cuenta'}</h1>
        <p className="sub" style={{ margin: 0 }}>
          {invited
            ? 'Crea tu cuenta (o entra si ya tienes una) y quedarás conectado con tu pareja: verán las mismas listas y sus coincidencias.'
            : `${reason ? `${reason} ` : ''}Cada uno con su cuenta en su teléfono; lo que ya marcaste aquí pasa a tu cuenta.`}
        </p>
        {google && (
          <>
            <button type="button" className="btn block" style={{ height: 54, gap: 10 }} onClick={withGoogle} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continuar con Google
            </button>
            <span className="sub" style={{ margin: 0, textAlign: 'center', fontSize: 13 }}>o con tu correo</span>
          </>
        )}
        {mode === 'up' && (
          <label className="field">Tu nombre<input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required /></label>
        )}
        <label className="field">Correo<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="field">
          Contraseña
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
        </label>
        {msg && <p className="sub" role="status" style={{ margin: 0, color: msg.ok ? 'var(--ok)' : 'var(--coral)' }}>{msg.text}</p>}
        <button className="btn gold block" style={{ height: 54, marginTop: 4 }} disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
        <button type="button" className="btn block" style={{ background: 'transparent' }} onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
          {mode === 'in' ? '¿No tienes cuenta? Crear una' : 'Ya tengo cuenta'}
        </button>
        <button type="button" className="btn block" style={{ background: 'transparent', border: 0, color: 'var(--muted)', fontSize: 13 }} onClick={magicLink} disabled={busy}>
          Prefiero sin contraseña: envíenme un enlace al correo
        </button>
        {mode === 'in' && <button type="button" className="btn block" style={{ background: 'transparent', border: 0, color: 'var(--muted)', fontSize: 13 }} onClick={reset}>Olvidé mi contraseña</button>}
      </form>
    </div>
  )
}
