import { describe, expect, it } from 'vitest'
import { migrate } from './store'
import { createRun } from './game/init'

describe('save migration', () => {
  it('repairs ratings stuck below zero', () => {
    const g = { ...createRun(0), version: 4, rating: -8, ratingAtLastTick: -8 }
    const out = migrate(g)!
    expect(out.version).toBe(5)
    expect(out.rating).toBe(0)
  })
  it('brings a v1 save all the way up', () => {
    const { staff: _s, upgrades: _u, playerClean: _p, ...old } = createRun(0)
    const out = migrate({ ...old, version: 1, rating: -3 })!
    expect(out.version).toBe(5)
    expect(out.playerClean.queue).toEqual([])
    expect(out.rating).toBe(0)
  })
})
