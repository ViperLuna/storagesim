export const rand = (min: number, max: number) => min + Math.random() * (max - min)
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
/** Exponentially distributed wait with the given mean (random arrivals). */
export const expWait = (mean: number) => -Math.log(1 - Math.random()) * mean

export function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [v, w] of entries) {
    if ((r -= w) <= 0) return v
  }
  return entries[entries.length - 1][0]
}
