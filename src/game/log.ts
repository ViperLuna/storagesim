import type { GameState, LogEntry } from './types'

const LOG_CAP = 300

export function log(state: GameState, text: string, opts: Partial<Omit<LogEntry, 'id' | 'time' | 'text'>> = {}): void {
  state.log.push({ id: state.nextId++, time: state.time, text, tone: 'info', ...opts })
  if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP)
}
