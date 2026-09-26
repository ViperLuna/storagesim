import { describe, expect, it } from 'vitest'
import { createRun } from './init'
import { canPlace, isAccessible, reachable } from './grid'
import { doorOutside } from './geometry'
import { place, offerUnit, collect, sell, hire, takeLoan } from './actions'
import { step, catchUp } from './sim'
import { isTripped, powerDraw } from './power'
import { UNITS } from '../data/units'

describe('economy curve', () => {
  it('bigger units take longer, pay more per point, per hour, and per tile', () => {
    for (let i = 1; i < UNITS.length; i++) {
      const a = UNITS[i - 1], b = UNITS[i]
      expect(b.timer).toBeGreaterThan(a.timer)
      expect(b.listPrice).toBeGreaterThan(a.listPrice)
      expect(b.listPrice / b.timer).toBeGreaterThan(a.listPrice / a.timer)
      expect(b.listPrice / b.timer / (b.w * b.h)).toBeGreaterThan(a.listPrice / a.timer / (a.w * a.h))
    }
  })
})

describe('starting run', () => {
  it('7x7 with 3 accessible lockers', () => {
    const s = createRun(0)
    expect(s.size).toBe(7)
    expect(s.items).toHaveLength(3)
    const reach = reachable(s)
    for (const it of s.items) expect(isAccessible(s, it, reach)).toBe(true)
  })
  it('grid grows by a ring per rebirth and stays odd', () => {
    expect(createRun(1).size).toBe(9)
    expect(createRun(5).size).toBe(17)
  })
})

describe('placement', () => {
  it('cannot place on locked tiles, off grid, or overlapping', () => {
    const s = createRun(0)
    expect(canPlace(s, 'unit', 'locker', 3, 6, 0)).toBe(false) // locked
    expect(canPlace(s, 'unit', 'locker', 7, 0, 0)).toBe(false) // off grid
    expect(canPlace(s, 'unit', 'locker', 3, 4, 0)).toBe(false) // on a starting locker
    expect(canPlace(s, 'unit', 'locker', 0, 0, 0)).toBe(true)
  })
  it('rotation swaps footprint and moves the door', () => {
    const s = createRun(0)
    expect(canPlace(s, 'unit', 'small', 5, 0, 0)).toBe(true) // 1x2
    expect(canPlace(s, 'unit', 'small', 6, 0, 1)).toBe(false) // 2x1 hangs off the edge
    expect(doorOutside(0, 0, { w: 1, h: 2 }, 0)).toEqual([0, 2])
    expect(doorOutside(0, 0, { w: 1, h: 2 }, 3)).toEqual([2, 0])
  })
  it('blocking the walkway cuts off a unit (placement still allowed)', () => {
    const s = createRun(0)
    s.money = 1e6
    // Wall off the row in front of the lockers.
    for (let x = 0; x < 7; x++) expect(place(s, 'unit', 'locker', x, 5, 0)).toBeNull()
    const reach = reachable(s)
    const starters = s.items.slice(0, 3)
    for (const it of starters) expect(isAccessible(s, it, reach)).toBe(false)
  })
})

describe('tenants & rent', () => {
  it('deposit + rent accumulates on the unit until collected', () => {
    const s = createRun(0)
    s.prospects.push({ id: 999, name: 'Dillon A.', wants: 'locker', bid: 11, vip: false, arrivedAt: 0 })
    const unit = s.items[0]
    expect(offerUnit(s, 999, unit.id)).toBeNull()
    expect(s.money).toBe(11)
    unit.unit!.tenant!.leaseLeft = 100
    step(s, 60)
    expect(unit.unit!.pending).toBe(11)
    expect(s.money).toBe(11)
    collect(s, unit.id)
    expect(s.money).toBe(22)
  })
  it('blocked tenant eventually rage-quits and gets deposit back', () => {
    const s = createRun(0)
    s.money = 1e6
    s.prospects.push({ id: 999, name: 'Dillon A.', wants: 'locker', bid: 11, vip: false, arrivedAt: 0 })
    const unit = s.items[1]
    offerUnit(s, 999, unit.id)
    place(s, 'unit', 'locker', unit.x, unit.y + 1, 0) // block the door
    const before = s.money
    for (let i = 0; i < 400; i++) step(s, 1)
    expect(unit.unit!.status).toBe('vacant')
    expect(s.money).toBeCloseTo(before - 11)
  })
  it('evicting by selling refunds the deposit and hurts rating', () => {
    const s = createRun(0)
    s.prospects.push({ id: 999, name: 'Dillon A.', wants: 'locker', bid: 11, vip: false, arrivedAt: 0 })
    offerUnit(s, 999, s.items[0].id)
    const rating = s.rating
    sell(s, s.items[0].id)
    expect(s.rating).toBeLessThan(rating)
  })
  it('offline catch-up piles rent on units', () => {
    const s = createRun(0)
    s.prospects.push({ id: 999, name: 'Dillon A.', wants: 'locker', bid: 10, vip: false, arrivedAt: 0 })
    offerUnit(s, 999, s.items[0].id)
    s.items[0].unit!.tenant!.leaseLeft = 1000
    const sum = catchUp(s, 600)
    expect(sum.rent).toBeCloseTo(100)
    expect(s.items[0].unit!.pending).toBeCloseTo(100)
  })
})

describe('power', () => {
  it('6th locker with no generator trips the grid', () => {
    const s = createRun(0)
    s.money = 1e6
    place(s, 'unit', 'locker', 0, 0, 0)
    place(s, 'unit', 'locker', 1, 0, 0)
    expect(powerDraw(s)).toBe(5)
    expect(isTripped(s)).toBe(false)
    place(s, 'unit', 'locker', 2, 0, 0)
    expect(isTripped(s)).toBe(true)
    place(s, 'generator', 'gen-1', 4, 0, 0)
    expect(isTripped(s)).toBe(false)
  })
})

describe('office & janitor', () => {
  const setup = () => {
    const s = createRun(0)
    s.money = 1e6
    place(s, 'generator', 'gen-1', 6, 0, 0)
    // Office in the top-left, door facing down.
    expect(place(s, 'office', 'office-small', 0, 0, 0)).toBeNull()
    expect(hire(s, 'janitor')).toBeNull()
    return s
  }
  it('needs an office with a free slot', () => {
    const s = createRun(0)
    s.money = 1e6
    expect(hire(s, 'janitor')).not.toBeNull()
    const t = setup()
    expect(hire(t, 'janitor')).not.toBeNull() // max 1 / 1 slot
  })
  it('walks to the nearest dirty unit and cleans it', () => {
    const s = setup()
    const far = s.items[2], near = s.items[0]
    far.unit!.status = 'dirty'; far.unit!.dirtySince = 0
    near.unit!.status = 'dirty'; near.unit!.dirtySince = 0
    step(s, 0.1)
    expect(s.staff[0].targetId).toBe(near.id)
    for (let i = 0; i < 200; i++) step(s, 0.25)
    expect(near.unit!.status).toBe('vacant')
    expect(far.unit!.status).toBe('vacant')
  })
  it('does nothing when the office has no power', () => {
    const s = setup()
    s.items.find(i => i.kind === 'office')!.on = false
    s.items[0].unit!.status = 'dirty'
    for (let i = 0; i < 200; i++) step(s, 0.25)
    expect(s.items[0].unit!.status).toBe('dirty')
  })
})

describe('payroll, loans, bankruptcy', () => {
  it('pays wages each tick and goes bankrupt after 3 strikes in the red', () => {
    const s = createRun(0)
    s.money = 1e6
    place(s, 'generator', 'gen-1', 6, 0, 0)
    place(s, 'office', 'office-small', 0, 0, 0)
    hire(s, 'janitor')
    s.money = 0
    s.cashAtLastPayroll = 0
    for (let i = 0; i < 3 && !s.levelOver; i++) step(s, 300)
    expect(s.levelOver).toBe('bankrupt')
  })
  it('offline payroll pauses at $0', () => {
    const s = createRun(0)
    s.money = 1e6
    place(s, 'generator', 'gen-1', 6, 0, 0)
    place(s, 'office', 'office-small', 0, 0, 0)
    hire(s, 'janitor')
    s.money = 60
    catchUp(s, 3600)
    expect(s.money).toBeGreaterThanOrEqual(-50)
    expect(s.levelOver).toBeUndefined()
  })
  it('loan has a grace period then auto-repays', () => {
    const s = createRun(0)
    expect(takeLoan(s)).toBeNull()
    expect(s.money).toBe(1000)
    expect(takeLoan(s)).not.toBeNull()
    for (let i = 0; i < 6; i++) step(s, 300)
    expect(s.money).toBe(1000)
    step(s, 300)
    expect(s.money).toBeCloseTo(1000 - 125)
  })
})

describe('grammar', () => {
  it('uses "an" before vowel sounds', async () => {
    const { aOrAn } = await import('./format')
    expect(aOrAn('XL')).toBe('an XL')
    expect(aOrAn('Locker')).toBe('a Locker')
    expect(aOrAn('Office')).toBe('an Office')
    expect(aOrAn('Large')).toBe('a Large')
  })
})

describe('offline safety', () => {
  it('rating never drops while offline, even with problems', () => {
    const s = createRun(0)
    for (const it of s.items) { it.unit!.status = 'dirty'; it.unit!.dirtySince = 0 }
    s.money = 1e6
    for (let i = 0; i < 6; i++) place(s, 'unit', 'locker', i, 0, 0) // overload → blackout the whole time
    const before = s.rating
    catchUp(s, 48 * 3600)
    expect(s.levelOver).toBeUndefined()
    expect(s.rating).toBe(before)
  })
  it('online, neglected dirty units still hurt', () => {
    const s = createRun(0)
    for (const it of s.items) { it.unit!.status = 'dirty'; it.unit!.dirtySince = 0 }
    for (let i = 0; i < 12; i++) step(s, 300)
    expect(s.rating).toBeLessThan(3)
  })
})

describe('cleaning takes time', () => {
  it('you clean one unit at a time, in order, by size', () => {
    const s = createRun(0)
    const [a, b] = s.items
    for (const it of [a, b]) { it.unit!.status = 'dirty'; it.unit!.dirtySince = 0 }
    collect(s, a.id)
    collect(s, b.id)
    expect(a.unit!.status).toBe('dirty')
    step(s, 9.9)
    expect(a.unit!.status).toBe('dirty')
    step(s, 0.2)
    expect(a.unit!.status).toBe('vacant')
    expect(b.unit!.status).toBe('dirty') // queued behind a
    step(s, 10)
    expect(b.unit!.status).toBe('vacant')
  })
  it('janitor starts slower than you and skips units you queued', () => {
    const s = createRun(0)
    s.money = 1e6
    place(s, 'generator', 'gen-1', 6, 0, 0)
    place(s, 'office', 'office-small', 0, 0, 0)
    hire(s, 'janitor')
    const [a, b] = s.items
    for (const it of [a, b]) { it.unit!.status = 'dirty'; it.unit!.dirtySince = 0 }
    collect(s, a.id)
    step(s, 0.1)
    expect(s.staff[0].targetId).toBe(b.id)
    for (let i = 0; i < 400 && s.staff[0].mode !== 'cleaning'; i++) step(s, 0.05)
    expect(s.staff[0].cleanTotal).toBeCloseTo(15) // 10s locker × 1.5
  })
})

describe('names', () => {
  it('no two people on the lot share a name', async () => {
    const { makeProspect } = await import('./tenants')
    const s = createRun(0)
    for (let i = 0; i < 400; i++) s.prospects.push(makeProspect(s))
    expect(new Set(s.prospects.map(p => p.name)).size).toBe(400)
  })
})

describe('waiting list order', () => {
  it('puts people you can place first: exact, then upsize, then no fit', async () => {
    const { sortedProspects } = await import('./actions')
    const s = createRun(0)
    s.money = 1e6
    place(s, 'unit', 'small', 0, 0, 0)
    const mk = (id: number, wants: string) => ({ id, name: `P${id}`, wants, bid: 10, vip: false, arrivedAt: 0 })
    s.prospects = [mk(1, 'xl'), mk(2, 'small'), mk(3, 'locker'), mk(4, 'xl'), mk(5, 'medium')]
    // Fill the lockers so lockers only fit via upsize to the Small
    for (const it of s.items.filter(i => i.defId === 'locker')) it.unit!.status = 'occupied'
    expect(sortedProspects(s).map(x => x.p.id)).toEqual([2, 3, 1, 4, 5])
  })
})
