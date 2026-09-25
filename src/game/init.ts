import type { GameState, Item } from './types'
import { gridSizeFor } from '../data/rebirths'
import { STARTING_UNIT, STARTING_UNIT_COUNT } from '../data/units'
import { RATING_START, TICK_SECONDS } from '../data/economy'
import { BASE_SPAWN_SECONDS } from '../data/tenants'

export function newUnit(state: GameState, defId: string, x: number, y: number, rot: Item['rot']): Item {
  return {
    id: state.nextId++, kind: 'unit', defId, x, y, rot, on: true, placedAt: state.time,
    label: `#${state.nextLabel++}`,
    unit: { status: 'vacant', progress: 0, pending: 0 },
  }
}

/** Fresh run at the given rebirth level. Same starting kit every time. */
export function createRun(rebirth: number): GameState {
  const size = gridSizeFor(rebirth)
  const state: GameState = {
    version: 3, rebirth, size, money: 0,
    rating: RATING_START, ratingAtLastTick: RATING_START, failStrikes: 0,
    items: [], nextId: 1, nextLabel: 1, prospects: [],
    nextProspectIn: BASE_SPAWN_SECONDS / 3, // first visitor shows up quickly
    time: 0, tickIn: TICK_SECONDS, log: [], lastSaved: Date.now(), tripped: false,
    staff: [], upgrades: {}, bankruptStrikes: 0, cashAtLastPayroll: 0,
  }
  // Starting pattern: lockers in a row above the locked tiles, one empty row between, doors facing the gate.
  const c = (size - 1) / 2
  const startX = c - Math.floor((STARTING_UNIT_COUNT - 1) / 2)
  for (let i = 0; i < STARTING_UNIT_COUNT; i++) {
    state.items.push(newUnit(state, STARTING_UNIT, startX + i, size - 3, 0))
  }
  return state
}
