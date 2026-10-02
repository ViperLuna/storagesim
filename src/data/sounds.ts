// Sound effects. Files live in public/sounds/; a missing file just plays nothing.

export type SoundId = 'prospect' | 'vip'

export interface SoundDef {
  file: string
  /** 0–1, on top of the player's volume setting. */
  volume: number
}

export const SOUNDS: Record<SoundId, SoundDef> = {
  prospect: { file: 'doorbell.mp3', volume: 0.8 },
  // TODO: Westminster chimes once we have a file. Doorbell until then so VIPs aren't silent.
  vip: { file: 'doorbell.mp3', volume: 0.8 },
}

export const DEFAULT_VOLUME = 0.7
