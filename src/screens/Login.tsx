import { useState } from 'react'
import { pendingInvite, supabase } from '../lib/supabase'

// Entrar o crear cuenta con correo y contraseña. Si llegó con un enlace de invitación, al entrar queda unido a su pareja.
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
