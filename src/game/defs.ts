import { UNITS, type UnitDef } from '../data/units'
import { SIGNS, type SignDef } from '../data/signs'
import { GENERATORS, type GeneratorDef } from '../data/power'
import { OFFICES, type OfficeDef } from '../data/office'
import type { Item } from './types'

export const unitDef = (id: string): UnitDef => UNITS.find(d => d.id === id)!
export const signDef = (id: string): SignDef => SIGNS.find(d => d.id === id)!
export const genDef = (id: string): GeneratorDef => GENERATORS.find(d => d.id === id)!
export const officeDef = (id: string): OfficeDef => OFFICES.find(d => d.id === id)!

function anyDef(kind: Item['kind'], id: string): { cost: number; name: string; color: string; w: number; h: number } {
  switch (kind) {
    case 'unit': return unitDef(id)
    case 'sign': return signDef(id)
    case 'generator': return genDef(id)
    case 'office': return officeDef(id)
  }
}

export const defCost = (kind: Item['kind'], id: string) => anyDef(kind, id).cost
export const defName = (kind: Item['kind'], id: string) => anyDef(kind, id).name
export const defColor = (kind: Item['kind'], id: string) => anyDef(kind, id).color
export const defSize = (kind: Item['kind'], id: string) => {
  const d = anyDef(kind, id)
  return { w: d.w, h: d.h }
}

/** Items with a door that must be reachable from the gate. */
export const hasDoor = (kind: Item['kind']) => kind === 'unit' || kind === 'office'

/** Next tier for items that upgrade in place (signs, generators). */
export function nextTier(item: Item): string | undefined {
  if (item.kind === 'sign') return signDef(item.defId).next
  if (item.kind === 'generator') return genDef(item.defId).next
  return undefined
}

/** Units are ranked by catalog order: a later entry is "bigger". */
export const unitRank = (id: string) => UNITS.findIndex(d => d.id === id)
