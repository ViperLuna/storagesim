import { useStore } from '../store'

/** Quick one-off toast that isn't part of the game log (e.g. "Not enough money"). */
export function notice(text: string) {
  const s = useStore.getState()
  const id = -Date.now()
  s.set({ toasts: [...s.toasts, { id, entry: { id, time: 0, text, tone: 'bad' as const } }].slice(-5) })
}
