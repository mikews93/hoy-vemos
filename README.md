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
- **Noche con invitados**: de 3 a 6 personas votan sí o no a las mismas 8 propuestas pasándose el teléfono; gana la de más "sí". No cuenta para los gustos ni los turnos de la pareja.

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
4. Entrar con Google: en Google Cloud Console → APIs y servicios → Credenciales, crea un "ID de cliente de OAuth" tipo "Aplicación web" con URI de redirección `https://aeplziigagwpkaqfxrfq.supabase.co/auth/v1/callback`. Copia el Client ID y el Client Secret en Supabase → Authentication → Sign In / Providers → Google.
5. Opcional: Authentication → Sign In / Providers → Email → desactivar "Confirm email" para que la cuenta quede lista al instante. El correo de Supabase sin SMTP propio tiene un límite bajo por hora.

Cada push a `main` se publica solo; cada PR tiene su vista previa.

## Pendiente (siguientes pasos)

- Proceso nocturno en servidor que arme la lista de madrugada y use el dataset oficial `title.ratings.tsv` de IMDb.
- Importar historial desde IMDb o Letterboxd (CSV).
- Seguimiento de series por episodio, y avisos con la app cerrada (necesitan un proceso en servidor y notificaciones push).

Diseño: lienzo "Recomendador – Diseño de interfaces" (estilo "Sala oscura").
