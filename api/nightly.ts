// Proceso de madrugada (Vercel Cron, ver vercel.json): para cada hogar arma la lista del día si aún no existe
// y manda avisos a los teléfonos que los activaron, aunque la app esté cerrada:
// - algo de Mi lista llegó a sus plataformas;
// - hoy sale un episodio nuevo de una serie que van siguiendo.
// Usa la clave de servicio de Supabase (salta RLS), así que solo responde a Vercel Cron con CRON_SECRET.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { buildDaily, sharedPool, turnOf, type Settings } from '../src/lib/recommender.js'
import { onPlatforms, platformOf } from '../src/lib/platforms.js'
import type { PersonId, Title, Votes } from '../src/data/types.js'
import { nightlyCatalog, titlesById } from './_lib/catalog.js'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const NEEDED = ['CRON_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'TMDB_TOKEN', 'VITE_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const

type VoteKind = keyof Votes
interface Push {
  title: string
  body: string
  url: string
}

const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)\//

const emptyVotes = (): Votes => ({ liked: [], disliked: [], seen: [], passed: [] })
// La fecha del día en Colombia, igual que la que usa la app en el teléfono
const todayBogota = () => new Date().toLocaleDateString('sv-SE', { timeZone: env.VITE_TIMEZONE || 'America/Bogota' })

export async function GET(request: Request): Promise<Response> {
  const missing = NEEDED.filter((k) => !env[k])
  if (missing.length) return Response.json({ error: `Faltan variables en Vercel: ${missing.join(', ')}` }, { status: 501 })
  if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return Response.json({ error: 'Solo para Vercel Cron' }, { status: 401 })

  const sb = createClient(env.VITE_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  webpush.setVapidDetails('mailto:avisos@hoyvemos.app', env.VITE_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
  const date = todayBogota()

  const { data: households, error } = await sb.from('households').select('id, settings, provider_snapshot')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const catalog = await nightlyCatalog()
  const report: Record<string, unknown>[] = []

  for (const h of households ?? []) {
    try {
      report.push({ household: h.id, ...(await runHousehold(sb, h, catalog, date)) })
    } catch (e) {
      report.push({ household: h.id, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return Response.json({ date, households: report.length, report })
}

type Db = SupabaseClient
interface Household {
  id: string
  settings: Settings
  provider_snapshot: Record<string, string[]>
}

async function runHousehold(sb: Db, h: Household, catalog: Title[], date: string) {
  const settings: Settings = { minImdb: 7, platforms: [], ...(h.settings as Partial<Settings>) }
  const [people, votes, list, daily, subs] = await Promise.all([
    sb.from('profiles').select('id, onboarded').eq('household_id', h.id).order('created_at'),
    sb.from('votes').select('user_id, title_id, kind').eq('household_id', h.id),
    sb.from('list_items').select('title_id, watched_at').eq('household_id', h.id),
    sb.from('daily_lists').select('date').eq('household_id', h.id).eq('date', date).maybeSingle(),
    sb.from('push_subscriptions').select('endpoint, keys, user_id').eq('household_id', h.id),
  ])
  const ids = (people.data ?? []).map((p) => p.id as string)
  if (!ids.length || !(people.data ?? []).some((p) => p.onboarded)) return { skipped: 'sin perfiles listos' }

  // 1. Lista del día: la arma el servidor si nadie abrió la app todavía; si ya existe, no se toca
  const watched = (list.data ?? []).filter((r) => r.watched_at).map((r) => r.title_id as string)
  const toVotes = (uid?: string): Votes => {
    const v = emptyVotes()
    if (uid) (votes.data ?? []).filter((r) => r.user_id === uid).forEach((r) => v[r.kind as VoteKind].push(r.title_id as string))
    v.seen = [...new Set([...v.seen, ...watched])]
    return v
  }
  const keys: Record<PersonId, string> = { a: ids[0], b: ids[1] ?? 'pareja' }
  let built = false
  if (!daily.data) {
    const picks = buildDaily(sharedPool(catalog, settings), { a: toVotes(ids[0]), b: toVotes(ids[1]) }, settings, date, 8, turnOf(settings.nights, keys))
    const ins = await sb.from('daily_lists').upsert({ household_id: h.id, ...picks }, { onConflict: 'household_id,date', ignoreDuplicates: true })
    if (ins.error) throw new Error(ins.error.message)
    built = true
  }

  // 2. Avisos: Mi lista (sin las ya vistas) y las series que siguen
  const pending = (list.data ?? []).filter((r) => !r.watched_at).map((r) => r.title_id as string)
  const following = Object.keys(settings.progress ?? {})
  const tracked = await titlesById([...new Set([...pending, ...following])])
  const pushes: Push[] = []
  const snapshot: Record<string, string[]> = {}
  for (const t of tracked) {
    const now = [...new Set(t.providers.filter((p) => p.kind === 'flatrate').map((p) => platformOf(p.name) ?? p.name))]
    snapshot[t.id] = now
    const before = h.provider_snapshot?.[t.id]
    // Sin foto anterior no se avisa: es la primera vez que se mira este título
    const arrived = before ? now.filter((p) => !before.includes(p) && onPlatforms(p, settings.platforms)) : []
    if (pending.includes(t.id) && arrived.length) pushes.push({ title: `${t.title} llegó a ${arrived[0]}`, body: 'Está en su lista. ¿La ven hoy?', url: `#/titulo/${t.id}` })
    if (following.includes(t.id) && t.nextEpisode?.date === date)
      pushes.push({ title: `Hoy sale un episodio de ${t.title}`, body: `T${t.nextEpisode.season} · E${t.nextEpisode.episode}`, url: `#/titulo/${t.id}` })
  }
  await sb.from('households').update({ provider_snapshot: snapshot }).eq('id', h.id)

  let sent = 0
  // Solo teléfonos de quienes siguen en este hogar, y solo hacia servicios de avisos conocidos
  const members = new Set(ids)
  const deliverable = (subs.data ?? []).filter((sub) => members.has(sub.user_id as string) && PUSH_HOST.test(sub.endpoint as string))
  for (const sub of deliverable) {
    for (const p of pushes) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint as string, keys: sub.keys as { p256dh: string; auth: string } }, JSON.stringify(p))
        sent++
      } catch (e) {
        // 404/410: el teléfono quitó el permiso o desinstaló la app; se borra la suscripción
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        break
      }
    }
  }
  return { built, pushes: pushes.length, sent }
}
