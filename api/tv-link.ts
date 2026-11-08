// Entrar en el televisor con el celular, como en Netflix o YouTube: escribir correo y contraseña con el control es
// muy incómodo, y el enlace del correo llega al celular, no a la TV.
// 1. La TV pide un código (op "start") y lo muestra con un QR. Recibe también un secreto que solo ella conoce.
// 2. En el celular, ya con sesión, se abre el QR o se escribe el código y se aprueba (op "approve").
// 3. La TV pregunta cada pocos segundos (op "poll", con su secreto). Cuando está aprobado recibe un token de un solo
//    uso con el que abre su propia sesión (supabase.auth.verifyOtp). La sesión del celular no se toca.
// Usa la clave de servicio de Supabase y la tabla tv_links (supabase/migrations/20261108000000_tv_links.sql).
import { createClient } from '@supabase/supabase-js'
import { guard } from './_lib/guard.js'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const TTL_MIN = 10
// sin letras que se confunden (0/O, 1/I/L) para dictarlo o escribirlo fácil
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}
const randomSecret = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) return json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel' }, 501)
  const blocked = guard(request, 60)
  if (blocked) return blocked
  const body = (await request.json().catch(() => ({}))) as { op?: string; code?: string; secret?: string }
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const code = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const now = new Date()

  if (body.op === 'start') {
    await sb.from('tv_links').delete().lt('expires_at', now.toISOString())
    const secret = randomSecret()
    const expires = new Date(now.getTime() + TTL_MIN * 60_000).toISOString()
    for (let i = 0; i < 4; i++) {
      const c = randomCode()
      const { error } = await sb.from('tv_links').insert({ code: c, secret_hash: await sha256(secret), expires_at: expires })
      if (!error) return json({ code: c, secret, expires })
      if (error.code !== '23505') return json({ error: error.message }, 500)
    }
    return json({ error: 'No se pudo crear el código' }, 500)
  }

  if (!/^[A-Z0-9]{6}$/.test(code)) return json({ error: 'Código no válido' }, 400)

  if (body.op === 'approve') {
    const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const { data: who } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } }
    if (!who.user) return json({ error: 'Entra a tu cuenta en el celular primero' }, 401)
    const { data, error } = await sb
      .from('tv_links')
      .update({ user_id: who.user.id })
      .eq('code', code)
      .is('user_id', null)
      .gt('expires_at', now.toISOString())
      .select('code')
    if (error) return json({ error: error.message }, 500)
    if (!data?.length) return json({ error: 'Ese código no existe o ya venció. Mira el de la pantalla del televisor.' }, 404)
    return json({ ok: true })
  }

  if (body.op === 'poll') {
    const { data: row } = await sb.from('tv_links').select('secret_hash, user_id, expires_at').eq('code', code).maybeSingle()
    if (!row || row.secret_hash !== (await sha256(String(body.secret ?? '')))) return json({ error: 'Código no válido' }, 404)
    if (!row.user_id) return json({ waiting: true, expired: new Date(row.expires_at) < now })
    // aprobado: un token de un solo uso para que la TV abra su propia sesión; el código ya no sirve para nada más
    await sb.from('tv_links').delete().eq('code', code)
    const { data: u, error: uErr } = await sb.auth.admin.getUserById(row.user_id)
    if (uErr || !u.user?.email) return json({ error: 'No se encontró la cuenta' }, 500)
    const { data: link, error: lErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
    if (lErr || !link.properties?.hashed_token) return json({ error: lErr?.message ?? 'No se pudo abrir la sesión' }, 500)
    return json({ token_hash: link.properties.hashed_token })
  }

  return json({ error: 'Operación no válida' }, 400)
}
