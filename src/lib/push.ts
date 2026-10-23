import { supabase } from './supabase'

// Avisos con la app cerrada (Web Push). La clave pública VAPID va en el build; la privada solo en Vercel.
// En iPhone solo funcionan con la app agregada a la pantalla de inicio.
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const canPush = () => Boolean(VAPID && supabase) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const toBytes = (base64: string) => {
  const b64 = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function pushEnabled(): Promise<boolean> {
  if (!canPush()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  return Boolean(await reg?.pushManager.getSubscription())
}

export async function enablePush(): Promise<void> {
  if (!canPush()) throw new Error('Este navegador no permite avisos')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Los avisos están bloqueados para esta app en el teléfono')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID!) }))
  const { data: household, error: hErr } = await supabase!.rpc('my_household')
  if (hErr || !household) throw new Error('No encontramos tu hogar')
  const json = sub.toJSON()
  const { error } = await supabase!.from('push_subscriptions').upsert({ endpoint: sub.endpoint, household_id: household, keys: json.keys }, { onConflict: 'endpoint' })
  if (error) throw new Error('No se pudo guardar el aviso')
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
