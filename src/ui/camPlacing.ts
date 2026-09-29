import { useStore } from '../store'
import { CAMERA_DIRS } from '../data/cameras'
import { moveCamera, placeCamera } from '../game/cameras'
import { notice } from './notice'

// ---- Placing ----

export function startCameraPlacing(defId: string) {
  const s = useStore.getState()
  const g = s.game!
  s.set({
    camPlacing: { mode: 'new', defId, x: Math.floor(g.size / 2), y: Math.floor(g.size / 2), dir: 2, viewWasOn: s.cameraView },
    cameraView: true, selectedId: null, selectedCamId: null, placing: null,
    menu: window.innerWidth < 760 ? null : s.menu,
  })
}

export function startCameraMove(camId: number) {
  const s = useStore.getState()
  const c = s.game!.cameras.find(k => k.id === camId)!
  s.set({ camPlacing: { mode: 'move', defId: c.defId, x: c.x, y: c.y, dir: c.dir, camId, viewWasOn: s.cameraView }, selectedCamId: null, cameraView: true })
}

export function rotateCamPlacing() {
  const s = useStore.getState()
  if (s.camPlacing) s.set({ camPlacing: { ...s.camPlacing, dir: (s.camPlacing.dir + 1) % CAMERA_DIRS } })
}

export function cancelCamPlacing() {
  const s = useStore.getState()
  const p = s.camPlacing
  if (p) s.set({ camPlacing: null, selectedCamId: p.camId ?? null, cameraView: p.viewWasOn || p.camId !== undefined })
}

export function commitCamPlacing() {
  const s = useStore.getState()
  const p = s.camPlacing
  if (!p) return
  const err = s.mutate(g => (p.mode === 'new' ? placeCamera(g, p.defId, p.x, p.y, p.dir) : moveCamera(g, p.camId!, p.x, p.y, p.dir)))
  if (err) return notice(err)
  // Keep the tool for quick camera spam; moves end here.
  if (p.mode === 'move') s.set({ camPlacing: null, selectedCamId: p.camId!, cameraView: true })
}

