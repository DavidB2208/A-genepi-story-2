(() => {
  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.heartbeatPhase = 0;
      this.ambienceGain = null;
    }

    init() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.05;
      this.ambienceGain.connect(this.master);
      this.startAmbienceNoise();
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
      return this.muted;
    }

    tone(freq = 220, dur = 0.15, type = 'sine', vol = 0.18) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    noiseBurst(dur = 0.2, vol = 0.14) {
      if (!this.ctx) return;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(this.master);
      src.start();
    }

    playEvent(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'ariel-warning':
          this.tone(120, 0.25, 'sawtooth', 0.2);
          this.tone(95, 0.35, 'triangle', 0.15);
          break;
        case 'ariel-danger':
          this.tone(80, 0.5, 'square', 0.22);
          break;
        case 'noa-warning':
          this.noiseBurst(0.25, 0.18);
          this.tone(330, 0.15, 'triangle', 0.12);
          break;
        case 'noa-breach':
          this.tone(620, 0.1, 'sawtooth', 0.16);
          this.tone(280, 0.3, 'square', 0.15);
          break;
        case 'yardena-knock':
          this.tone(160, 0.08, 'square', 0.15);
          break;
        case 'yardena-break':
          this.noiseBurst(0.3, 0.2);
          this.tone(70, 0.4, 'sawtooth', 0.2);
          break;
        case 'interact':
          this.tone(520, 0.06, 'triangle', 0.08);
          break;
        case 'drop':
          this.tone(180, 0.07, 'triangle', 0.08);
          break;
        case 'night-clear':
          this.tone(440, 0.14, 'sine', 0.12);
          this.tone(660, 0.2, 'sine', 0.12);
          break;
        default:
          break;
      }
    }

    updateStress(stress, dt) {
      if (!this.ctx) return;
      this.heartbeatPhase += dt * (0.5 + stress / 80);
      const pulse = Math.max(0, Math.sin(this.heartbeatPhase * Math.PI * 2));
      const t = this.ctx.currentTime;
      const target = 0.03 + (stress / 100) * 0.15 * pulse;
      this.ambienceGain.gain.setTargetAtTime(0.03 + stress / 220, t, 0.15);

      if (pulse > 0.98 && stress > 35) {
        this.tone(55 + stress * 0.4, 0.07, 'sine', target);
      }
    }

    startAmbienceNoise() {
      if (!this.ctx) return;
      const node = this.ctx.createScriptProcessor(1024, 1, 1);
      node.onaudioprocess = (ev) => {
        const out = ev.outputBuffer.getChannelData(0);
        for (let i = 0; i < out.length; i += 1) {
          out[i] = (Math.random() * 2 - 1) * 0.02;
        }
      };
      node.connect(this.ambienceGain);
      this.noiseNode = node;
    }
  }

  window.AGS_Audio = { AudioManager };
})();
