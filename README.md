# Hoy Vemos

App web instalable (PWA) que le arma a una pareja una lista diaria de películas y series para ver, solo con lo mejor puntuado (IMDb 7.0 o más por defecto) y disponible en sus plataformas.

## Qué hace

- **Hoy para ustedes**: la primera vez que se abre la app cada día se arma la lista del día y queda guardada en el historial (Mi lista → días anteriores).
- **Pareja**: cada uno vota con swipe (o botones) en el mismo teléfono; cuando los dos le dan "me gusta" a lo mismo aparece "¡Coinciden!".
- **Ficha**: notas de IMDb, Rotten Tomatoes y Metacritic, dónde ver, por qué se recomienda, tráiler, reparto.
- **Explorar**: joyas ocultas, cine de otros países y otros géneros, separado del algoritmo principal; búsqueda por ánimo.
- **Aprende**: cada "me gustó", "ya la vi", "paso" y "no me interesa" ajusta los pesos de géneros y etiquetas de cada persona (`src/lib/recommender.ts`).

## Para decidir esta noche

- **Decide tú**: botón en Hoy que propone un solo título para esta noche entre lo que les gusta a los dos (coincidencias, lista de hoy y Mi lista pesan más), con "Otra", dos de respaldo y "Algo que ya vimos y nos encantó". Al tocar "Esta" queda guardada en Mi lista y cuenta para los turnos.
- **¿Cuánto tiempo tienen? / ¿Quiénes ven?**: chips en Hoy (sin apuro, menos de 1 h, hasta 2 h; los dos, solo yo, con niños) que filtran Hoy, Pareja, Explorar y "Decide tú". Se guardan por día en el teléfono (`src/lib/tonight.ts`).
- **Final de tres**: con 3 coincidencias o más, en Pareja cada uno quita una por turno y la que queda es la de la noche.
- **Turnos justos**: cada noche elegida guarda cuánto le gustaba a cada uno (su posición en el catálogo según sus gustos). Si uno cedió en las últimas noches, la lista del día, "Decide tú" y el final de tres pesan más sus gustos, y Hoy lo dice.
- **Vetos**: en Perfil, "Lo que nunca quiero ver" por género. Lo vetado por cualquiera de los dos no sale en nada compartido.
- **Para repetir**: en Mi lista, lo que ya vieron y les encantó.
- **Recién llegó a sus plataformas**: TMDB no dice cuándo llega o se va un título, así que cada teléfono compara lo de hoy con lo que vio en días anteriores (`src/lib/arrivals.ts`) y muestra los últimos 7 días. Con los avisos activados en Perfil, avisa al abrir la app si llegó algo de Mi lista (no hay avisos con la app cerrada).
- **Explicación de pareja**: la ficha dice por qué le puede gustar a cada uno.
- **Ánimo con IA**: en Explorar, "Buscar con IA" entiende pedidos como "algo como Dark pero más corto" (`api/mood.ts`, necesita `ANTHROPIC_API_KEY` en Vercel). Sin la clave queda la búsqueda por palabras.
- **Seguimiento de series**: en la ficha de una serie, "Su avance" muestra por dónde van, el botón "Vimos el T2 · E6" y las temporadas para marcar de un toque. Hoy muestra "Seguir viendo" con el próximo episodio, y "Decide tú" prefiere lo que ya van viendo. Al terminar la última temporada queda como vista; si la serie sigue, dice cuándo sale el próximo episodio. El avance es del hogar (`settings.progress`) y los episodios vienen de TMDB (`src/lib/series.ts`).
- **Importar historial**: en Perfil (y al final de la bienvenida) se sube el ratings.csv de IMDb o de Letterboxd. Todo cuenta como visto; 7 o más de 10 cuenta como "me gustó" y 4 o menos como "no me interesa". Lo ya calificado en la app no se pisa. Los títulos que no están en el catálogo se traen livianos desde TMDB (sin gastar OMDb) solo para aprender gustos (`src/lib/importHistory.ts`).
- **Noche con invitados**: de 3 a 6 personas votan sí o no a las mismas 8 propuestas pasándose el teléfono; gana la de más "sí". No cuenta para los gustos ni los turnos de la pareja.

## Proceso de madrugada y avisos con la app cerrada

`api/nightly.ts` corre cada día a las 4 a. m. de Colombia (Vercel Cron, `vercel.json`). Para cada hogar arma la lista del día si nadie abrió la app todavía, y manda avisos Web Push a los teléfonos que los activaron en Perfil: cuando algo de Mi lista llega a sus plataformas y cuando sale un episodio nuevo de una serie que siguen. En iPhone los avisos solo funcionan con la app agregada a la pantalla de inicio.

Para activarlo:

1. En Supabase → SQL Editor, correr `supabase/migrations/20261023000000_push.sql` (tabla `push_subscriptions` y columna `households.provider_snapshot`).
2. En Vercel → Settings → Environment Variables:

| Variable | Valor |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → clave `service_role` (secreta, solo servidor) |
| `CRON_SECRET` | cualquier texto largo al azar; Vercel lo manda al llamar el proceso |
| `VITE_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` | el par que da `npx web-push generate-vapid-keys` |

Sin esas variables el proceso responde 501 y la app sigue armando la lista al abrirse, como antes.

## Correrla

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
```

Sin claves funciona en **modo demostración** con un catálogo de ejemplo (`src/data/demo.ts`, notas aproximadas).

## Datos reales

Copia `.env.example` a `.env` y completa:

| Variable | Dónde se obtiene | Para qué |
| --- | --- | --- |
| `VITE_TMDB_TOKEN` | themoviedb.org → Ajustes → API → "API Read Access Token" (gratis) | Catálogo, pósters, tráileres, dónde ver |
| `VITE_OMDB_KEY` | omdbapi.com/apikey.aspx (gratis con límite diario) | Notas de IMDb, Rotten Tomatoes, Metacritic |
| `VITE_REGION` | Código de país, por ejemplo `CO`, `MX`, `ES` | Disponibilidad por país |

Sin OMDb se usa la nota de TMDB como aproximación de la de IMDb.

## Cuentas y pareja (Supabase)

Con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cada uno usa su propio teléfono con su cuenta (correo y contraseña). La app se puede usar sin cuenta: Hoy, Explorar, las fichas y Mi lista funcionan guardando todo en el navegador, y solo se pide entrar para Modo pareja e invitar a la pareja. Al crear la cuenta o entrar, lo que hizo como invitado (votos, lista, plataformas y la lista de hoy) pasa a la cuenta.

- Al crear la cuenta se crea un **hogar**. En Perfil → "Invita a tu pareja" se comparte un enlace (`#/unirse/CODIGO`) o el código de 6 letras; quien lo abre y crea su cuenta queda en el mismo hogar.
- Votos, Mi lista, la lista del día y los ajustes (plataformas, nota mínima) se guardan en Supabase y llegan al otro teléfono al instante (Realtime). Si los dos le dan "me gusta" a lo mismo, el "¡Coinciden!" aparece aunque el otro haya votado desde su teléfono.
- La lista del día es del hogar: la arma el primero que abre la app ese día.
- Esquema, políticas RLS y funciones: `supabase/migrations/`.

Sin esas variables la app funciona como antes: un dispositivo compartido, todo guardado en el navegador.

## Mi lista

Toca **+** (en el destacado de Hoy, en la ficha o en las tarjetas de Pareja) para guardar un título. En Mi lista cada título tiene **"La vimos"**: pasa a "Ya las vimos" y deja de recomendarse a los dos.

## Publicación (Vercel)

La app se publica en Vercel. Las funciones `api/tmdb.ts` y `api/omdb.ts` hacen de proxy, así las claves de TMDB y OMDb se quedan en el servidor y no aparecen en el JavaScript público (con GitHub Pages quedarían expuestas). Solo atienden pedidos desde la propia app (mismo dominio), aceptan únicamente las rutas y parámetros que usa la app y limitan los pedidos por IP (`api/_lib/guard.ts`), para cuidar sobre todo el límite diario de OMDb.

1. vercel.com → Add New → Project → importar `mikews93/hoy-vemos` (detecta Vite solo).
2. Settings → Environment Variables:

| Variable | Valor |
| --- | --- |
| `TMDB_TOKEN` | el "API Read Access Token" de TMDB (sin `VITE_`) |
| `OMDB_KEY` | la clave de OMDb (sin `VITE_`) |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → clave publishable/anon |
| `VITE_REGION` | `CO` (opcional) |
| `ANTHROPIC_API_KEY` | clave de la API de Anthropic (platform.claude.com), para "Buscar con IA" en Explorar (opcional) |

   No pongas `VITE_TMDB_TOKEN` ni `VITE_OMDB_KEY` en Vercel. Por si acaso, el build en Vercel las ignora y `.vercelignore` evita que `vercel deploy` suba tu `.env`.
3. En Supabase → Authentication → URL Configuration, pon la URL de Vercel como **Site URL** y agrégala en **Redirect URLs** (para los correos de confirmación y de cambio de contraseña).
4. Opcional: Authentication → Sign In / Providers → Email → desactivar "Confirm email" para que la cuenta quede lista al instante. El correo de Supabase sin SMTP propio tiene un límite bajo por hora.

Cada push a `main` se publica solo; cada PR tiene su vista previa.

## Pendiente (siguientes pasos)

- Proceso nocturno en servidor que arme la lista de madrugada y use el dataset oficial `title.ratings.tsv` de IMDb.
- Avisos con la app cerrada (necesitan un proceso en servidor y notificaciones push).

Diseño: lienzo "Recomendador – Diseño de interfaces" (estilo "Sala oscura").
