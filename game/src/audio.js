// audio.js — all of Palmera's sound is synthesized with WebAudio: a slow synthwave loop for
// the streets, an engine hum that follows the throttle, a two-tone siren while the law is
// close, and short blips for shots, punches, pickups and payouts. No audio files exist.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlip = null;
  }

  // Browsers only allow sound after a gesture, so the context wakes on the first key or click.
  wake() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
    this.startEngine();
    this.startSiren();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain, freq, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  // --- the music: a four-chord sunset loop, one bar per chord, bass under pads ------------
  startMusic() {
    const chords = [
      [110.0, 220.0, 261.63, 329.63], // Am
      [87.31, 174.61, 220.0, 261.63], // F
      [98.0, 196.0, 246.94, 293.66], // G
      [130.81, 261.63, 329.63, 392.0], // C
    ];
    const barSeconds = 2.1;
    const playBar = () => {
      if (!this.ctx) return;
      const chord = chords[this.step % chords.length];
      this.step++;
      // Pad: the chord's upper notes, soft and slow.
      for (let n = 1; n < chord.length; n++) {
        this.tone(chord[n], barSeconds * 0.95, 'triangle', 0.045);
      }
      // Bass: root on the beat, fifth halfway.
      this.tone(chord[0], 0.5, 'sawtooth', 0.05);
      this.tone(chord[0] * 1.5, 0.4, 'sawtooth', 0.04, barSeconds / 2);
      // Hats: two ticks of filtered noise per bar.
      this.noise(0.05, 0.02, 6000, barSeconds * 0.25);
      this.noise(0.05, 0.02, 6000, barSeconds * 0.75);
    };
    playBar();
    this.musicTimer = setInterval(playBar, barSeconds * 1000);
  }

  // --- the engine: one sawtooth whose pitch follows speed while the player drives --------
  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const freq = 48 + Math.abs(speedRatio) * 165;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.abs(speedRatio) * 0.05 : 0, t, 0.1);
  }

  // --- the siren: a two-tone warble that only sounds while police are near ---------------
  startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenFlip = setInterval(() => {
      if (!this.ctx || !this.sirenOsc) return;
      high = !high;
      this.sirenOsc.frequency.setValueAtTime(high ? 950 : 700, this.ctx.currentTime);
    }, 380);
  }

  setSiren(active) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(active ? 0.016 : 0, this.ctx.currentTime, 0.2);
  }

  // --- one-shot effects -------------------------------------------------------------------
  shot() {
    this.noise(0.09, 0.16, 1800);
    this.tone(160, 0.08, 'square', 0.1, 0, 60);
  }

  punch() {
    this.tone(120, 0.12, 'sine', 0.22, 0, 45);
    this.noise(0.05, 0.08, 700);
  }

  crash(strength) {
    this.noise(0.22, Math.min(0.3, 0.1 + strength * 0.02), 500);
    this.tone(70, 0.2, 'sine', 0.18, 0, 35);
  }

  door() {
    this.tone(300, 0.05, 'square', 0.06);
    this.tone(210, 0.06, 'square', 0.05, 0.06);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.14);
    this.tone(990, 0.12, 'sine', 0.12, 0.07);
  }

  cash() {
    this.tone(880, 0.08, 'square', 0.08);
    this.tone(1174, 0.1, 'square', 0.08, 0.08);
    this.tone(1568, 0.16, 'square', 0.07, 0.16);
  }

  bust() {
    this.tone(392, 0.22, 'triangle', 0.16);
    this.tone(311, 0.22, 'triangle', 0.16, 0.2);
    this.tone(233, 0.4, 'triangle', 0.16, 0.4);
  }

  wasted() {
    this.tone(330, 0.3, 'sawtooth', 0.1, 0, 160);
    this.tone(196, 0.6, 'sawtooth', 0.1, 0.25, 90);
  }

  missionDone() {
    this.tone(523, 0.12, 'triangle', 0.14);
    this.tone(659, 0.12, 'triangle', 0.14, 0.1);
    this.tone(784, 0.12, 'triangle', 0.14, 0.2);
    this.tone(1046, 0.3, 'triangle', 0.14, 0.3);
  }
}
