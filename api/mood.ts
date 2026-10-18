// "¿Qué tienen ganas de ver?" con IA: convierte un pedido como "algo como Dark pero más corto" en filtros
// (géneros, palabras clave, títulos parecidos, duración) que la app aplica sobre su propio catálogo.
// La clave (ANTHROPIC_API_KEY) se queda en el servidor; la CDN de Vercel guarda cada respuesta una semana,
// así los atajos de ánimo repetidos no vuelven a costar.
import Anthropic from '@anthropic-ai/sdk'
import { guard } from './_lib/guard.js'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env

// Géneros de TMDB en es-MX (películas y series), los mismos que trae el catálogo
const GENRES = [
  'Acción', 'Aventura', 'Animación', 'Comedia', 'Crimen', 'Documental', 'Drama', 'Familia', 'Fantasía', 'Historia',
  'Terror', 'Música', 'Misterio', 'Romance', 'Ciencia ficción', 'Suspense', 'Bélica', 'Western',
  'Action & Adventure', 'Kids', 'Reality', 'Sci-Fi & Fantasy', 'War & Politics',
]

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['genres', 'keywords', 'similar', 'kind', 'maxRuntime'],
  properties: {
    genres: { type: 'array', items: { type: 'string', enum: GENRES } },
    keywords: { type: 'array', items: { type: 'string' } },
    similar: { type: 'array', items: { type: 'string' } },
    kind: { type: 'string', enum: ['movie', 'tv', 'any'] },
    maxRuntime: { type: 'integer' },
  },
}

const SYSTEM = `Una pareja describe en español qué tiene ganas de ver esta noche. Tradúcelo a filtros de búsqueda.
- genres: de 1 a 3 géneros de la lista que mejor encajan con el pedido.
- keywords: de 2 a 6 palabras clave en inglés, en minúsculas, como las etiquetas de TMDB (por ejemplo "time travel", "small town", "heist", "feel-good").
- similar: los títulos que el pedido nombra, con su título original, más hasta 3 títulos muy parecidos. Vacío si no aplica.
- kind: "movie" o "tv" si el pedido lo dice o lo da a entender ("una serie", "una peli"); si no, "any".
- maxRuntime: minutos máximos si el pedido pide algo corto (película corta ≈ 100, episodios cortos ≈ 30); si no, 0.`

export async function GET(request: Request): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) return Response.json({ error: 'Falta ANTHROPIC_API_KEY en Vercel' }, { status: 501 })
  const blocked = guard(request, 20)
  if (blocked) return blocked
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim()
  if (!q || q.length > 200 || [...params.keys()].length !== 1) return Response.json({ error: 'Pedido no válido' }, { status: 400 })

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: q }],
    })
    if (response.stop_reason === 'refusal') return Response.json({ error: 'No se pudo entender el pedido' }, { status: 422 })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return Response.json({ error: 'Respuesta vacía' }, { status: 502 })
    const f = JSON.parse(text.text) as { genres: string[]; keywords: string[]; similar: string[]; kind: string; maxRuntime: number }
    const filter = {
      genres: f.genres,
      keywords: f.keywords,
      similar: f.similar,
      kind: f.kind === 'movie' || f.kind === 'tv' ? f.kind : undefined,
      maxRuntime: f.maxRuntime > 0 ? f.maxRuntime : undefined,
    }
    return Response.json(filter, { headers: { 'cache-control': 'public, s-maxage=604800, stale-while-revalidate=86400' } })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: 'Demasiados pedidos, espera un momento' }, { status: 429 })
    if (error instanceof Anthropic.APIError) return Response.json({ error: 'La IA no respondió' }, { status: 502 })
    if (error instanceof SyntaxError) return Response.json({ error: 'Respuesta ilegible' }, { status: 502 })
    throw error
  }
}
