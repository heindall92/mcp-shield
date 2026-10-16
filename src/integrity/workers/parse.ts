import { importCapture, type ImportContext, type ImportResult } from '../capture/importAdapter'
import { LIMITS } from '../capture/limits'

let seq = 0
/** Parse in a module Worker with a hard timeout; falls back to the main thread if Workers are unavailable. */
export function parseCapture(text: string, ctx?: Partial<ImportContext>): Promise<ImportResult> {
  if (typeof Worker === 'undefined') return Promise.resolve(importCapture(text, ctx))
  let w: Worker
  try { w = new Worker(new URL('./inventory.worker.ts', import.meta.url), { type: 'module' }) }
  catch { return Promise.resolve(importCapture(text, ctx)) }
  const id = ++seq
  return new Promise(resolve => {
    const done = (r: ImportResult) => { clearTimeout(t); w.terminate(); resolve(r) }
    const t = setTimeout(() => done({ issues: [{ code: 'timeout', level: 'error' }] }), LIMITS.parseTimeoutMs)
    w.onmessage = (e: MessageEvent<{ id: number; result: ImportResult }>) => { if (e.data.id === id) done(e.data.result) }
    w.onerror = () => { clearTimeout(t); w.terminate(); resolve(importCapture(text, ctx)) }
    w.postMessage({ id, text, ctx })
  })
}
