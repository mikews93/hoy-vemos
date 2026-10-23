export type Kind = 'movie' | 'tv'

export interface Ratings {
  imdb?: number // 0-10
  imdbVotes?: number // en miles
  rt?: number // % crítica
  mc?: number // 0-100
  tmdb?: number // 0-10, nota del público en TMDB (para series, donde OMDb casi no trae crítica)
}

export interface Provider {
  name: string
  kind: 'flatrate' | 'rent' | 'buy'
}

export interface Title {
  id: string
  kind: Kind
  title: string
  originalTitle?: string
  year: number
  runtime?: number // minutos (películas) o duración media de episodio (series)
  seasons?: number
  episodes?: number[] // series: episodios de cada temporada ya estrenada, empezando por la 1
  nextEpisode?: { date: string; season: number; episode: number } // series: el próximo que se estrena
  genres: string[]
  tags: string[]
  topics?: string[] // temas delicados detectados en sus palabras clave (src/lib/topics.ts)
  country: string
  overview: string
  ratings: Ratings
  imdbId?: string
  scoresPending?: boolean // OMDb no respondió: las notas son de TMDB y se reintentan
  providers: Provider[]
  poster?: string // URL de póster (TMDB); sin él se dibuja un póster tipográfico
  backdrop?: string
  trailer?: string // URL de YouTube
  cast?: { name: string; role: string }[]
  color: string // color del póster tipográfico
}

export type PersonId = 'a' | 'b'

export interface Person {
  id: PersonId
  name: string
}

export interface Votes {
  liked: string[]
  disliked: string[]
  seen: string[]
  passed: string[]
}
