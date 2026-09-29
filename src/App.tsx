import { useEffect } from 'react'
import { useStore } from './store'
import { GridView } from './ui/GridView'
import { Hud, Nav } from './ui/Hud'
import { SidePanel } from './ui/Panels'
import { DebugPanel, LevelOverModal, OfflineSummaryModal, PlacementBar, TitleScreen, Toasts } from './ui/Overlays'
import { cancelPlacing, rotatePlacing } from './ui/placing'
import { NAV } from './ui/nav'
import { CameraPlacementBar } from './ui/cameraUi'
import { cancelCamPlacing, rotateCamPlacing } from './ui/camPlacing'

const TICK_MS = 200
const SAVE_MS = 5000

export default function App() {
  const screen = useStore(s => s.screen)

  // Game loop + autosave.
  useEffect(() => {
    if (screen !== 'game') return
    let last = performance.now()
    const loop = setInterval(() => {
      const now = performance.now()
      useStore.getState().tick(Math.min(5, (now - last) / 1000))
      last = now
    }, TICK_MS)
    const save = () => useStore.getState().save()
    const autosave = setInterval(save, SAVE_MS)
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    window.addEventListener('beforeunload', save)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(loop)
      clearInterval(autosave)
      window.removeEventListener('beforeunload', save)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [screen])

  // Keyboard: R rotate, Esc cancel/deselect, ` debug.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const s = useStore.getState()
      if (s.screen !== 'game') return
      // Numpad digits work whether NumLock is on or off.
      const numpad = /^Numpad([1-9])$/.exec(e.code)
      const digit = numpad ? numpad[1] : /^[1-9]$/.test(e.key) ? e.key : null
      if (e.key === 'r' || e.key === 'R') {
        if (s.camPlacing) rotateCamPlacing()
        else rotatePlacing()
      } else if (e.key === 'Escape') {
        // Back out of whatever you're in, one layer at a time.
        if (s.summary) s.set({ summary: null })
        else if (s.camPlacing) cancelCamPlacing()
        else if (s.placing) cancelPlacing()
        else if (s.selectedCamId) s.set({ selectedCamId: null })
        else if (s.selectedId) s.set({ selectedId: null })
        else if (s.menu) s.set({ menu: null })
        else if (s.cameraView) s.set({ cameraView: false })
        else if (s.debugOpen) s.set({ debugOpen: false })
      } else if (e.key === '`') s.set({ debugOpen: !s.debugOpen })
      else if ((e.key === 'c' || e.key === 'C') && !s.camPlacing) s.set({ cameraView: !s.cameraView, selectedCamId: null })
      else if (digit) {
        const nav = NAV[Number(digit) - 1]
        if (nav) s.set({ menu: s.menu === nav.id ? null : nav.id })
        e.preventDefault()
      } else if (e.key === '+' || e.code === 'NumpadAdd' || e.key === 'PageUp') {
        s.set({ viewCmd: { type: 'zoomIn', n: Date.now() } })
        e.preventDefault()
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.key === 'PageDown') {
        s.set({ viewCmd: { type: 'zoomOut', n: Date.now() } })
        e.preventDefault()
      }
      else if (e.key === '=') s.set({ viewCmd: { type: 'fit', n: Date.now() } })
      else if (e.key.startsWith('Arrow')) {
        const step = 60
        const [dx, dy] = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key] ?? [0, 0]
        s.set({ viewCmd: { type: 'pan', dx, dy, n: Date.now() + Math.random() } })
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (screen === 'title') return <TitleScreen />

  return (
    <div className="app">
      <Hud />
      <div className="main">
        <Nav />
        <SidePanel />
        <div className="stage">
          <GridView />
          <Toasts />
          <PlacementBar />
          <CameraPlacementBar />
          <DebugPanel />
        </div>
      </div>
      <OfflineSummaryModal />
      <LevelOverModal />
    </div>
  )
}
