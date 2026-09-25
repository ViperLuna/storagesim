export function money(n: number): string {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`
  if (a >= 10000) return `${sign}$${Math.round(a).toLocaleString()}`
  return `${sign}$${a.toFixed(a % 1 === 0 ? 0 : 2)}`
}

export function duration(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

/** "a Locker" / "an XL" — picks the article by sound (acronyms like XL start with a vowel sound). */
export function aOrAn(word: string): string {
  const vowelSound = /^[aeiou]/i.test(word) || /^[FHLMNRSX][A-Z0-9]/.test(word)
  return `${vowelSound ? 'an' : 'a'} ${word}`
}
