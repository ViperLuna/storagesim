// Security cameras. They live on their own layer, mounted on units or the sign.
// They see through buildings: if the view reaches a tile, it's watched.

export interface CameraDef {
  id: string
  name: string
  cost: number
  /** Reach in tiles, measured from the camera's tile center. */
  range: number
  /** Field of view in degrees (360 = dome). */
  fov: number
  /** Flat draw, same for every tier. */
  power: number
  unlockRebirth: number
  /** Next tier for the Upgrade button. */
  next?: string
}

export const CAMERAS: CameraDef[] = [
  { id: 'cam-basic', name: 'Cheap Camera', cost: 400, range: 2.5, fov: 60, power: 0.25, unlockRebirth: 5, next: 'cam-hd' },
  { id: 'cam-hd', name: 'HD Camera', cost: 2500, range: 4, fov: 90, power: 0.25, unlockRebirth: 5, next: 'cam-dome' },
  { id: 'cam-dome', name: '360° Dome', cost: 10000, range: 3.5, fov: 360, power: 0.25, unlockRebirth: 5 },
]

/** Directions a camera can face: 8, every 45°. 0 = right, 2 = down, 4 = left, 6 = up. */
export const CAMERA_DIRS = 8

// ---- Burglaries ----
export const BURGLARY_UNLOCK_REBIRTH = 5
/** Average seconds between burglary attempts (only while you're playing). */
export const BURGLARY_MEAN_SECONDS = 600
export const RATING_BURGLARY_HIT = 0.4
export const RATING_BURGLAR_CAUGHT = 0.1
/** Chance the robbed tenant moves out. */
export const BURGLARY_VICTIM_LEAVES = 0.5
/** Chance each tenant next door pulls out too. */
export const BURGLARY_NEIGHBOR_LEAVES = 0.2
