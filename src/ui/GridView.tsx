import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { canPlace, itemAt, reachable, isAccessible } from '../game/grid'
import { doorInside, baseSize, isLocked, itemSize, lockedTiles } from '../game/geometry'
import { defColor, hasDoor, unitDef } from '../game/defs'
import { isPowered, itemDraw } from '../game/power'
import * as A from '../game/actions'
import { money } from '../game/format'
import { anchorAt, commitPlacing, placingSize } from './placing'
import type { GameState, Item, Rot } from '../game/types'
import { ANGER_GRACE } from '../data/tenants'

export const TILE = 56
const GATE_H = 30
const MIN_SCALE = 0.25
const MAX_SCALE = 2.5
const DRAG_THRESHOLD = 6

interface View { x: number; y: number; s: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function GridView() {
  const game = useStore(s => s.game)!
  const placing = useStore(s => s.placing)
  const selectedId = useStore(s => s.selectedId)
  const flash = useStore(s => s.flash)
  const fitRequest = useStore(s => s.fitRequest)
  const showReach = useStore(s => s.showReach)

  const vpRef = useRef<HTMLDivElement>(null)
  const [view, setViewState] = useState<View>({ x: 0, y: 0, s: 1 })
  const viewRef = useRef(view)
  const setView = useCallback((v: View) => {
    viewRef.current = v
    setViewState(v)
  }, [])

  const worldW = game.size * TILE
  const worldH = game.size * TILE + GATE_H

  /** Keep at least part of the lot on screen. */
  const clampView = useCallback((v: View): View => {
    const vp = vpRef.current
    if (!vp) return v
    const { width, height } = vp.getBoundingClientRect()
    const s = clamp(v.s, MIN_SCALE, MAX_SCALE)
    const margin = 80
    return {
      s,
      x: clamp(v.x, margin - worldW * s, width - margin),
      y: clamp(v.y, margin - worldH * s, height - margin),
    }
  }, [worldW, worldH])

  const fit = useCallback(() => {
    const vp = vpRef.current
    if (!vp) return
    const { width, height } = vp.getBoundingClientRect()
    const s = clamp(Math.min(width / worldW, height / worldH) * 0.9, MIN_SCALE, MAX_SCALE)
    setView({ s, x: (width - worldW * s) / 2, y: (height - worldH * s) / 2 })
  }, [worldW, worldH, setView])

  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const vp = vpRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const cx = px ?? rect.width / 2
    const cy = py ?? rect.height / 2
    const v = viewRef.current
    const s = clamp(v.s * factor, MIN_SCALE, MAX_SCALE)
    const k = s / v.s
    setView(clampView({ s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }))
  }, [clampView, setView])

  // Fit on load, new run, and whenever the grid size changes.
  useLayoutEffect(fit, [fit, fitRequest])

  // Menus opening/closing resize the viewport — keep the same spot centered.
  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    let prev = vp.getBoundingClientRect()
    const ro = new ResizeObserver(() => {
      const now = vp.getBoundingClientRect()
      const v = viewRef.current
      setView({ ...v, x: v.x + (now.width - prev.width) / 2, y: v.y + (now.height - prev.height) / 2 })
      prev = now
    })
    ro.observe(vp)
    return () => ro.disconnect()
  }, [setView])

  // Complaint/toast clicked → swoop to the unit.
  useEffect(() => {
    if (!flash) return
    const it = useStore.getState().game?.items.find(i => i.id === flash.id)
    const vp = vpRef.current
    if (!it || !vp) return
    const fp = itemSize(it)
    const { width, height } = vp.getBoundingClientRect()
    const s = Math.max(viewRef.current.s, 1.3)
    const cx = (it.x + fp.w / 2) * TILE, cy = (it.y + fp.h / 2) * TILE
    setView(clampView({ s, x: width / 2 - cx * s, y: height / 2 - cy * s }))
  }, [flash, clampView, setView])

  // Scroll wheel zooms toward the cursor.
  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top)
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // ---- Pointer handling: tap vs pan vs pinch ----
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ sx: number; sy: number; v: View; moved: boolean; type: string } | null>(null)
  const pinch = useRef<{ dist: number; cx: number; cy: number; v: View } | null>(null)

  const toCell = (clientX: number, clientY: number): [number, number] => {
    const rect = vpRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return [Math.floor((clientX - rect.left - v.x) / v.s / TILE), Math.floor((clientY - rect.top - v.y) / v.s / TILE)]
  }

  const hoverGhost = (clientX: number, clientY: number) => {
    const p = useStore.getState().placing
    if (!p) return
    const [cx, cy] = toCell(clientX, clientY)
    const a = anchorAt(p, cx, cy)
    if (a.x !== p.x || a.y !== p.y) useStore.getState().set({ placing: { ...p, ...a } })
  }

  const onTap = (clientX: number, clientY: number, type: string) => {
    const st = useStore.getState()
    const [cx, cy] = toCell(clientX, clientY)
    if (st.placing) {
      const a = anchorAt(st.placing, cx, cy)
      const moved = a.x !== st.placing.x || a.y !== st.placing.y
      st.set({ placing: { ...st.placing, ...a } })
      // Mouse: click places. Touch: first tap positions, tapping the ghost again (or the Place button) confirms.
      if (type === 'mouse' || !moved) commitPlacing()
      return
    }
    const it = st.game && itemAt(st.game, cx, cy)
    if (!it) {
      st.set({ selectedId: null })
      return
    }
    if (it.unit && (it.unit.pending > 0 || it.unit.status === 'dirty')) st.mutate(g => A.collect(g, it.id))
    st.set({ selectedId: it.id })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    vpRef.current!.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const rect = vpRef.current!.getBoundingClientRect()
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - rect.left, cy: (a.y + b.y) / 2 - rect.top, v: viewRef.current }
      drag.current = null
    } else if (pointers.current.size === 1) {
      drag.current = { sx: e.clientX, sy: e.clientY, v: viewRef.current, moved: false, type: e.pointerType }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) {
      if (e.pointerType === 'mouse') hoverGhost(e.clientX, e.clientY)
      return
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const p = pinch.current
      const s = clamp(p.v.s * Math.hypot(a.x - b.x, a.y - b.y) / p.dist, MIN_SCALE, MAX_SCALE)
      const k = s / p.v.s
      setView(clampView({ s, x: p.cx - (p.cx - p.v.x) * k, y: p.cy - (p.cy - p.v.y) * k }))
      return
    }
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true
    if (d.moved) setView(clampView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }))
    else if (e.pointerType === 'mouse') hoverGhost(e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (d && !d.moved && pointers.current.size === 0 && e.type === 'pointerup') onTap(e.clientX, e.clientY, d.type)
    if (pointers.current.size === 0) drag.current = null
  }

  const reach = useMemo(() => reachable(game), [game])

  return (
    <div className="viewport" ref={vpRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onContextMenu={e => e.preventDefault()}>
      <div className="world" style={{ width: worldW, height: worldH, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
        <div className="lot" style={{ width: worldW, height: game.size * TILE, backgroundSize: `${TILE}px ${TILE}px` }} />
        {lockedTiles(game.size).map(([x, y]) => (
          <div key={`l${x}`} className="locked" style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE }} />
        ))}
        {showReach && [...reach].map(k => {
          const x = k % game.size, y = Math.floor(k / game.size)
          return isLocked(game.size, x, y) ? null : <div key={`r${k}`} className="reach" style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE }} />
        })}
        <div className="gate" style={{ left: (game.size / 2 - 1.5) * TILE, top: game.size * TILE, width: TILE * 3, height: GATE_H }}>═ GATE ═</div>
        {game.items.map(it => (
          <ItemView key={it.id} game={game} item={it} accessible={!hasDoor(it.kind) || isAccessible(game, it, reach)}
            selected={it.id === selectedId} flashN={flash?.id === it.id ? flash.n : 0}
            hidden={placing?.itemId === it.id && placing.mode === 'move'} />
        ))}
        {game.staff.map(st => (st.mode === 'idle' ? null : (
          <div key={st.id} className={`staff-dot ${st.mode}`} title="Janitor"
            style={{ left: (st.x + 0.5) * TILE, top: (st.y + 0.5) * TILE }}>🧹</div>
        )))}
        {placing && <Ghost game={game} />}
      </div>
      <div className="zoom-controls" onPointerDown={e => e.stopPropagation()}>
        <button onClick={() => zoomAt(1.25)} aria-label="Zoom in">＋</button>
        <button onClick={fit} aria-label="Fit whole lot" title="Fit whole lot">🎯</button>
        <button onClick={() => zoomAt(0.8)} aria-label="Zoom out">－</button>
      </div>
    </div>
  )
}

const ICONS: Record<Item['kind'], string> = { unit: '', sign: '🪧', generator: '⚡', office: '🏢' }

const DOOR_BAR: Record<Rot, React.CSSProperties> = {
  0: { bottom: 0, left: '20%', width: '60%', height: 5 },
  1: { left: 0, top: '20%', height: '60%', width: 5 },
  2: { top: 0, left: '20%', width: '60%', height: 5 },
  3: { right: 0, top: '20%', height: '60%', width: 5 },
}

function DoorMarker({ item }: { item: Pick<Item, 'x' | 'y' | 'rot' | 'kind' | 'defId'> }) {
  const [dx, dy] = doorInside(item.x, item.y, baseSize(item.kind, item.defId), item.rot)
  return (
    <div className="door-cell" style={{ left: (dx - item.x) * TILE, top: (dy - item.y) * TILE, width: TILE, height: TILE }}>
      <div className="door" style={DOOR_BAR[item.rot]} />
    </div>
  )
}

function ItemView({ game, item, accessible, selected, flashN, hidden }: {
  game: GameState; item: Item; accessible: boolean; selected: boolean; flashN: number; hidden: boolean
}) {
  const fp = itemSize(item)
  const u = item.unit
  const powered = isPowered(game, item)
  const cls = ['item', item.kind, selected && 'selected', !powered && itemDraw(item) > 0 && 'unpowered', hidden && 'held'].filter(Boolean).join(' ')
  let status: React.ReactNode = null
  if (u) {
    const t = u.tenant
    if (u.status === 'vacant') status = <span className="st muted">vacant</span>
    else if (u.status === 'occupied' && t) status = (
      <span className="st">{t.vip && '👑'}{t.anger >= ANGER_GRACE && '😠'}{t.name}</span>
    )
    else if (u.status === 'dirty') status = <span className="st">🧹 dirty</span>
    else if (u.status === 'abandoned') status = <span className="st">🏚️ abandoned</span>
    else if (u.status === 'auction') status = <span className="st">🔨 {Math.max(0, Math.ceil(((u.auctionEndsAt ?? 0) - game.time) / 60))}m</span>
  }
  const progress = u?.status === 'occupied' ? u.progress / unitDef(item.defId).timer : 0
  return (
    <div key={flashN} className={cls + (flashN ? ' flash' : '')}
      style={{ left: item.x * TILE, top: item.y * TILE, width: fp.w * TILE, height: fp.h * TILE, background: defColor(item.kind, item.defId) }}>
      {hasDoor(item.kind) && <DoorMarker item={item} />}
      <div className="item-body">
        <span className="lbl">{item.kind === 'unit' ? item.label : ICONS[item.kind]}</span>
        {item.kind !== 'unit' && fp.w * fp.h > 1 && <span className="st">{item.label}</span>}
        {status}
        {item.kind === 'office' && <span className="st">{game.staff.length ? '🧹'.repeat(game.staff.length) : 'no staff'}</span>}
      </div>
      {u && u.pending > 0 && <div className="pending">{money(u.pending)}</div>}
      {hasDoor(item.kind) && !accessible && u?.status !== 'auction' && <div className="badge blocked" title="Door can't be reached from the gate">⛔</div>}
      {!powered && itemDraw(item) > 0 && <div className="badge off" title="No power">⚡</div>}
      {progress > 0 && <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>}
    </div>
  )
}

function Ghost({ game }: { game: GameState }) {
  const p = useStore(s => s.placing)!
  const fp = placingSize(p)
  const ignore = p.itemId ? [p.itemId] : undefined
  const ok = canPlace(game, p.kind, p.defId, p.x, p.y, p.rot, ignore)
  return (
    <div className={`ghost ${ok ? 'ok' : 'bad'}`} style={{ left: p.x * TILE, top: p.y * TILE, width: fp.w * TILE, height: fp.h * TILE }}>
      {hasDoor(p.kind) && <DoorMarker item={{ x: p.x, y: p.y, rot: p.rot, kind: p.kind, defId: p.defId }} />}
    </div>
  )
}
