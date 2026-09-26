import { create } from 'zustand'
import type { GameState, ItemKind, LogEntry, OfflineSummary, Rot } from './game/types'
import { createRun } from './game/init'
import { catchUp, step } from './game/sim'

const SAVE_KEY = 'storagesim.save.v1'

export type Menu = 'build' | 'tenants' | 'staff' | 'money' | 'rebirth' | 'log' | 'settings' | null

export interface Placing {
  mode: 'new' | 'move' | 'upgrade'
  kind: ItemKind
  defId: string
  rot: Rot
  x: number
  y: number
  /** Item being moved/upgraded. */
  itemId?: number
}

export interface Toast { id: number; entry: LogEntry }

interface Store {
  screen: 'title' | 'game'
  game: GameState | null
  menu: Menu
  placing: Placing | null
  selectedId: number | null
  toasts: Toast[]
  lastToastLogId: number
  flash: { id: number; n: number } | null
  fitRequest: number
  summary: OfflineSummary | null
  debugOpen: boolean
  showReach: boolean
  timeScale: number

  hasSave: () => boolean
  newGame: () => void
  continueGame: () => void
  quitToTitle: () => void
  /** Apply a change to the game state (copy-on-write). */
  mutate: <R>(fn: (g: GameState) => R) => R
  replaceGame: (g: GameState) => void
  tick: (dt: number) => void
  save: () => void
  set: (partial: Partial<Store>) => void
  focusItem: (id: number) => void
  dismissToast: (id: number) => void
}

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Bring older saves up to the current shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(g: any): GameState | null {
  if (g.version === 1) {
    Object.assign(g, { version: 2, staff: [], upgrades: {}, bankruptStrikes: 0, cashAtLastPayroll: g.money })
  }
  if (g.version === 2) {
    // v0.2 bug: offline catch-up could sink your rating to zero and end the level while you slept.
    // Pardon anyone it happened to.
    if (g.levelOver === 'rating') {
      g.levelOver = undefined
      g.rating = Math.max(g.rating, 1)
      g.ratingAtLastTick = g.rating
      g.failStrikes = 0
    }
    g.version = 3
  }
  if (g.version === 3) {
    g.playerClean = { queue: [], left: 0, total: 0 }
    g.version = 4
  }
  return g.version === 4 ? (g as GameState) : null
}

function writeSave(g: GameState) {
  try {
    g.lastSaved = Date.now()
    localStorage.setItem(SAVE_KEY, JSON.stringify(g))
  } catch { /* storage blocked — play on without saving */ }
}

const maxLogId = (g: GameState) => g.log.reduce((m, e) => Math.max(m, e.id), 0)

export const useStore = create<Store>((set, get) => ({
  screen: 'title',
  game: null,
  menu: null,
  placing: null,
  selectedId: null,
  toasts: [],
  lastToastLogId: 0,
  flash: null,
  fitRequest: 0,
  summary: null,
  debugOpen: false,
  showReach: false,
  timeScale: 1,

  hasSave: () => loadSave() !== null,

  newGame: () => {
    const g = createRun(0)
    writeSave(g)
    set({ screen: 'game', game: g, lastToastLogId: maxLogId(g), toasts: [], menu: null, placing: null, selectedId: null, summary: null, fitRequest: get().fitRequest + 1 })
  },

  continueGame: () => {
    const g = loadSave()
    if (!g) return get().newGame()
    const away = (Date.now() - g.lastSaved) / 1000
    let summary: OfflineSummary | null = null
    if (away > 30 && !g.levelOver) {
      summary = catchUp(g, away)
      if (summary.rent === 0 && summary.leasesEnded === 0 && summary.ragequit === 0 && summary.auctions === 0) summary = null
    }
    writeSave(g)
    set({ screen: 'game', game: g, lastToastLogId: maxLogId(g), toasts: [], summary, menu: null, placing: null, selectedId: null, fitRequest: get().fitRequest + 1 })
  },

  quitToTitle: () => {
    const g = get().game
    if (g) writeSave(g)
    set({ screen: 'title', game: null, placing: null, selectedId: null, menu: null, toasts: [] })
  },

  mutate: (fn) => {
    const g = get().game
    if (!g) throw new Error('No game')
    const next = structuredClone(g)
    const r = fn(next)
    get().replaceGame(next)
    return r
  },

  replaceGame: (next) => {
    const { lastToastLogId, toasts } = get()
    const fresh = next.log.filter(e => e.id > lastToastLogId && e.toast)
    set({
      game: next,
      lastToastLogId: Math.max(lastToastLogId, maxLogId(next)),
      toasts: fresh.length ? [...toasts, ...fresh.map(e => ({ id: e.id, entry: e }))].slice(-5) : toasts,
    })
  },

  tick: (dt) => {
    const g = get().game
    if (!g || g.levelOver) return
    get().mutate(s => step(s, dt * get().timeScale))
  },

  save: () => {
    const g = get().game
    if (g) writeSave(g)
  },

  set: (partial) => set(partial),

  focusItem: (id) => set({ flash: { id, n: (get().flash?.n ?? 0) + 1 }, selectedId: id }),

  dismissToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}))

export function resetSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
}
