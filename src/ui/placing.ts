import { useStore, type Placing } from '../store'
import { baseSize, doorInside, rotatedSize } from '../game/geometry'
import { hasDoor } from '../game/defs'
import * as A from '../game/actions'
import { notice } from './notice'
import type { ItemKind, Rot } from '../game/types'

export function placingSize(p: Placing) {
  return rotatedSize(baseSize(p.kind, p.defId), p.rot)
}

/** Offset from the top-left corner to the tile the pointer should "hold": the door tile if it has one. */
function grabOffset(p: Pick<Placing, 'kind' | 'defId' | 'rot'>): [number, number] {
  if (hasDoor(p.kind)) return doorInside(0, 0, baseSize(p.kind, p.defId), p.rot)
  const { w, h } = rotatedSize(baseSize(p.kind, p.defId), p.rot)
  return [Math.floor((w - 1) / 2), Math.floor((h - 1) / 2)]
}

/** Anchor the ghost so the tapped/hovered tile is its door tile (or its middle if it has no door). */
export function anchorAt(p: Placing, cx: number, cy: number): { x: number; y: number } {
  const [ox, oy] = grabOffset(p)
  return { x: cx - ox, y: cy - oy }
}

export function startPlacing(kind: ItemKind, defId: string) {
  const s = useStore.getState()
  const g = s.game!
  const c = Math.floor(g.size / 2)
  s.set({ placing: { mode: 'new', kind, defId, rot: 0, x: c, y: Math.floor(g.size / 3) }, selectedId: null, menu: window.innerWidth < 760 ? null : s.menu })
}

export function startMove(itemId: number) {
  const s = useStore.getState()
  const it = s.game!.items.find(i => i.id === itemId)!
  s.set({ placing: { mode: 'move', kind: it.kind, defId: it.defId, rot: it.rot, x: it.x, y: it.y, itemId }, game: { ...s.game!, heldId: itemId } })
}

export function startUpgrade(itemId: number, nextId: string) {
  const s = useStore.getState()
  const it = s.game!.items.find(i => i.id === itemId)!
  s.set({ placing: { mode: 'upgrade', kind: it.kind, defId: nextId, rot: it.rot, x: it.x, y: it.y, itemId } })
}

export function rotatePlacing() {
  const s = useStore.getState()
  if (!s.placing) return
  // Spin around the held tile (the door) so it stays where the pointer is.
  const [ox, oy] = grabOffset(s.placing)
  const rot = ((s.placing.rot + 1) % 4) as Rot
  const [nx, ny] = grabOffset({ ...s.placing, rot })
  s.set({ placing: { ...s.placing, rot, x: s.placing.x + ox - nx, y: s.placing.y + oy - ny } })
}

export function cancelPlacing() {
  const s = useStore.getState()
  if (!s.placing) return
  s.set({ placing: null, game: s.game ? { ...s.game, heldId: undefined } : s.game })
}

export function commitPlacing() {
  const s = useStore.getState()
  const p = s.placing
  if (!p || !s.game) return
  const err = s.mutate(g => {
    if (p.mode === 'new') return A.place(g, p.kind, p.defId, p.x, p.y, p.rot)
    if (p.mode === 'move') {
      const e = A.move(g, p.itemId!, p.x, p.y, p.rot)
      if (!e) g.heldId = undefined
      return e
    }
    return A.upgrade(g, p.itemId!, p.x, p.y, p.rot)
  })
  if (err) {
    notice(err)
    return
  }
  // Keep the unit tool active for quick building (Esc to stop); one-offs end here.
  if (p.mode === 'new' && p.kind === 'unit') return
  s.set({ placing: null, selectedId: p.itemId ?? null })
}
