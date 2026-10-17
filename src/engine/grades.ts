/** Grade bands of the risk score (0–100). The scanner grades with them and the risk meter draws them: one source. */
export const GRADE_BANDS = [
  { g: 'A', from: 0, to: 10, tone: 'emerald' },
  { g: 'B', from: 10, to: 35, tone: 'slate' },
  { g: 'C', from: 35, to: 60, tone: 'amber' },
  { g: 'D', from: 60, to: 80, tone: 'orange' },
  { g: 'F', from: 80, to: 100, tone: 'red' },
] as const
export type GradeBand = (typeof GRADE_BANDS)[number]
export const bandOf = (score: number): GradeBand => GRADE_BANDS.find(b => score < b.to) ?? GRADE_BANDS[GRADE_BANDS.length - 1]
