import type { McpConfig, McpToolDefinition } from '../types/mcp.types'
import { MAX_INPUT_BYTES, stripJsonc } from './parse'

export const MAX_TOOLS = 2000
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Parse a `tools/list` JSON-RPC response ({jsonrpc,id,result:{tools}}), a bare {tools:[…]} or a tools array.
 * Runs in the browser only; the result lives in memory.
 */
export function parseToolsList(text: string): { tools?: McpToolDefinition[]; error?: 'empty' | 'size' | 'json' | 'shape' | 'rpc-error' | 'too-many' } {
  if (!text.trim()) return { error: 'empty' }
  if (new Blob([text]).size > MAX_INPUT_BYTES) return { error: 'size' }
  let j: unknown
  try { j = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { try { j = JSON.parse(stripJsonc(text.replace(/^\uFEFF/, ''))) } catch { return { error: 'json' } } }
  if (isObj(j) && 'error' in j && !('result' in j)) return { error: 'rpc-error' }
  const list = Array.isArray(j) ? j : isObj(j) && isObj(j.result) && Array.isArray(j.result.tools) ? j.result.tools : isObj(j) && Array.isArray(j.tools) ? j.tools : undefined
  if (!list) return { error: 'shape' }
  if (list.length > MAX_TOOLS) return { error: 'too-many' }
  const tools = list.filter(isObj).map(t => ({
    name: typeof t.name === 'string' ? t.name : String(t.name ?? '?'),
    description: typeof t.description === 'string' ? t.description : undefined,
    inputSchema: isObj(t.inputSchema) ? t.inputSchema : undefined,
  }))
  return tools.length ? { tools } : { error: 'shape' }
}

/** Merge imported inventories into the config per server (imported tools replace a pasted snapshot with the same name). */
export function mergeTools(cfg: McpConfig, imported: Record<string, McpToolDefinition[]>): McpConfig {
  const out: McpConfig = { mcpServers: {} }
  for (const [n, s] of Object.entries(cfg.mcpServers)) {
    const extra = imported[n]
    if (!extra?.length) { out.mcpServers[n] = s; continue }
    const byName = new Map((s.tools ?? []).map(t => [t.name, t]))
    for (const t of extra) byName.set(t.name, t)
    out.mcpServers[n] = { ...s, tools: [...byName.values()] }
  }
  return out
}
