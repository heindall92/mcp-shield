import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang } from './lang'
import { UI } from './ui'

type Theme = 'light' | 'dark'
interface Prefs { lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void; t: (typeof UI)[Lang] }
const Ctx = createContext<Prefs | null>(null)

const read = <T extends string>(k: string, ok: readonly T[]): T | null => { try { const v = localStorage.getItem(k) as T | null; return v && ok.includes(v) ? v : null } catch { return null } }
const initialTheme = (): Theme => read('mcps-theme', ['light', 'dark'] as const) ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>(() => read('mcps-lang', ['es', 'en'] as const) ?? 'es')
  const [theme, setThemeS] = useState<Theme>(initialTheme)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light') }, [theme])
  const setLang = useCallback((l: Lang) => { setLangS(l); try { localStorage.setItem('mcps-lang', l) } catch { /* private mode */ } }, [])
  const setTheme = useCallback((t: Theme) => { setThemeS(t); try { localStorage.setItem('mcps-theme', t) } catch { /* private mode */ } }, [])
  return <Ctx.Provider value={{ lang, setLang, theme, setTheme, t: UI[lang] }}>{children}</Ctx.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePrefs() { const c = useContext(Ctx); if (!c) throw new Error('PrefsProvider missing'); return c }

