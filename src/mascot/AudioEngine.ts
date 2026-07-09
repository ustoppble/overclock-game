import { appAudioBurst, appAudioStarted, appAudioStopped } from '../shim/appAudioActive';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;

  // Stored active charging nodes to modulate dynamically
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private chargeLfo: OscillatorNode | null = null;
  // F-084.1: true enquanto o charge segura o contador global "app emitindo som"
  private chargeCounted = false;

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn("Failed to initialize Web Audio API", e);
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (!muted) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } else {
      this.stopCharge();
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  startCharge(rageMultiplier: number) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    this.stopCharge();

    try {
      const now = this.ctx.currentTime;

      // Base carrier: retro sawtooth wave matching vintage DBZ feel
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      
      const baseFreq = 50 + (rageMultiplier * 10);
      osc.frequency.setValueAtTime(baseFreq, now);
      // Frequency ramps up to simulate gathering power
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 10);

      // Low pass filter with high resonance to create the "wah-wah / rising energy" aura sweep
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(10 + rageMultiplier, now);
      filter.frequency.setValueAtTime(120, now);
      filter.frequency.exponentialRampToValueAtTime(1200 + (rageMultiplier * 200), now + 4);

      // LFO (Low Frequency Oscillator) to modulate filter sweep for that classic throbbing aura sound
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(6 + (rageMultiplier / 2), now); // 6Hz pulsing

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(200, now);

      // Gain node for absolute volume
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.12 + (rageMultiplier * 0.01), now + 0.8);

      // Connect LFO modulation
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Main signal chain
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      // Start nodes
      osc.start(now);
      lfo.start(now);

      this.chargeOsc = osc;
      this.chargeGain = gainNode;
      this.chargeLfo = lfo;
      if (!this.chargeCounted) { appAudioStarted(); this.chargeCounted = true; }
    } catch (e) {
      console.error("Audio: startCharge failed", e);
    }
  }

  modulateCharge(rageMultiplier: number) {
    if (this.isMuted || !this.ctx || !this.chargeOsc) return;
    try {
      const now = this.ctx.currentTime;
      const targetFreq = 50 + (rageMultiplier * 15);
      this.chargeOsc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.1);
      if (this.chargeGain) {
        this.chargeGain.gain.linearRampToValueAtTime(0.12 + (rageMultiplier * 0.01), now + 0.1);
      }
    } catch (e) {}
  }

  stopCharge() {
    if (this.chargeOsc) {
      try {
        const osc = this.chargeOsc;
        const lfo = this.chargeLfo;
        const gain = this.chargeGain;
        if (this.ctx) {
          const now = this.ctx.currentTime;
          gain?.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          setTimeout(() => {
            try {
              osc.stop();
              lfo?.stop();
            } catch (e) {}
          }, 200);
        }
      } catch (e) {}
      this.chargeOsc = null;
      this.chargeGain = null;
      this.chargeLfo = null;
    }
    if (this.chargeCounted) {
      this.chargeCounted = false;
      // fade-out de 0.15s + stop dos nodes em 200ms — libera o gate depois do rabo
      setTimeout(() => appAudioStopped(), 200);
    }
  }

  playCrackle() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Synthesize noise buffer
      const bufferSize = this.ctx.sampleRate * 0.05; // Short 50ms clip
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(8000, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start(now);
      appAudioBurst(100); // clip 50ms + decay
    } catch (e) {}
  }

  playBlast() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    this.stopCharge();

    try {
      const now = this.ctx.currentTime;

      // 1. Synthesize heavy white noise explosion
      const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds blast
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      // 2. Play low sub-bass hum for laser rumble
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.setValueAtTime(70, now + 0.2);
      osc.frequency.linearRampToValueAtTime(30, now + 1.1);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      noiseNode.start(now);
      osc.start(now);
      osc.stop(now + 1.3);
      appAudioBurst(1500); // blast 1.5s (gain decai até 1.4s)
    } catch (e) {}
  }

  playDash() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.25; // 250ms whoosh
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(4, now);
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.15);
      filter.frequency.linearRampToValueAtTime(500, now + 0.25);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start(now);
      appAudioBurst(300); // whoosh 250ms
    } catch (e) {}
  }

  playSteam() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 1.8; // 1.8 seconds long hiss
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4500, now);
      filter.frequency.linearRampToValueAtTime(3000, now + 1.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start(now);
      appAudioBurst(1800); // hiss 1.8s
    } catch (e) {}
  }
}

export const audioEngine = new AudioEngine();
