import type { GameState, Item } from './types'
import { FREE_POWER } from '../data/power'
import { UNIT_POWER_PER_TILE } from '../data/units'
import { CAMERAS } from '../data/cameras'
import { genDef, officeDef, signDef, unitDef } from './defs'

export function itemDraw(item: Item): number {
  if (item.kind === 'unit') {
    const d = unitDef(item.defId)
    return d.w * d.h * UNIT_POWER_PER_TILE
  }
  if (item.kind === 'sign') return signDef(item.defId).power
  if (item.kind === 'office') return officeDef(item.defId).power
  return 0
}

/** Total draw of everything switched on. */
export function powerDraw(state: GameState): number {
  const items = state.items.reduce((sum, it) => sum + (it.on ? itemDraw(it) : 0), 0)
  const cams = state.cameras.reduce((sum, c) => sum + (c.on ? (CAMERAS.find(d => d.id === c.defId)?.power ?? 0) : 0), 0)
  return items + cams
}

export function powerCapacity(state: GameState): number {
  return state.items.reduce((sum, it) => sum + (it.kind === 'generator' ? genDef(it.defId).capacity : 0), FREE_POWER)
}

/** Overload trips the whole grid. Recovers automatically once draw fits. */
export function isTripped(state: GameState): boolean {
  return powerDraw(state) > powerCapacity(state)
}

export function isPowered(state: GameState, item: Item): boolean {
  return item.on && !state.tripped
}
