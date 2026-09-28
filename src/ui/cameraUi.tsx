import { useStore } from '../store'
import type { GameState } from '../game/types'
import { CAMERA_DIRS, type CameraDef } from '../data/cameras'
import {
  cameraActive, cameraDef, cameraUpgradeCost, canMountCamera, securityBlocker,
  sellCamera, toggleCamera, upgradeCamera, cameraSellValue,
} from '../game/cameras'
import { cancelCamPlacing, commitCamPlacing, rotateCamPlacing, startCameraMove } from './camPlacing'
import { money } from '../game/format'
import { notice } from './notice'
import { TILE } from './GridView'
import { useDraggablePopup } from './drag'
import { useEffect, useState } from 'react'

// ---- Drawing ----

/** The camera's view as an SVG shape: a pie slice, or a circle for domes. */
function viewShape(x: number, y: number, dir: number, def: CameraDef, fill: string, stroke: string, key: string | number) {
  const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE, r = def.range * TILE
  if (def.fov >= 360) return <circle key={key} cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={2} />
  const face = (dir * 360) / CAMERA_DIRS
  const a0 = ((face - def.fov / 2) * Math.PI) / 180, a1 = ((face + def.fov / 2) * Math.PI) / 180
  const large = def.fov > 180 ? 1 : 0
  const d = `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`
  return <path key={key} d={d} fill={fill} stroke={stroke} strokeWidth={2} />
}

export function CameraLayer({ game }: { game: GameState }) {
  const cameraView = useStore(s => s.cameraView)
  const camPlacing = useStore(s => s.camPlacing)
  const selectedCamId = useStore(s => s.selectedCamId)
  const w = game.size * TILE
  const showViews = cameraView || !!camPlacing
  const ok = camPlacing ? canMountCamera(game, camPlacing.x, camPlacing.y, camPlacing.camId) : false
  return (
    <svg className="camera-layer" width={w} height={w} viewBox={`0 0 ${w} ${w}`}>
      <defs><clipPath id="lot-clip"><rect x={0} y={0} width={w} height={w} /></clipPath></defs>
      <g clipPath="url(#lot-clip)">
      {showViews && game.cameras.map(c => {
        if (camPlacing?.camId === c.id) return null
        const active = cameraActive(game, c)
        const sel = c.id === selectedCamId
        return viewShape(c.x, c.y, c.dir, cameraDef(c.defId),
          active ? `rgba(91,157,255,${sel ? 0.32 : 0.18})` : 'rgba(160,160,160,0.12)',
          sel ? '#fff' : active ? 'rgba(91,157,255,0.6)' : 'rgba(160,160,160,0.4)', `v${c.id}`)
      })}
      {camPlacing && viewShape(camPlacing.x, camPlacing.y, camPlacing.dir, cameraDef(camPlacing.defId),
        ok ? 'rgba(63,191,127,0.28)' : 'rgba(226,85,90,0.28)', ok ? '#3fbf7f' : '#e2555a', 'ghost')}
      </g>
      {game.cameras.map(c => (camPlacing?.camId === c.id ? null : (
        <g key={c.id} opacity={cameraActive(game, c) ? 1 : 0.5}>
          <circle cx={(c.x + 0.5) * TILE} cy={(c.y + 0.5) * TILE} r={10} fill="#111" stroke={c.id === selectedCamId ? '#fff' : '#5b9dff'} strokeWidth={2} />
          <text x={(c.x + 0.5) * TILE} y={(c.y + 0.5) * TILE + 4} fontSize={11} textAnchor="middle">{cameraDef(c.defId).fov >= 360 ? '◉' : '📹'}</text>
        </g>
      )))}
      {camPlacing && (
        <circle cx={(camPlacing.x + 0.5) * TILE} cy={(camPlacing.y + 0.5) * TILE} r={10} fill={ok ? '#3fbf7f' : '#e2555a'} stroke="#111" strokeWidth={2} />
      )}
    </svg>
  )
}

// ---- Popups & bars ----

export function CameraPlacementBar() {
  const p = useStore(s => s.camPlacing)
  const { ref, handlers, pinStyle, lifted, pin, unpin } = useDraggablePopup('placement')
  if (!p) return null
  const def = cameraDef(p.defId)
  return (
    <div ref={ref} className={`placement-bar ${lifted ? 'lifted' : ''}`} style={pinStyle} {...handlers}>
      <span className="drag-handle" data-drag-handle>
        <b>{p.mode === 'move' ? 'Moving' : 'Placing'} {def.name}</b>{p.mode === 'new' && <> · {money(def.cost)} · +{def.power}⚡</>}
      </span>
      <span className="small muted hide-mobile">Mount on a unit or sign · R rotate · Esc cancel</span>
      <div className="actions">
        <button onClick={rotateCamPlacing}>⟳ Rotate</button>
        <button className="good" onClick={commitCamPlacing}>✔ Place</button>
        <button className="bad" onClick={cancelCamPlacing}>✕ {p.mode === 'new' ? 'Done' : 'Cancel'}</button>
        {pin && <button onClick={unpin} aria-label="Unpin">📌↺</button>}
      </div>
    </div>
  )
}

export function CameraPanel() {
  const g = useStore(s => s.game)!
  const id = useStore(s => s.selectedCamId)
  const set = useStore(s => s.set)
  const mutate = useStore(s => s.mutate)
  const { ref, handlers, pinStyle, lifted, pin, unpin } = useDraggablePopup('selection')
  const [armSell, setArmSell] = useState(false)
  useEffect(() => {
    if (!armSell) return
    const t = setTimeout(() => setArmSell(false), 3000)
    return () => clearTimeout(t)
  }, [armSell])
  const c = g.cameras.find(k => k.id === id)
  if (!c) return null
  const def = cameraDef(c.defId)
  const blocker = securityBlocker(g)
  const up = cameraUpgradeCost(c)
  return (
    <div ref={ref} className={`selection anchored cam-panel ${pin ? 'pinned' : ''} ${lifted ? 'lifted' : ''}`} style={{ left: 12, top: 12, width: 320, ...pinStyle }} {...handlers}>
      <div className="row drag-handle" data-drag-handle>
        <strong>{fovIcon(def)} {def.name}</strong>
        <span>
          {pin && <button className="icon-btn" onClick={unpin} aria-label="Unpin">📌↺</button>}
          <button className="icon-btn" onClick={() => set({ selectedCamId: null })} aria-label="Close">✕</button>
        </span>
      </div>
      <div className="small info">
        <div>Range {def.range} tiles · {def.fov >= 360 ? 'sees all around' : `${def.fov}° view`} · {def.power}⚡</div>
        {!c.on ? <div className="muted">Switched off</div> : g.tripped ? <div className="bad">⚡ No power (grid tripped)</div>
          : blocker ? <div className="bad">⚠️ Not recording: {blocker}</div> : <div className="good-text">🔴 Recording</div>}
      </div>
      <div className="actions">
        {def.fov < 360 && <button onClick={() => mutate(s => { const k = s.cameras.find(x => x.id === c.id)!; k.dir = (k.dir + 1) % CAMERA_DIRS })}>⟳ Rotate</button>}
        <button onClick={() => mutate(s => toggleCamera(s, c.id))}>{c.on ? '🔌 Switch off' : '🔌 Switch on'}</button>
        <button onClick={() => startCameraMove(c.id)}>✋ Move</button>
        {up !== undefined && <button disabled={g.money < up} onClick={() => { const e = mutate(s => upgradeCamera(s, c.id)); if (e) notice(e) }}>⬆️ {cameraDef(def.next!).name} ({money(up)})</button>}
        <button className={`bad ${armSell ? 'armed' : ''}`} onClick={() => {
          if (!armSell) return setArmSell(true)
          mutate(s => sellCamera(s, c.id))
          set({ selectedCamId: null })
        }}>{armSell ? `Tap again to sell (${money(cameraSellValue(c))})` : `💲 Sell (${money(cameraSellValue(c))})`}</button>
      </div>
    </div>
  )
}

const fovIcon = (d: CameraDef) => (d.fov >= 360 ? '◉' : '📹')
