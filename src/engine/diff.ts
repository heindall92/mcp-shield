export type DiffLine = { type: 'same' | 'add' | 'del'; text: string }
/** Minimal LCS line diff — pure, no deps. */
export function lineDiff(a: string, b: string): DiffLine[] {
  const A = a.split('\n'), B = b.split('\n')
  const dp = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0))
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--)
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: DiffLine[] = []
  let i = 0, j = 0
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ type: 'same', text: A[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', text: A[i++] })
    else out.push({ type: 'add', text: B[j++] })
  }
  while (i < A.length) out.push({ type: 'del', text: A[i++] })
  while (j < B.length) out.push({ type: 'add', text: B[j++] })
  return out
}
