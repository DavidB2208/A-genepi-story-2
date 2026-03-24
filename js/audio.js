(() => {
  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.heartbeatPhase = 0;
      this.ambienceGain = null;
      this.sampleGain = null;
      this.audioFiles = {
        arielWarning: 'assets/audio/brother-growl.wav',
        arielDanger: 'assets/audio/brother-bed.wav',
        noaWind: 'assets/audio/noa-wind.mp3',
        noaWindow: 'assets/audio/noa-window.wav',
        yardenaKnock: 'assets/audio/yardena-knock.wav',
        yardenaBreak: 'assets/audio/yardena-handle.wav',
        ambience: 'assets/audio/ambience.wav',
      };
      this.audioBuffers = {};
      this.failedAudioFiles = {};
      this.ambienceSource = null;
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

      this.sampleGain = this.ctx.createGain();
      this.sampleGain.gain.value = 1;
      this.sampleGain.connect(this.master);

      this.preloadAudioFiles();
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

    async preloadAudioFiles() {
      if (!this.ctx) return;
      const entries = Object.entries(this.audioFiles);
      await Promise.all(entries.map(async ([name, path]) => {
        try {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
          this.audioBuffers[name] = audioBuffer;
          delete this.failedAudioFiles[name];
        } catch (err) {
          this.failedAudioFiles[name] = err;
          console.warn(`[Audio] Échec du chargement de "${name}" (${path})`, err);
        }
      }));

      this.startAmbience();
    }

    playSample(name, { volume = 1, loop = false } = {}) {
      if (!this.ctx) return false;
      const buffer = this.audioBuffers[name];
      if (!buffer) return false;

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = loop;

      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(loop ? this.ambienceGain : this.sampleGain);
      src.start();
      return src;
    }

    playEvent(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'ariel-warning':
          if (!this.playSample('arielWarning', { volume: 0.9 })) {
            this.tone(120, 0.25, 'sawtooth', 0.2);
            this.tone(95, 0.35, 'triangle', 0.15);
          }
          break;
        case 'ariel-danger':
          if (!this.playSample('arielDanger', { volume: 0.95 })) {
            this.tone(80, 0.5, 'square', 0.22);
          }
          break;
        case 'noa-warning':
          if (!this.playSample('noaWind', { volume: 0.8 })) {
            this.noiseBurst(0.25, 0.18);
            this.tone(330, 0.15, 'triangle', 0.12);
          }
          break;
        case 'noa-breach':
          if (!this.playSample('noaWindow', { volume: 0.9 })) {
            this.tone(620, 0.1, 'sawtooth', 0.16);
            this.tone(280, 0.3, 'square', 0.15);
          }
          break;
        case 'yardena-knock':
          if (!this.playSample('yardenaKnock', { volume: 0.9 })) {
            this.tone(160, 0.08, 'square', 0.15);
          }
          break;
        case 'yardena-break':
          if (!this.playSample('yardenaBreak', { volume: 0.95 })) {
            this.noiseBurst(0.3, 0.2);
            this.tone(70, 0.4, 'sawtooth', 0.2);
          }
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
          out[i] = (Math.random() * 2 - 1) * 0.004;
        }
      };
      node.connect(this.ambienceGain);
      this.noiseNode = node;
    }

    startAmbience() {
      if (!this.ctx || this.ambienceSource) return;
      const ambience = this.playSample('ambience', { volume: 0.75, loop: true });
      if (ambience) {
        this.ambienceSource = ambience;
        this.startAmbienceNoise();
      } else {
        this.startAmbienceNoise();
      }
    }
  }

  window.AGS_Audio = { AudioManager };
})();
