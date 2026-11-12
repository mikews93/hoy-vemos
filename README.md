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
- **Vetos**: en Perfil, "Lo que nunca quiero ver" por género y por tema (muere un animal, suicidio, abuso sexual, mucha sangre, drogas, infidelidad, arañas, pérdida de un embarazo). Los temas salen de las palabras clave de TMDB (`src/lib/topics.ts`), así que algo sin etiquetar puede colarse. Lo vetado por cualquiera de los dos no sale en nada compartido.
- **Para repetir**: en Mi lista, lo que ya vieron y les encantó.
- **Recién llegó y se fue**: TMDB no dice cuándo llega o se va un título, así que cada teléfono compara lo de hoy con lo que vio en días anteriores (`src/lib/arrivals.ts`) y muestra los últimos 7 días. Lo que se fue de una de sus plataformas aparece en Mi lista como "Se fue de Netflix" (y dónde sigue, si está en otra de las suyas). Con los avisos activados en Perfil, avisa al abrir la app si algo de Mi lista llegó o se fue. Se sabe el día que pasa, no antes.
- **Explicación de pareja**: la ficha dice por qué le puede gustar a cada uno.
- **¡Muero por verla!**: en Pareja, deslizar hacia arriba (o la estrella) es un "me gusta" con ganas. Las coincidencias con más ganas van primero en el final de tres, "Decide tú" las prefiere, y la tarjeta avisa cuando tu pareja muere por ver algo. Se guarda en los ajustes del hogar (`settings.eager`).
- **El mazo no se acaba**: cuando quedan pocas tarjetas, Pareja trae otra página del catálogo (hasta tres solas por visita, para cuidar el límite de OMDb; después con "Buscar más títulos"). Si ya no queda nada, ofrece quitar los filtros de esta noche o bajar la nota mínima ahí mismo.
- **No estaba ahí**: en "Dónde ver", junto a cada plataforma de su suscripción, "No estaba" esconde el título de todo lo compartido durante un mes (`settings.missing`, `isMissing` en `src/lib/recommender.ts`). Los datos de TMDB vienen de JustWatch y a veces van atrasados.
- **Comodín**: la lista del día lleva, en tercer lugar, una joya con IMDb 7.8 o más de géneros que casi no ven, marcada "Fuera de lo de siempre". Sale cuando ya hay 5 "me gusta" o más.
- **Notas**: en la ficha de algo guardado, "Nota para ustedes" ("nos la recomendó Ana"); se ve en Mi lista (`settings.notes`).
- **Darle play juntos**: para parejas en casas distintas (con cuenta y la pareja unida). En la ficha, una cuenta regresiva de 10 segundos llega a los dos teléfonos por Supabase Realtime (broadcast privado, sin guardar nada) para darle play a la vez. No controla la plataforma: cada uno le da play en la suya. Su migración (`20261030000000_play_together.sql`) solo deja usar el canal a quienes son del hogar.
- **Ánimo con IA**: en Explorar, "Buscar con IA" entiende pedidos como "algo como Dark pero más corto" (`api/mood.ts`, necesita `ANTHROPIC_API_KEY` en Vercel). Sin la clave queda la búsqueda por palabras.
- **Seguimiento de series**: en la ficha de una serie, "Su avance" muestra por dónde van, el botón "Vimos el T2 · E6" y las temporadas para marcar de un toque. Hoy muestra "Seguir viendo" con el próximo episodio, y "Decide tú" prefiere lo que ya van viendo. Al terminar la última temporada queda como vista; si la serie sigue, dice cuándo sale el próximo episodio. El avance es del hogar (`settings.progress`) y los episodios vienen de TMDB (`src/lib/series.ts`).
- **Importar historial**: en Perfil (y al final de la bienvenida) se sube el ratings.csv de IMDb o de Letterboxd. Todo cuenta como visto; 7 o más de 10 cuenta como "me gustó" y 4 o menos como "no me interesa". Lo ya calificado en la app no se pisa. Los títulos que no están en el catálogo se traen livianos desde TMDB (sin gastar OMDb) solo para aprender gustos (`src/lib/importHistory.ts`).
- **Su año**: desde Mi lista ("Su 2026"), cuántas películas, series, episodios y horas vieron juntos, sus géneros, la que más les gustó a los dos y quién cedió más noches (`src/lib/summary.ts`). Las noches y el avance de series cuentan solo del año; "La vimos" no guarda fecha en el teléfono, así que entra todo.
- **Noche con invitados**: de 3 a 6 personas votan sí o no a las mismas 8 propuestas pasándose el teléfono; gana la de más "sí". No cuenta para los gustos ni los turnos de la pareja.

## Proceso de madrugada y avisos con la app cerrada

`api/nightly.ts` corre cada día a las 4 a. m. de Colombia (Vercel Cron, `vercel.json`). Para cada hogar arma la lista del día si nadie abrió la app todavía, y manda avisos Web Push a los teléfonos que los activaron en Perfil: cuando algo de Mi lista llega a sus plataformas o se va de todas ellas, y cuando sale un episodio nuevo de una serie que siguen. En iPhone los avisos solo funcionan con la app agregada a la pantalla de inicio.

Para activarlo:

1. La migración `supabase/migrations/20261023034024_push.sql` (tabla `push_subscriptions` y columna `households.provider_snapshot`) ya está aplicada; las nuevas las aplica la Action `Migraciones`.
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
- Esquema, políticas RLS y funciones: `supabase/migrations/`. Se aplican solas: con cada push a `main` que toque esa carpeta, la GitHub Action `Migraciones` corre `supabase db push` (solo lo que la base no tiene). Necesita los secretos `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens) y `SUPABASE_DB_PASSWORD` (la contraseña de la base) en GitHub → Settings → Secrets → Actions. Una migración nueva va en un archivo cuyo nombre empieza con la fecha y hora (`AAAAMMDDHHMMSS_nombre.sql`), posterior a la última.

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
