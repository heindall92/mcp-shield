import type { AttackScenario, SimStep } from '../types/mcp.types'

export type SimMode = 'vulnerable' | 'hardened'

/** Steps for a run. Hardened mode replays up to the first malicious step and shows how the control blocks it. */
export function stepsFor(s: AttackScenario, mode: SimMode): SimStep[] {
  if (mode === 'vulnerable') return s.steps
  const firstBad = s.steps.findIndex(st => st.highlight)
  const pre = s.steps.slice(0, Math.max(0, firstBad))
  return [
    ...pre,
    { panel: 'wire', role: 'server→client', blocked: true, content: `// MCP-Shield · política aplicada\n⟪BLOQUEADO⟫ ${s.mitigations[0]}` },
    { panel: 'host', role: 'alert', blocked: true, impact: 'Ataque contenido', content: `[sandbox] --network none · --read-only · --cap-drop ALL\n⟪✓ sin acceso a secretos ni egress⟫` },
    { panel: 'agent', role: 'assistant', content: 'He detectado instrucciones sospechosas en una herramienta y he pedido tu confirmación antes de continuar. 🛡️' },
  ]
}

export type GraphNode = 'user' | 'agent' | 'mcp' | 'host' | 'attacker'
/** Which graph nodes light up at a given step. */
export function nodesFor(step: SimStep | undefined): GraphNode[] {
  if (!step) return []
  if (step.panel === 'agent') return step.role === 'user' ? ['user', 'agent'] : ['agent', 'user']
  if (step.panel === 'wire') return ['agent', 'mcp']
  if (step.role === 'alert') return step.blocked ? ['host'] : ['host', 'attacker']
  return ['mcp', 'host']
}
