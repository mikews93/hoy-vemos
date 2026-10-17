# Hoy Vemos

App web instalable (PWA) que le arma a una pareja una lista diaria de películas y series para ver, solo con lo mejor puntuado (IMDb 7.0 o más por defecto) y disponible en sus plataformas.

## Qué hace

- **Hoy para ustedes**: la primera vez que se abre la app cada día se arma la lista del día y queda guardada en el historial (Mi lista → días anteriores).
- **Pareja**: cada uno vota con swipe (o botones) en el mismo teléfono; cuando los dos le dan "me gusta" a lo mismo aparece "¡Coinciden!".
- **Ficha**: notas de IMDb, Rotten Tomatoes y Metacritic, dónde ver, por qué se recomienda, tráiler, reparto.
- **Explorar**: joyas ocultas, cine de otros países y otros géneros, separado del algoritmo principal; búsqueda por ánimo.
- **Aprende**: cada "me gustó", "ya la vi", "paso" y "no me interesa" ajusta los pesos de géneros y etiquetas de cada persona (`src/lib/recommender.ts`).

## Correrla

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ para publicar en cualquier hosting estático
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

## Pendiente (siguientes pasos)

- Cuentas y sincronización entre dos teléfonos (Supabase): hoy todo se guarda en el navegador del dispositivo.
- Proceso nocturno en servidor que arme la lista de madrugada y use el dataset oficial `title.ratings.tsv` de IMDb.
- Importar historial desde IMDb o Letterboxd (CSV).
- Seguimiento de series por episodio y avisos cuando algo de la lista llega a sus plataformas.

Diseño: lienzo "Recomendador – Diseño de interfaces" (estilo "Sala oscura").

## Publicación

Cada push a `main` publica la app en GitHub Pages (`.github/workflows/deploy.yml`).
En el repositorio: Settings → Pages → Source: "GitHub Actions". Para datos reales, en
Settings → Secrets and variables → Actions agrega los secretos `TMDB_TOKEN` y `OMDB_KEY`
(y opcionalmente la variable `REGION`).
