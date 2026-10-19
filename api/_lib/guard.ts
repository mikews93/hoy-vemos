// Protección de los proxies ahora que la app se usa sin cuenta: sin esto cualquiera podría gastar
// las claves (sobre todo el límite diario de OMDb) desde otro sitio o un script.
// - Solo responde a pedidos hechos desde la propia app (mismo dominio).
// - Limita cuántos pedidos por minuto hace cada IP. Lo que ya está en la CDN de Vercel no llega aquí,
//   así que el límite solo cuenta lo que de verdad va a TMDB u OMDb.

const hits = new Map<string, { count: number; reset: number }>()

function sameSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  // navegadores sin Sec-Fetch-*: se compara el dominio de Origin o Referer con el del pedido
  const from = request.headers.get('origin') ?? request.headers.get('referer')
  if (!from) return false
  try {
    return new URL(from).host === new URL(request.url).host
  } catch {
    return false
  }
}

function overLimit(ip: string, perMinute: number): boolean {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || h.reset < now) {
    if (hits.size > 5000) hits.clear()
    hits.set(ip, { count: 1, reset: now + 60_000 })
    return false
  }
  h.count++
  return h.count > perMinute
}

// Devuelve una respuesta de error si el pedido no se debe atender, o null si puede seguir
export function guard(request: Request, perMinute: number): Response | null {
  if (!sameSite(request)) return Response.json({ error: 'Solo desde Hoy Vemos' }, { status: 403 })
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
  if (overLimit(ip, perMinute)) return Response.json({ error: 'Demasiados pedidos, espera un momento' }, { status: 429, headers: { 'retry-after': '60' } })
  return null
}
