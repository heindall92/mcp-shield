export type Lang = 'es' | 'en'
/** Pick the string for a language. Pure helper usable from engine code. */
export const pick = (lang: Lang, es: string, en: string) => (lang === 'en' ? en : es)
export type Bi = { es: string; en: string }
