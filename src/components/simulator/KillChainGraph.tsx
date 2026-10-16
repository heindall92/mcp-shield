import { Bot, Laptop, Server, Skull, User, ShieldCheck } from 'lucide-react'
import type { GraphNode } from '../../engine/simulation'

const NODES: { id: GraphNode; label: string; Icon: typeof User; x: number }[] = [
  { id: 'user', label: 'Usuario', Icon: User, x: 8 },
  { id: 'agent', label: 'Agente IDE', Icon: Bot, x: 29 },
  { id: 'mcp', label: 'Servidor MCP', Icon: Server, x: 50 },
  { id: 'host', label: 'Host / SO', Icon: Laptop, x: 71 },
  { id: 'attacker', label: 'Atacante', Icon: Skull, x: 92 },
]

export function KillChainGraph({ active, reached, compromised, hardened }: { active: GraphNode[]; reached: Set<GraphNode>; compromised: boolean; hardened: boolean }) {
  return (
    <div className="relative h-24 select-none" aria-label="Grafo de la kill-chain">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        {NODES.slice(0, -1).map((n, i) => {
          const next = NODES[i + 1]
          const on = reached.has(n.id) && reached.has(next.id)
          const red = next.id === 'attacker' && compromised
          return <line key={n.id} x1={n.x} y1={16} x2={next.x} y2={16} vectorEffect="non-scaling-stroke"
            className={`transition-[stroke,opacity] duration-200 ${on ? (red ? 'stroke-red-500' : hardened ? 'stroke-emerald-400' : 'stroke-cyan-400') : 'stroke-slate-700'}`}
            strokeWidth={on ? 2 : 1} strokeDasharray={on ? '0' : '3 3'} style={on ? { filter: `drop-shadow(0 0 4px ${red ? '#ef4444' : hardened ? '#34d399' : '#22d3ee'})` } : undefined} />
        })}
      </svg>
      {NODES.map(({ id, label, Icon, x }) => {
        const isOn = active.includes(id)
        const was = reached.has(id)
        const danger = id === 'attacker' && compromised
        const safe = id === 'attacker' && hardened
        const I = safe ? ShieldCheck : Icon
        return (
          <div key={id} className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1.5" style={{ left: `${x}%` }}>
            <div className={`grid h-10 w-10 place-items-center rounded-xl border transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none
              ${danger ? 'border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_28px_#ef4444aa] scale-110'
                : safe ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_22px_#34d39988]'
                : isOn ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-[0_0_22px_#22d3ee88] scale-105'
                : was ? 'border-cyan-700/70 bg-cyan-950/40 text-cyan-300/80' : 'border-slate-800 bg-slate-900/70 text-slate-500'}`}>
              <I size={18} strokeWidth={1.8} />
            </div>
            <span className={`whitespace-nowrap text-[0.625rem] font-medium tracking-wide sm:text-[0.6875rem] ${danger ? 'text-red-300' : isOn ? 'text-slate-100' : 'text-slate-500'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}
