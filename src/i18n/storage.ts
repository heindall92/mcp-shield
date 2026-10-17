const KEEP = new Set(['mcps-lang', 'mcps-theme', 'mcps-accent'])
/** Remove every app-owned key (mcps-*) except the language, theme and accent preferences. */
export function clearAppStorage(store: Pick<Storage, 'length' | 'key' | 'removeItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && (k.startsWith('mcps-') || k.startsWith('mcp-shield')) && !KEEP.has(k)) keys.push(k) }
    keys.forEach(k => store.removeItem(k))
  } catch { /* storage unavailable */ }
}

