import { useEffect } from 'react'
import { useStore } from './store'
import { GridView } from './ui/GridView'
import { Hud, Nav } from './ui/Hud'
import { SidePanel } from './ui/Panels'
import { DebugPanel, LevelOverModal, OfflineSummaryModal, PlacementBar, TitleScreen, Toasts } from './ui/Overlays'
import { cancelPlacing, rotatePlacing } from './ui/placing'

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
      const s = useStore.getState()
      if (e.key === 'r' || e.key === 'R') rotatePlacing()
      else if (e.key === 'Escape') {
        if (s.placing) cancelPlacing()
        else if (s.selectedId) s.set({ selectedId: null })
        else if (s.menu) s.set({ menu: null })
      } else if (e.key === '`') s.set({ debugOpen: !s.debugOpen })
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
          <DebugPanel />
        </div>
      </div>
      <OfflineSummaryModal />
      <LevelOverModal />
    </div>
  )
}
