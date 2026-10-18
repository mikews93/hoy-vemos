// Proxy de OMDb (notas de IMDb, Rotten Tomatoes y Metacritic): la clave OMDB_KEY se queda en el servidor.
// Las notas cambian poco: la CDN de Vercel guarda cada respuesta una semana para cuidar el límite diario.

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env

export async function GET(request: Request): Promise<Response> {
  const key = env.OMDB_KEY
  if (!key) return Response.json({}, { status: 200 })
  const id = new URL(request.url).searchParams.get('i') ?? ''
  if (!/^tt\d+$/.test(id)) return Response.json({ error: 'Id de IMDb no válido' }, { status: 400 })
  const res = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${key}`)
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': res.ok ? 'public, s-maxage=604800, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
