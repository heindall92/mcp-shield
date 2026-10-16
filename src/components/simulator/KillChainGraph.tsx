import { Fragment } from 'react'
import { Bot, Laptop, Server, Skull, User, ShieldCheck } from 'lucide-react'
import type { GraphNode } from '../../engine/simulation'

const NODES: { id: GraphNode; label: string; Icon: typeof User }[] = [
  { id: 'user', label: 'Usuario', Icon: User },
  { id: 'agent', label: 'Agente IDE', Icon: Bot },
  { id: 'mcp', label: 'Servidor MCP', Icon: Server },
  { id: 'host', label: 'Host', Icon: Laptop },
  { id: 'attacker', label: 'Atacante', Icon: Skull },
]

type Tone = 'idle' | 'reached' | 'active' | 'danger' | 'safe'
const CHIP: Record<Tone, string> = {
  idle: 'border-white/[0.06] bg-white/[0.02] text-slate-500',
  reached: 'border-white/[0.12] bg-white/[0.05] text-slate-300',
  active: 'border-amber-200/30 bg-amber-200/[0.07] text-amber-100 shadow-[0_0_0_4px_rgba(253,230,138,0.05)]',
  danger: 'border-red-300/35 bg-red-400/[0.09] text-red-200 shadow-[0_0_0_4px_rgba(248,113,113,0.07)]',
  safe: 'border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200 shadow-[0_0_0_4px_rgba(110,231,183,0.06)]',
}

/** Glass chips joined by hairlines; a soft light travels along the segment currently in use. */
export function KillChainGraph({ active, reached, compromised, hardened, running }: { active: GraphNode[]; reached: Set<GraphNode>; compromised: boolean; hardened: boolean; running: boolean }) {
  const tone = (id: GraphNode): Tone => {
    if (id === 'attacker' && compromised) return 'danger'
    if (id === 'attacker' && hardened) return 'safe'
    if (hardened && id === 'host') return 'safe'
    if (active.includes(id)) return 'active'
    return reached.has(id) ? 'reached' : 'idle'
  }
  return (
    <div className="flex items-start" aria-label="Grafo de la kill-chain">
      {NODES.map(({ id, label, Icon }, i) => {
        const t = tone(id)
        const I = t === 'safe' && id === 'attacker' ? ShieldCheck : Icon
        const next = NODES[i + 1]
        const segOn = next && reached.has(id) && reached.has(next.id)
        const segLive = next && active.includes(id) && active.includes(next.id)
        const segDanger = next?.id === 'attacker' && compromised
        return (
          <Fragment key={id}>
            <div className="flex w-14 shrink-0 flex-col items-center gap-2 sm:w-20">
              <div className={`grid h-10 w-10 place-items-center rounded-[13px] border backdrop-blur-md transition-[background-color,border-color,color,box-shadow] duration-200 ease-out sm:h-11 sm:w-11 ${CHIP[t]}`}>
                <I size={17} strokeWidth={1.6} />
              </div>
              <span className={`whitespace-nowrap text-[0.625rem] font-medium tracking-[0.01em] transition-colors duration-200 sm:text-[0.6875rem] ${t === 'idle' ? 'text-slate-600' : t === 'danger' ? 'text-red-200/90' : t === 'safe' ? 'text-emerald-200/90' : 'text-slate-300'}`}>{label}</span>
            </div>
            {next && (
              <div className="relative mt-5 h-px flex-1 sm:mt-[22px]" aria-hidden>
                <div className="absolute inset-0 bg-white/[0.08]" />
                <div className={`absolute inset-0 origin-left transition-[transform,background-color] duration-200 ease-out ${segDanger ? 'bg-red-300/40' : hardened ? 'bg-emerald-300/30' : 'bg-white/30'}`} style={{ transform: `scaleX(${segOn ? 1 : 0})` }} />
                {segLive && running && <span className={`kc-spark absolute top-1/2 h-[3px] w-6 -translate-y-1/2 rounded-full ${segDanger ? 'kc-spark-red' : ''}`} />}
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
