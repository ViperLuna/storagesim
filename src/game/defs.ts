import { UNITS, type UnitDef } from '../data/units'
import { SIGNS, type SignDef } from '../data/signs'
import { GENERATORS, type GeneratorDef } from '../data/power'
import type { Item } from './types'

export const unitDef = (id: string): UnitDef => UNITS.find(d => d.id === id)!
export const signDef = (id: string): SignDef => SIGNS.find(d => d.id === id)!
export const genDef = (id: string): GeneratorDef => GENERATORS.find(d => d.id === id)!

export function defCost(kind: Item['kind'], id: string): number {
  return kind === 'unit' ? unitDef(id).cost : kind === 'sign' ? signDef(id).cost : genDef(id).cost
}

export function defName(kind: Item['kind'], id: string): string {
  return kind === 'unit' ? unitDef(id).name : kind === 'sign' ? signDef(id).name : genDef(id).name
}

export function defColor(kind: Item['kind'], id: string): string {
  return kind === 'unit' ? unitDef(id).color : kind === 'sign' ? signDef(id).color : genDef(id).color
}

/** Next tier for items that upgrade in place (signs, generators). */
export function nextTier(item: Item): string | undefined {
  if (item.kind === 'sign') return signDef(item.defId).next
  if (item.kind === 'generator') return genDef(item.defId).next
  return undefined
}

/** Units are ranked by catalog order: a later entry is "bigger". */
export const unitRank = (id: string) => UNITS.findIndex(d => d.id === id)
