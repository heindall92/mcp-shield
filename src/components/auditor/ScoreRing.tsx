export function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const c = 2 * Math.PI * 30
  const color = score >= 60 ? '#ef4444' : score >= 35 ? '#f59e0b' : score >= 10 ? '#eab308' : '#34d399'
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center" role="img" aria-label={`Risk score ${score} de 100, nota ${grade}`}>
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90"><circle cx="36" cy="36" r="30" fill="none" stroke="#ffffff10" strokeWidth="6" />
        <circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.23,1,.32,1), stroke .3s', filter: `drop-shadow(0 0 6px ${color})` }} /></svg>
      <div className="text-center leading-none"><div className="text-xl font-bold text-white">{score}</div><div className="mt-0.5 text-[10px] font-semibold" style={{ color }}>nota {grade}</div></div>
    </div>
  )
}
