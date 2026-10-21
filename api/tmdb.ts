// Proxy de TMDB: la clave (TMDB_TOKEN) se queda en el servidor de Vercel y nunca llega al navegador.
// Solo deja pasar las rutas y parámetros que usa la app, solo desde la app, y la CDN de Vercel guarda cada respuesta un día.
import { guard } from './_lib/guard.js'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env

const ALLOWED = /^\/(discover\/(movie|tv)|(movie|tv)\/\d+)$/
// Parámetros que manda src/data/live.ts; cualquier otro se rechaza (así no se puede saltar la caché con basura)
const PARAMS = new Set(['language', 'page', 'sort_by', 'vote_count.gte', 'vote_average.gte', 'watch_region', 'with_watch_monetization_types', 'append_to_response'])

export async function GET(request: Request): Promise<Response> {
  const token = env.TMDB_TOKEN
  if (!token) return Response.json({ error: 'Falta TMDB_TOKEN en Vercel' }, { status: 500 })
  const blocked = guard(request, 900)
  if (blocked) return blocked
  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  if (!ALLOWED.test(path)) return Response.json({ error: 'Ruta no permitida' }, { status: 400 })
  url.searchParams.delete('path')
  if ([...url.searchParams.keys()].some((k) => !PARAMS.has(k))) return Response.json({ error: 'Parámetro no permitido' }, { status: 400 })
  const res = await fetch(`https://api.themoviedb.org/3${path}?${url.searchParams}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': res.ok ? 'public, s-maxage=86400, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
