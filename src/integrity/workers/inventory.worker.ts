/// <reference lib="webworker" />
import { importCapture, type ImportContext } from '../capture/importAdapter'

/** Parses and validates untrusted captures off the main thread. No network, no storage. */
self.onmessage = (e: MessageEvent<{ id: number; text: string; ctx?: Partial<ImportContext> }>) => {
  // Dedicated workers only receive messages from their creating page; reject anything else defensively.
  if (e.origin && e.origin !== self.location.origin) return
  if (!e.data || typeof e.data.text !== 'string' || typeof e.data.id !== 'number') return
  const { id, text, ctx } = e.data
  try { (self as unknown as Worker).postMessage({ id, result: importCapture(text, ctx) }) }
  catch { (self as unknown as Worker).postMessage({ id, result: { issues: [{ code: 'json', level: 'error' }] } }) }
}
