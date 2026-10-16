export const REPO = 'https://github.com/heindall92/mcp-shield'
export const LIVE = 'https://heindall92.github.io/mcp-shield/'
declare const __APP_VERSION__: string
/** Injected from package.json by vite.config.ts (define). */
export const VERSION: string = __APP_VERSION__
export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const modKey = () => (isMac() ? '⌘' : 'Ctrl')
/** Cross-component intents (no data payloads, never user input). */
export const OPEN_FILE_EVENT = 'mcps:open-file'
