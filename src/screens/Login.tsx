import { useState } from 'react'
import { pendingInvite, supabase } from '../lib/supabase'

// Entrar o crear cuenta con Google o con correo y contraseña. Si llegó con un enlace de invitación, al entrar queda unido a su pareja.
export default function Login() {
  const invited = Boolean(pendingInvite.get())
  const [mode, setMode] = useState<'in' | 'up'>(invited ? 'up' : 'in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const redirect = `${location.origin}${location.pathname}`
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

  // Google vuelve a esta misma página con ?code=; supabase-js lo canjea solo (PKCE).
  // El código de invitación pendiente sigue en el navegador y se usa al volver.
  const google = async () => {
    if (!supabase) return
    setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}${location.pathname}` } })
    if (error) setMsg({ text: /not enabled/i.test(error.message) ? 'El acceso con Google todavía no está activado.' : error.message })
  }

  const reset = async () => {
    if (!supabase || !email.trim()) return setMsg({ text: 'Escribe tu correo arriba y vuelve a tocar aquí.' })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}${location.pathname}` })
    setMsg(error ? { text: error.message } : { text: 'Te enviamos un correo para cambiar la contraseña.', ok: true })
  }

  return (
    <div className="screen" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
      <form className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={submit}>
        <span className="eyebrow">Hoy Vemos</span>
        <h1 className="h1" style={{ fontSize: 36 }}>{invited ? 'Te invitaron a elegir juntos' : mode === 'in' ? 'Hola de nuevo' : 'Crea tu cuenta'}</h1>
        <p className="sub" style={{ margin: 0 }}>
          {invited
            ? 'Crea tu cuenta (o entra si ya tienes una) y quedarás conectado con tu pareja: verán las mismas listas y sus coincidencias.'
            : 'Cada uno con su cuenta en su teléfono. Luego invitas a tu pareja desde Perfil.'}
        </p>
        <button type="button" className="btn block" style={{ height: 54, background: '#fff', color: '#1F1F1F', borderColor: '#fff', fontWeight: 600 }} onClick={google}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
            <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-8 6.1C6.6 42.6 14.6 48 24 48z" />
          </svg>
          Continuar con Google
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />o con tu correo<span style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />
        </div>
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
        {mode === 'in' && <button type="button" className="btn block" style={{ background: 'transparent', border: 0, color: 'var(--muted)', fontSize: 13 }} onClick={reset}>Olvidé mi contraseña</button>}
      </form>
    </div>
  )
}
