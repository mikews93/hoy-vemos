import { createClient } from '@supabase/supabase-js'

// Cuentas y sincronización entre los dos teléfonos. Se activa con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
// (la clave pública "anon/publishable": es segura en el navegador, los datos los protegen las políticas RLS).
// Sin ellas la app sigue funcionando como antes, con todo guardado en este dispositivo.

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasCloud = Boolean(URL && KEY)

// PKCE: el enlace de confirmación vuelve con ?code= y no choca con las rutas en el hash (#/...)
export const supabase = hasCloud ? createClient(URL!, KEY!, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } }) : null

// ¿Está activado "Continuar con Google" en Supabase? Se pregunta una vez; si falla, no se muestra el botón
let google: Promise<boolean> | null = null
export const googleEnabled = () =>
  (google ??= hasCloud
    ? fetch(`${URL}/auth/v1/settings`, { headers: { apikey: KEY! } })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: { external?: Record<string, boolean> } | null) => Boolean(s?.external?.google))
        .catch(() => false)
    : Promise.resolve(false))

// Código de invitación pendiente: llega por el enlace #/unirse/CODIGO y se usa al entrar
const INVITE = 'hv.invite'
export const pendingInvite = {
  get: () => {
    try {
      return localStorage.getItem(INVITE)
    } catch {
      return null
    }
  },
  set: (code: string) => {
    try {
      localStorage.setItem(INVITE, code.toUpperCase())
    } catch {
      // sin almacenamiento: se puede escribir el código a mano en Perfil
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(INVITE)
    } catch {
      // nada que limpiar
    }
  },
}

export const inviteLink = (code: string) => `${location.origin}${location.pathname}#/unirse/${code}`
