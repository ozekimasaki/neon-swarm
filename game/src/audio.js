// Procedural WebAudio sound: no audio files, every effect is synthesized.
// The context is created lazily on the first user gesture (the START click).

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastShot = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  }

  tone(freqA, freqB, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, freq = 900) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = this.ctx.createGain(); gain.gain.value = vol;
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t0);
  }

  shoot() {
    const now = performance.now();
    if (now - this.lastShot < 55) return; // throttle: the gun fires fast
    this.lastShot = now;
    this.tone(880, 320, 0.07, 'square', 0.05);
  }

  enemyDie(big) {
    this.noise(big ? 0.32 : 0.16, big ? 0.5 : 0.28, big ? 500 : 900);
    this.tone(big ? 220 : 340, 40, big ? 0.3 : 0.16, 'sawtooth', 0.12);
  }

  gem(combo) {
    const step = Math.min(combo, 12);
    this.tone(620 * Math.pow(1.059, step), 620 * Math.pow(1.059, step), 0.09, 'sine', 0.10);
  }

  playerHit() {
    this.tone(160, 55, 0.25, 'sawtooth', 0.30);
    this.noise(0.18, 0.25, 400);
  }

  dash() { this.noise(0.12, 0.12, 2400); }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.16, i * 0.07));
  }

  pick() { this.tone(740, 1180, 0.10, 'triangle', 0.14); }

  win() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, f, 0.24, 'triangle', 0.16, i * 0.09)); }

  lose() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, f * 0.94, 0.3, 'sawtooth', 0.14, i * 0.13)); }
}
