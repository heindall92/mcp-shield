export function ScoreRing({ score, grade, label, gradeWord }: { score: number; grade: string; label: string; gradeWord: string }) {
  const c = 2 * Math.PI * 30
  const v = score >= 60 ? '--red-400' : score >= 35 ? '--amber-400' : score >= 10 ? '--yellow-400' : '--emerald-400'
  const color = `rgb(var(${v}))`
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center" role="img" aria-label={label}>
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90"><circle cx="36" cy="36" r="30" fill="none" stroke="rgb(var(--white) / 0.08)" strokeWidth="6" />
        <circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.23,1,.32,1), stroke .3s' }} /></svg>
      <div className="text-center leading-none"><div className="text-xl font-bold text-white">{score}</div><div className="mt-0.5 text-[0.6875rem] font-semibold text-slate-300">{gradeWord} {grade}</div></div>
    </div>
  )
}
