// Vetos por tema: cosas puntuales que alguien no quiere ver aunque le guste el género.
// Se detectan con las palabras clave de TMDB (vienen en inglés). No es perfecto: si TMDB no etiquetó
// el tema en un título, ese título no se esconde. Se guardan junto a los vetos de género como "tema:<id>".

export interface Topic {
  id: string
  label: string
  keywords: string[]
}

export const TOPICS: Topic[] = [
  { id: 'animales', label: 'Muere un animal', keywords: ['animal death', 'death of a dog', 'dog dies', 'dead dog', 'death of pet', 'animal cruelty', 'animal abuse', 'killing an animal', 'dead animal'] },
  { id: 'suicidio', label: 'Suicidio', keywords: ['suicide', 'suicide attempt', 'self-harm', 'self harm', 'self-destruction'] },
  { id: 'abuso', label: 'Abuso sexual', keywords: ['rape', 'sexual abuse', 'sexual assault', 'sexual violence', 'incest', 'child abuse', 'pedophilia'] },
  { id: 'gore', label: 'Mucha sangre', keywords: ['gore', 'torture', 'dismemberment', 'cannibalism', 'splatter', 'body horror', 'mutilation', 'graphic violence'] },
  { id: 'drogas', label: 'Drogas', keywords: ['drug addiction', 'drug abuse', 'drug use', 'overdose', 'heroin', 'heroin addiction', 'cocaine', 'meth', 'drug addict'] },
  { id: 'infidelidad', label: 'Infidelidad', keywords: ['infidelity', 'adultery', 'extramarital affair', 'cheating', 'unfaithfulness'] },
  { id: 'aranas', label: 'Arañas', keywords: ['spider', 'giant spider', 'arachnophobia', 'tarantula'] },
  { id: 'embarazo', label: 'Pérdida de un embarazo', keywords: ['miscarriage', 'stillbirth', 'abortion', 'death of a child', 'death of baby'] },
]

export const TOPIC_PREFIX = 'tema:'
export const topicKey = (id: string) => TOPIC_PREFIX + id

// TMDB casi nunca etiqueta "muere el perro": Marley y yo solo dice "dog" y "tragic". Para este veto se esconde
// también lo que tiene un animal protagonista y un tono triste; mejor esconder de más que de menos.
const ANIMAL = ['dog', 'puppy', 'pets', 'animal lead', 'horse', 'cat', 'elephant', 'whale']
const SAD = ['tragic', 'tearjerker', 'grief', 'death', 'loss of loved one', 'sad ending', 'heartbreaking', 'mourning']

// Los temas de un título según todas sus palabras clave (no solo las 12 que se guardan como etiquetas)
export function topicsOf(keywords: string[]): string[] {
  const kw = keywords.map((k) => k.toLowerCase())
  const found = TOPICS.filter((t) => t.keywords.some((k) => kw.includes(k))).map((t) => t.id)
  if (!found.includes('animales') && kw.some((k) => ANIMAL.includes(k)) && kw.some((k) => SAD.includes(k))) found.push('animales')
  return found
}
