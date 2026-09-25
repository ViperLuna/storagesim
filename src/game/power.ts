import type { GameState, Item } from './types'
import { FREE_POWER } from '../data/power'
import { UNIT_POWER_PER_TILE } from '../data/units'
import { genDef, signDef, unitDef } from './defs'

export function itemDraw(item: Item): number {
  if (item.kind === 'unit') {
    const d = unitDef(item.defId)
    return d.w * d.h * UNIT_POWER_PER_TILE
  }
  if (item.kind === 'sign') return signDef(item.defId).power
  return 0
}

/** Total draw of everything switched on. */
export function powerDraw(state: GameState): number {
  return state.items.reduce((sum, it) => sum + (it.on ? itemDraw(it) : 0), 0)
}

export function powerCapacity(state: GameState): number {
  const gen = state.items.find(it => it.kind === 'generator')
  return FREE_POWER + (gen ? genDef(gen.defId).capacity : 0)
}

/** Overload trips the whole grid. Recovers automatically once draw fits. */
export function isTripped(state: GameState): boolean {
  return powerDraw(state) > powerCapacity(state)
}

export function isPowered(state: GameState, item: Item): boolean {
  return item.on && !state.tripped
}
