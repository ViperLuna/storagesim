import { useStore, type Placing } from '../store'
import { baseSize, rotatedSize } from '../game/geometry'
import * as A from '../game/actions'
import { notice } from './notice'
import type { ItemKind, Rot } from '../game/types'

export function placingSize(p: Placing) {
  return rotatedSize(baseSize(p.kind, p.defId), p.rot)
}

/** Anchor the ghost so the pointer sits roughly in its middle. */
export function anchorAt(p: Placing, cx: number, cy: number): { x: number; y: number } {
  const { w, h } = placingSize(p)
  return { x: cx - Math.floor((w - 1) / 2), y: cy - Math.floor((h - 1) / 2) }
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
  s.set({ placing: { ...s.placing, rot: ((s.placing.rot + 1) % 4) as Rot } })
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
