// Electricity. Capacity = free hookup + generator. Overload trips everything.

export interface GeneratorDef {
  id: string
  name: string
  w: number
  h: number
  cost: number
  capacity: number
  color: string
  next?: string
}

/** Power available with no generator at all (the "first 5 units are free" hookup). */
export const FREE_POWER = 5

/** First generator is cheap; upgrades get stupid expensive. */
export const GENERATORS: GeneratorDef[] = [
  { id: 'gen-1', name: 'Power Box', w: 1, h: 1, cost: 150, capacity: 15, color: '#8a8f99', next: 'gen-2' },
  { id: 'gen-2', name: 'Transformer', w: 1, h: 1, cost: 3000, capacity: 40, color: '#767c88', next: 'gen-3' },
  { id: 'gen-3', name: 'Substation', w: 2, h: 2, cost: 40000, capacity: 100, color: '#636a77', next: 'gen-4' },
  { id: 'gen-4', name: 'Power Plant', w: 2, h: 2, cost: 400000, capacity: 250, color: '#515866' },
]

/** Rent multiplier for a unit with no power (switched off or blackout). */
export const UNPOWERED_RENT = 0.25
