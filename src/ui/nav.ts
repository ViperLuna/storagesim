import type { Menu } from '../store'

/** Sidebar / tab bar menus, in order. Number keys 1–7 open them. */
export const NAV: { id: Exclude<Menu, null>; icon: string; label: string }[] = [
  { id: 'build', icon: '🏗️', label: 'Build' },
  { id: 'tenants', icon: '🧍', label: 'Tenants' },
  { id: 'staff', icon: '👷', label: 'Staff' },
  { id: 'money', icon: '💰', label: 'Money' },
  { id: 'rebirth', icon: '🔁', label: 'Rebirth' },
  { id: 'log', icon: '📜', label: 'Log' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]
