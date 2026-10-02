import { DEFAULT_VOLUME, SOUNDS, type SoundId } from './data/sounds'

// Browsers block sound until the player interacts. The title screen's button calls unlockAudio().
let ctx: AudioContext | null = null

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* no audio support */ }
}

export const audioContext = () => ctx

// Player settings, kept outside the save so a reset doesn't unmute you.
const VOLUME_KEY = 'storagesim.volume'
const MUTED_KEY = 'storagesim.muted'

function readSetting(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeSetting(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function getVolume(): number {
  const v = Number(readSetting(VOLUME_KEY))
  return readSetting(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME
}
export const setVolume = (v: number) => writeSetting(VOLUME_KEY, String(v))
export const isMuted = () => readSetting(MUTED_KEY) === '1'
export const setMuted = (m: boolean) => writeSetting(MUTED_KEY, m ? '1' : '0')

// Decoded once per file. null = failed to load (missing file), so we don't keep retrying.
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function load(c: AudioContext, file: string) {
  let p = buffers.get(file)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}sounds/${file}`)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then(b => c.decodeAudioData(b))
      .catch(() => null)
    buffers.set(file, p)
  }
  return p
}

export function playSound(id: SoundId) {
  const c = ctx
  if (!c || isMuted()) return
  const def = SOUNDS[id]
  const gain = def.volume * getVolume()
  if (gain <= 0) return
  void load(c, def.file).then(buf => {
    if (!buf) return
    const src = c.createBufferSource()
    const g = c.createGain()
    g.gain.value = gain
    src.buffer = buf
    src.connect(g).connect(c.destination)
    src.start()
  })
}
