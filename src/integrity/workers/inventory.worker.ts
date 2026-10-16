/// <reference lib="webworker" />
import { importCapture, type ImportContext } from '../capture/importAdapter'

/** Parses and validates untrusted captures off the main thread. No network, no storage. */
self.onmessage = (e: MessageEvent<{ id: number; text: string; ctx?: Partial<ImportContext> }>) => {
  const { id, text, ctx } = e.data
  try { (self as unknown as Worker).postMessage({ id, result: importCapture(text, ctx) }) }
  catch { (self as unknown as Worker).postMessage({ id, result: { issues: [{ code: 'json', level: 'error' }] } }) }
}
