// Browsers block sound until the player interacts. The title screen's button calls unlockAudio().
let ctx: AudioContext | null = null

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* no audio support */ }
}

export const audioContext = () => ctx
