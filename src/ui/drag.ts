import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'

/** Where the player has pinned each draggable popup this session (not saved). */
type Pin = { x: number; y: number; w: number }

const usePins = create<{ pins: Record<string, Pin>; setPin: (k: string, p?: Pin) => void }>(set => ({
  pins: {},
  setPin: (k, p) => set(s => {
    const pins = { ...s.pins }
    if (p) pins[k] = p
    else delete pins[k]
    return { pins }
  }),
}))

const LONG_PRESS_MS = 400
const CANCEL_MOVE = 10

/**
 * Long-press anywhere on the popup (or grab its [data-drag-handle] with a mouse) to drag it.
 * Quick taps and short drags behave normally. The spot is remembered for the session.
 */
export function useDraggablePopup(key: string) {
  const pin = usePins(s => s.pins[key])
  const setPin = usePins(s => s.setPin)
  const [lifted, setLifted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const st = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; w: number; timer?: number; dragging: boolean; justDragged: boolean } | null>(null)

  useEffect(() => () => { if (st.current?.timer) clearTimeout(st.current.timer) }, [])

  const startDrag = () => {
    const s = st.current
    if (!s) return
    s.dragging = true
    setLifted(true)
    navigator.vibrate?.(15)
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      const el = ref.current
      if (!el) return
      // Measure where it actually is on screen (handles centering transforms and docked layouts).
      const r = el.getBoundingClientRect()
      const pr = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 }
      st.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left - pr.left, oy: r.top - pr.top, w: r.width, dragging: false, justDragged: false }
      const onHandle = !!(e.target as HTMLElement).closest('[data-drag-handle]') && !(e.target as HTMLElement).closest('button')
      if (e.pointerType === 'mouse' && onHandle) {
        el.setPointerCapture(e.pointerId)
        startDrag()
      } else {
        st.current.timer = window.setTimeout(() => {
          el.setPointerCapture(e.pointerId)
          startDrag()
        }, LONG_PRESS_MS)
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = st.current
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.sx, dy = e.clientY - s.sy
      if (!s.dragging) {
        if (Math.hypot(dx, dy) > CANCEL_MOVE) clearTimeout(s.timer)
        return
      }
      const el = ref.current!
      const parent = el.offsetParent as HTMLElement | null
      const pw = parent?.clientWidth ?? window.innerWidth, ph = parent?.clientHeight ?? window.innerHeight
      // Keep the size it had when grabbed — otherwise it re-flows wider once it's off-center.
      setPin(key, {
        x: Math.max(0, Math.min(pw - s.w, s.ox + dx)),
        y: Math.max(0, Math.min(ph - el.offsetHeight, s.oy + dy)),
        w: s.w,
      })
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      const s = st.current
      if (!s) return
      clearTimeout(s.timer)
      if (s.dragging) s.justDragged = true
      s.dragging = false
      setLifted(false)
    },
    onPointerCancel: () => {
      const s = st.current
      if (s) clearTimeout(s.timer)
      st.current = null
      setLifted(false)
    },
    // Letting go after a drag shouldn't also press whatever button is under your finger.
    onClickCapture: (e: React.MouseEvent) => {
      if (st.current?.justDragged) {
        e.stopPropagation()
        e.preventDefault()
        st.current.justDragged = false
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }

  return {
    ref,
    handlers,
    pin,
    lifted,
    /** Style overrides when pinned somewhere by the player. */
    pinStyle: pin
      ? ({ left: pin.x, top: pin.y, right: 'auto', bottom: 'auto', transform: 'none', width: pin.w, maxWidth: 'none', '--pin-x': `${pin.x}px`, '--pin-y': `${pin.y}px`, '--pin-w': `${pin.w}px` } as React.CSSProperties)
      : undefined,
    unpin: () => setPin(key, undefined),
  }
}
