import type { LogEntry } from '../game/types'

export type LogCat = 'tenants' | 'problems' | 'security' | 'money' | 'staff' | 'build'

export const LOG_CATS: { id: LogCat; label: string }[] = [
  { id: 'tenants', label: '🧍 Tenants' },
  { id: 'problems', label: '⚠️ Problems' },
  { id: 'security', label: '🦹 Security' },
  { id: 'money', label: '💰 Money' },
  { id: 'staff', label: '👷 Staff' },
  { id: 'build', label: '🏗️ Build' },
]

// Every log message starts with an emoji that says what it's about.
const BY_EMOJI: [string, LogCat][] = [
  ['🚨', 'security'],
  ['😠', 'problems'], ['😤', 'problems'], ['😡', 'problems'], ['⚠️', 'problems'], ['⚡', 'problems'], ['💀', 'problems'], ['🚪', 'problems'],
  ['💸', 'money'], ['🏦', 'money'], ['🔨', 'money'], ['💵', 'money'],
  ['🧹', 'staff'], ['💂', 'staff'], ['👋', 'staff'], ['✨', 'staff'],
  ['🔁 Rebirth', 'build'], ['⬆️', 'build'], ['🏢', 'build'], ['📹', 'build'], ['💡', 'build'],
  ['🧍', 'tenants'], ['👑', 'tenants'], ['✅', 'tenants'], ['📦', 'tenants'], ['🔁', 'tenants'], ['🏚️', 'tenants'],
  ['🙅', 'tenants'], ['🚶', 'tenants'], ['🙂', 'tenants'],
]

export function categorize(e: LogEntry): LogCat | null {
  for (const [prefix, cat] of BY_EMOJI) if (e.text.startsWith(prefix)) return cat
  return null
}
