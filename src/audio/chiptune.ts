/**
 * Chiptune engine — música e SFX 100% WebAudio (zero assets), estilo GBA.
 * Autoplay policy: só toca depois da 1ª interação (unlock()).
 */

type Wave = OscillatorType

class Chiptune {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private unlocked = false
  private muted = false
  private track: 'world' | 'battle' | 'none' = 'none'
  private step = 0
  private timer: number | null = null

  unlock() {
    if (this.unlocked) return
    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.16
      this.musicGain.connect(this.master)
      this.unlocked = true
      this.startSequencer()
    } catch { /* sem áudio */ }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5
    return this.muted
  }

  setTrack(t: 'world' | 'battle' | 'none') {
    if (this.track === t) return
    this.track = t
    this.step = 0
  }

  // ── SFX ────────────────────────────────────────────────────────────────
  private tone(freq: number, dur: number, wave: Wave, vol: number, slide = 0) {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = wave
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + dur + 0.02)
  }
  private noise(dur: number, vol: number) {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = vol
    src.connect(g); g.connect(this.master)
    src.start(t)
  }

  nav() { this.tone(880, 0.05, 'square', 0.06) }
  confirm() { this.tone(660, 0.06, 'square', 0.08); setTimeout(() => this.tone(990, 0.09, 'square', 0.08), 55) }
  back() { this.tone(440, 0.08, 'square', 0.06, -180) }
  blip() { this.tone(1200, 0.015, 'square', 0.025) } // typewriter
  hit() { this.noise(0.12, 0.12); this.tone(220, 0.12, 'sawtooth', 0.1, -120) }
  superHit() { this.noise(0.2, 0.16); this.tone(180, 0.22, 'sawtooth', 0.14, -140); setTimeout(() => this.tone(90, 0.25, 'square', 0.1, -40), 60) }
  hurt() { this.tone(300, 0.18, 'triangle', 0.1, -200) }
  hallucinate() { this.tone(520, 0.4, 'sine', 0.09, -300); setTimeout(() => this.tone(470, 0.4, 'sine', 0.07, -260), 120) }
  footstep() { this.noise(0.03, 0.018) }
  encounter() { for (let i = 0; i < 4; i++) setTimeout(() => this.tone(200 + i * 160, 0.09, 'square', 0.1), i * 70) }
  victory() {
    const notes = [523, 523, 523, 659, 784, 1046]
    notes.forEach((n, i) => setTimeout(() => this.tone(n, i === notes.length - 1 ? 0.5 : 0.12, 'square', 0.1), i * 110))
  }
  gameover() { const notes = [392, 370, 349, 330]; notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.3, 'triangle', 0.1), i * 220)) }
  levelup() { const notes = [523, 659, 784, 1046, 1318]; notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.14, 'square', 0.09), i * 90)) }

  // ── Música (sequenciador de 16 steps) ─────────────────────────────────
  private mtone(freq: number, dur: number, wave: Wave, vol: number) {
    if (!this.ctx || !this.musicGain || this.muted || freq <= 0) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = wave
    o.frequency.value = freq
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(this.musicGain)
    o.start(t); o.stop(t + dur + 0.02)
  }

  private startSequencer() {
    if (this.timer) return
    // MUNDO: valsa calma em Am (arpejo) · BATALHA: baixo dirigido + melodia tensa
    const N = { A2: 110, C3: 130.8, E3: 164.8, G3: 196, A3: 220, B3: 246.9, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, B4: 493.9 }
    const worldBass = [N.A2, 0, N.E3, 0, N.C3, 0, N.G3, 0, N.A2, 0, N.E3, 0, N.G3, 0, N.E3, 0]
    const worldArp = [N.A3, N.C4, N.E4, N.C4, N.A3, N.C4, N.E4, N.G4, N.F4, N.A4, N.C5, N.A4, N.G4, N.B4, N.D4, N.B3]
    const battleBass = [N.A2, N.A2, 0, N.A2, N.C3, 0, N.A2, 0, N.G3, N.G3, 0, N.G3, N.E3, 0, N.E3, N.G3]
    const battleMel = [N.A4, 0, N.C5, 0, N.B4, N.A4, 0, N.E4, N.G4, 0, N.B4, 0, N.A4, N.G4, N.E4, 0]
    this.timer = window.setInterval(() => {
      if (this.track === 'none' || this.muted || !this.ctx) return
      const s = this.step % 16
      if (this.track === 'world') {
        if (worldBass[s]) this.mtone(worldBass[s], 0.34, 'triangle', 0.5)
        if (s % 2 === 0 && worldArp[s]) this.mtone(worldArp[s], 0.18, 'square', 0.16)
        if (s % 8 === 0) this.noise(0.02, 0.008)
      } else {
        if (battleBass[s]) this.mtone(battleBass[s], 0.16, 'sawtooth', 0.32)
        if (battleMel[s]) this.mtone(battleMel[s], 0.14, 'square', 0.2)
        if (s % 4 === 2) this.noise(0.03, 0.02)
      }
      this.step++
    }, this.trackTempo())
  }
  private trackTempo() { return 165 } // ~91bpm em 16ths

  get isMuted() { return this.muted }
}

export const chiptune = new Chiptune()
