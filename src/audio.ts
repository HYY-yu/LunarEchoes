import type { Event } from './core.js';
export class Synth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private beat = 0;
  muted = false;
  active = false;
  async start() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : .17; this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.next = this.context.currentTime + .05;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 70);
  }
  mute(value: boolean) { this.muted = value; if (this.master && this.context) this.master.gain.setTargetAtTime(value ? 0 : .17, this.context.currentTime, .03); }
  pause(value: boolean) { this.active = !value; if (this.context) this.next = this.context.currentTime + .05; }
  private tone(frequency: number, start: number, duration: number, type: OscillatorType, volume: number, end = frequency) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(start); osc.stop(start + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  private schedule() {
    if (!this.context) return;
    if (!this.active) { this.next = this.context.currentTime + .05; return; }
    const melody = 'A4 - E5 - G5 E5 C5 - A4 - C5 D5 E5 - G4 -'.split(' ');
    const bass = [55, 65.406, 49, 73.416];
    const notes: Record<string, number> = { A4: 440, E5: 659.255, G5: 783.991, C5: 523.251, D5: 587.33, G4: 391.995 };
    let count = 0;
    while (this.next < this.context.currentTime + .16 && count++ < 12) {
      const note = notes[melody[this.beat % melody.length]];
      if (note) this.tone(note, this.next, .23, 'square', .075);
      if (this.beat % 2 === 0) this.tone(bass[Math.floor(this.beat / 16) % 4], this.next, .29, 'triangle', .32);
      if (this.beat % 4 === 0) this.tone(100, this.next, .13, 'sine', .5, 30);
      if (this.beat % 4 === 2) this.noise(this.next, .045, .12);
      this.beat++; this.next += .19;
    }
  }
  private noise(start: number, duration: number, volume: number) {
    if (!this.context || !this.master) return;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 753;
    for (let i = 0; i < data.length; i++) { seed = Math.imul(seed, 1664525) + 1013904223; data[i] = ((seed >>> 0) / 2147483648 - 1) * (1 - i / data.length); }
    const source = this.context.createBufferSource(), gain = this.context.createGain(); source.buffer = buffer; gain.gain.value = volume; source.connect(gain); gain.connect(this.master); source.start(start); source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  events(events: Event[]) {
    if (!this.context || !this.active) return;
    const now = this.context.currentTime;
    const set = new Set(events);
    if (set.has('shot')) this.tone(700, now, .045, 'square', .045, 240);
    if (set.has('pickup')) this.tone(1100, now, .06, 'sine', .1, 1600);
    if (set.has('kill')) this.noise(now, .07, .17);
    if (set.has('hit')) this.tone(100, now, .18, 'sawtooth', .3, 35);
    if (set.has('dash')) this.noise(now, .12, .15);
    if (set.has('upgrade')) [440, 554, 659].forEach((n, i) => this.tone(n, now + i * .07, .24, 'triangle', .2));
    if (set.has('boss')) this.tone(65, now, .8, 'sawtooth', .2, 32);
  }
}
