// Las plataformas que se eligen en la app tienen nombres cortos ("Prime Video", "Disney+"), pero TMDB
// las llama distinto y cambia los nombres con el tiempo ("Amazon Prime Video", "Disney Plus", "HBO Max",
// "Netflix Standard with Ads"…). Aquí se traduce cada nombre de TMDB a la plataforma de la app.
const MATCH: [string, RegExp][] = [
  ['Netflix', /^netflix/i],
  ['Prime Video', /prime video/i],
  ['Disney+', /^disney/i],
  ['Max', /^(hbo )?max\b|^hbo/i],
  ['Apple TV+', /^apple tv/i],
  ['Paramount+', /^paramount/i],
  ['MUBI', /^mubi/i],
]

export function platformOf(providerName: string): string | undefined {
  return MATCH.find(([, re]) => re.test(providerName))?.[0] ?? undefined
}

// ¿Este proveedor de TMDB es una de las plataformas elegidas? (vacío = todas)
export const onPlatforms = (providerName: string, platforms: string[]) =>
  platforms.length === 0 || platforms.includes(platformOf(providerName) ?? providerName)
