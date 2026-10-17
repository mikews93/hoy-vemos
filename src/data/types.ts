export type Kind = 'movie' | 'tv'

export interface Ratings {
  imdb?: number // 0-10
  imdbVotes?: number // en miles
  rt?: number // % crítica
  mc?: number // 0-100
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
  genres: string[]
  tags: string[]
  country: string
  overview: string
  ratings: Ratings
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
