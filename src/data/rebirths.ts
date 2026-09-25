// Rebirth (prestige). Index = number of rebirths already done.

export const START_GRID = 7
/** Each rebirth adds a ring of tiles (+2 width). */
export const gridSizeFor = (rebirth: number) => START_GRID + rebirth * 2

/** Rent payout multiplier. Bids look the same every run; payouts scale. */
export const rentMultiplierFor = (rebirth: number) => 1 + rebirth * 0.5

export interface RebirthRequirement {
  money: number
  sign?: boolean
  employee?: boolean
}

/** Requirement to perform rebirth #(index+1). Past the list, the last entry's rules apply with scaled money. */
export const REBIRTH_REQUIREMENTS: RebirthRequirement[] = [
  { money: 2500 },
  { money: 20000, sign: true },
  { money: 150000, sign: true, employee: true },
]

export function requirementFor(rebirth: number): RebirthRequirement {
  const last = REBIRTH_REQUIREMENTS[REBIRTH_REQUIREMENTS.length - 1]
  const base = REBIRTH_REQUIREMENTS[rebirth] ?? { ...last, money: last.money * 8 ** (rebirth - REBIRTH_REQUIREMENTS.length + 1) }
  return base
}
