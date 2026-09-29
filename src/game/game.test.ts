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
  it('goes bankrupt after 3 paydays bleeding money in the red', () => {
    const s = createRun(0)
    s.money = 0
    s.cashAtLastPayroll = 0
    s.loan = { owed: 10000, installment: 100, graceLeft: 0 }
    for (let i = 0; i < 3 && !s.levelOver; i++) step(s, 300)
    expect(s.levelOver).toBe('bankrupt')
  })
  it('idle staff cost nothing; working staff are paid for time worked', () => {
    const s = createRun(0)
    s.money = 1e6
    place(s, 'generator', 'gen-1', 6, 0, 0)
    place(s, 'office', 'office-small', 0, 0, 0)
    hire(s, 'janitor')
    const before = s.money
    for (let i = 0; i < 300; i++) step(s, 1) // nothing dirty all payday
    expect(s.money).toBe(before)
    s.items[0].unit!.status = 'dirty'; s.items[0].unit!.dirtySince = s.time
    const mid = s.money
    for (let i = 0; i < 300; i++) step(s, 1)
    const paid = mid - s.money
    expect(paid).toBeGreaterThan(0)
    expect(paid).toBeLessThan(50) // well under the full-time $50
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

describe('rating floor', () => {
  it('never goes below 0 and climbs right away once problems are fixed', () => {
    const s = createRun(0)
    s.money = 1e6
    for (let i = 0; i < 6; i++) place(s, 'unit', 'locker', i, 0, 0) // blackout
    s.rating = 0.1
    step(s, 300)
    expect(s.rating).toBe(0)
    for (const it of s.items.slice(3)) it.on = false // fix the blackout
    step(s, 300)
    expect(s.rating).toBeCloseTo(0.1)
    expect(s.levelOver).toBeUndefined()
  })
})

describe('mid-lease abandonment', () => {
  it('a tenant can stop paying partway through and abandon', async () => {
    const { vi } = await import('vitest')
    const s = createRun(0)
    s.prospects.push({ id: 999, name: 'Stu Rage', wants: 'locker', bid: 10, vip: false, arrivedAt: 0 })
    const unit = s.items[0]
    offerUnit(s, 999, unit.id)
    unit.unit!.tenant!.leaseLeft = 10
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
    step(s, 60)
    spy.mockRestore()
    expect(unit.unit!.status).toBe('abandoned')
    expect(unit.unit!.pending).toBe(10) // the point before they bailed still counts
  })
})

describe('upsize pricing', () => {
  it('chains up one size at a time, 2x the size below over the new timer, always a discount', async () => {
    const { upsizePrice } = await import('./actions')
    const dillon = { bid: 10, wants: 'locker' }
    expect(upsizePrice(dillon, 'small')).toBe(60)
    expect(upsizePrice(dillon, 'medium')).toBe(360)
    expect(upsizePrice(dillon, 'large')).toBe(1920)
    expect(upsizePrice(dillon, 'xl')).toBe(9600)
    expect(upsizePrice({ bid: 5, wants: 'locker' }, 'medium')).toBe(180) // cheapskates pay proportionally less
    expect(upsizePrice({ ...dillon, upsizeWiggle: 1.1 }, 'medium')).toBe(396)
    for (const big of ['small', 'medium', 'large', 'xl']) {
      expect(upsizePrice({ ...dillon, upsizeWiggle: 1.1 }, big)).toBeLessThan(UNITS.find(u => u.id === big)!.listPrice)
    }
  })
  it('the tenant pays the upsize price', async () => {
    const { vi } = await import('vitest')
    const s = createRun(0)
    s.money = 1e6
    place(s, 'unit', 'medium', 0, 0, 0)
    const med = s.items.find(i => i.defId === 'medium')!
    for (const it of s.items.filter(i => i.defId === 'locker')) it.unit!.status = 'occupied'
    s.prospects.push({ id: 999, name: 'Dillon A.', wants: 'locker', bid: 10, vip: false, arrivedAt: 0 })
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0) // accepts
    const before = s.money
    expect(offerUnit(s, 999, med.id)).toBeNull()
    spy.mockRestore()
    expect(med.unit!.tenant!.bid).toBe(360)
    expect(s.money - before).toBe(360)
  })
})

describe('upsize acceptance', () => {
  it('good deals are likelier yeses than pricey ones', async () => {
    const { upsizeAcceptChance } = await import('./actions')
    expect(upsizeAcceptChance({ upsizeWiggle: 1 })).toBeCloseTo(0.85)
    expect(upsizeAcceptChance({ upsizeWiggle: 0.9 })).toBeCloseTo(0.97)
    expect(upsizeAcceptChance({ upsizeWiggle: 1.1 })).toBeCloseTo(0.7)
  })
})

describe('cameras & burglaries', () => {
  const secured = () => {
    const s = createRun(5)
    s.money = 1e7
    place(s, 'generator', 'gen-3', 0, 0, 0)
    place(s, 'office', 'office-security', 3, 0, 0)
    expect(hire(s, 'security')).toBeNull()
    return s
  }
  it('mount only on units or the sign, one per tile', async () => {
    const { canMountCamera, placeCamera } = await import('./cameras')
    const s = secured()
    const locker = s.items.find(i => i.defId === 'locker')!
    expect(canMountCamera(s, 10, 3)).toBe(false) // empty ground
    expect(canMountCamera(s, 3, 0)).toBe(false) // office
    expect(placeCamera(s, 'cam-basic', locker.x, locker.y, 2)).toBeNull()
    expect(canMountCamera(s, locker.x, locker.y)).toBe(false) // taken
  })
  it('cone coverage depends on facing; domes see all around', async () => {
    const { covers } = await import('./cameras')
    const { CAMERAS } = await import('../data/cameras')
    const basic = CAMERAS[0], dome = CAMERAS[2]
    const cam = { x: 5, y: 5, dir: 2 } // facing down
    expect(covers(cam, basic, 5, 7)).toBe(true)
    expect(covers(cam, basic, 5, 3)).toBe(false) // behind it
    expect(covers({ ...cam }, dome, 5, 3)).toBe(true)
    expect(covers(cam, basic, 5, 9)).toBe(false) // out of range
  })
  it('watched doors get burglars caught; unwatched ones get hit', async () => {
    const { placeCamera, burglary } = await import('./cameras')
    const s = secured()
    const lockers = s.items.filter(i => i.defId === 'locker')
    const [a, b] = lockers
    for (const it of lockers) { it.unit!.status = 'occupied'; it.unit!.tenant = { name: 'T', bid: 10, deposit: 10, vip: false, leaseLeft: 5, anger: 0, complaintStage: 0 } }
    // Camera on locker a, facing down at its door
    placeCamera(s, 'cam-basic', a.x, a.y, 2)
    s.rating = 3
    burglary(s, a)
    expect(s.rating).toBeCloseTo(3.1)
    const far = s.items.find(i => i.defId === 'locker' && Math.abs(i.x - a.x) > 1) ?? b
    burglary(s, far)
    expect(s.rating).toBeLessThan(3.1)
  })
  it('cameras do nothing without a Security guard', async () => {
    const { placeCamera, doorWatched } = await import('./cameras')
    const s = secured()
    const a = s.items.find(i => i.defId === 'locker')!
    placeCamera(s, 'cam-dome', a.x, a.y, 0)
    expect(doorWatched(s, a)).toBe(true)
    s.staff = []
    expect(doorWatched(s, a)).toBe(false)
  })
  it('cameras ride along when the unit moves and sell with it', async () => {
    const { placeCamera } = await import('./cameras')
    const { move } = await import('./actions')
    const s = secured()
    const a = s.items.find(i => i.defId === 'locker')!
    placeCamera(s, 'cam-basic', a.x, a.y, 2)
    expect(move(s, a.id, 10, 2, 0)).toBeNull()
    expect(s.cameras[0]).toMatchObject({ x: 10, y: 2 })
    sell(s, a.id)
    expect(s.cameras).toHaveLength(0)
  })
  it('the guard is off the clock while you are away', async () => {
    const { placeCamera } = await import('./cameras')
    const s = secured()
    const a = s.items.find(i => i.defId === 'locker')!
    placeCamera(s, 'cam-basic', a.x, a.y, 2)
    const before = s.money
    catchUp(s, 3600)
    expect(s.money).toBe(before)
    step(s, 300)
    expect(s.money).toBeLessThan(before) // online, he's paid
  })
  it('no burglaries before rebirth 5 or while offline', async () => {
    const early = createRun(4)
    early.items[0].unit!.status = 'occupied'
    early.items[0].unit!.tenant = { name: 'T', bid: 10, deposit: 10, vip: false, leaseLeft: 999, anger: 0, complaintStage: 0 }
    for (let i = 0; i < 100; i++) step(early, 60)
    expect(early.log.some(e => e.text.includes('Break-in'))).toBe(false)
  })
})
