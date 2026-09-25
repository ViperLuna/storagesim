import type { GameState, Item, Rot } from './types'
import { baseSize, isLocked, itemSize, lockedTiles, rotatedSize, tilesOf, doorOutside } from './geometry'

/** Occupancy map: tile index → item id. `ignore` lets a held/upgraded item count as free. */
export function occupancy(state: GameState, ignore?: number[]): Map<number, number> {
  const occ = new Map<number, number>()
  for (const item of state.items) {
    if (ignore?.includes(item.id)) continue
    const fp = itemSize(item)
    for (const [x, y] of tilesOf(item.x, item.y, fp)) occ.set(y * state.size + x, item.id)
  }
  return occ
}

export function itemAt(state: GameState, x: number, y: number): Item | undefined {
  return state.items.find(it => {
    const fp = itemSize(it)
    return x >= it.x && x < it.x + fp.w && y >= it.y && y < it.y + fp.h
  })
}

/** Green/red: does it physically fit? (On grid, not on locked tiles, no overlap.) Access is NOT checked. */
export function canPlace(state: GameState, kind: Item['kind'], defId: string, x: number, y: number, rot: Rot, ignore?: number[]): boolean {
  const fp = rotatedSize(baseSize(kind, defId), rot)
  const occ = occupancy(state, ignore)
  for (const [tx, ty] of tilesOf(x, y, fp)) {
    if (tx < 0 || ty < 0 || tx >= state.size || ty >= state.size) return false
    if (isLocked(state.size, tx, ty)) return false
    if (occ.has(ty * state.size + tx)) return false
  }
  return true
}

/** Flood fill from the locked gate tiles across empty tiles. Returns a set of reachable tile indices. */
export function reachable(state: GameState, ignore?: number[]): Set<number> {
  const occ = occupancy(state, ignore)
  const n = state.size
  const seen = new Set<number>()
  const queue: [number, number][] = []
  for (const [x, y] of lockedTiles(n)) {
    seen.add(y * n + x)
    queue.push([x, y])
  }
  while (queue.length) {
    const [x, y] = queue.shift()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
      const k = ny * n + nx
      if (seen.has(k) || occ.has(k)) continue
      seen.add(k)
      queue.push([nx, ny])
    }
  }
  return seen
}

/** Is this unit's door open and connected to the gate? */
export function isAccessible(state: GameState, item: Item, reach: Set<number>): boolean {
  const [ox, oy] = doorOutside(item.x, item.y, baseSize(item.kind, item.defId), item.rot)
  if (ox < 0 || oy < 0 || ox >= state.size || oy >= state.size) return false
  return reach.has(oy * state.size + ox)
}

/**
 * Breadth-first search over empty tiles from (sx, sy). The start tile always counts as walkable
 * (someone may be standing where a building just went down). Returns distances and parents for paths.
 */
export function bfsFrom(state: GameState, sx: number, sy: number): { dist: Int32Array; prev: Int32Array } {
  const n = state.size
  const occ = occupancy(state)
  const dist = new Int32Array(n * n).fill(-1)
  const prev = new Int32Array(n * n).fill(-1)
  if (sx < 0 || sy < 0 || sx >= n || sy >= n) return { dist, prev }
  const start = sy * n + sx
  dist[start] = 0
  const queue = [start]
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi]
    const x = k % n, y = (k - x) / n
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
      const nk = ny * n + nx
      if (dist[nk] >= 0 || occ.has(nk)) continue
      dist[nk] = dist[k] + 1
      prev[nk] = k
      queue.push(nk)
    }
  }
  return { dist, prev }
}

/** Tiles to walk from the BFS start to (tx, ty), excluding the start tile. */
export function pathTo(state: GameState, prev: Int32Array, tx: number, ty: number): [number, number][] {
  const n = state.size
  const out: [number, number][] = []
  let k = ty * n + tx
  while (prev[k] >= 0) {
    out.push([k % n, Math.floor(k / n)])
    k = prev[k]
  }
  return out.reverse()
}

export function isWalkable(state: GameState, x: number, y: number, occ = occupancy(state)): boolean {
  return x >= 0 && y >= 0 && x < state.size && y < state.size && !occ.has(y * state.size + x)
}
