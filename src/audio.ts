import type { Event } from './core.js';
export type AudioSession = 'menu' | 'running' | 'paused' | 'upgrading' | 'terminal';
export type Cue = Event | 'ui-confirm' | 'ui-reject';
type Bus = 'music' | 'battle' | 'feedback';
type Note = readonly [frequency: number, delay: number, duration: number, type: OscillatorType, volume: number, end: number];
export const cues = {
  shot: [[700, 0, .045, 'square', .045, 240]],
  'enemy-hit': [[320, 0, .055, 'triangle', .12, 150]],
  pickup: [[1100, 0, .06, 'sine', .1, 1600]],
  kill: [[180, 0, .07, 'sawtooth', .12, 45]],
  hit: [[100, 0, .18, 'sawtooth', .25, 35]],
  dash: [[160, 0, .12, 'triangle', .15, 900]],
  upgrade: [[440, 0, .24, 'triangle', .16, 440], [554, .07, .24, 'triangle', .16, 554], [659, .14, .24, 'triangle', .16, 659]],
  boss: [[65, 0, .8, 'sawtooth', .18, 32]],
  won: [[440, 0, .22, 'triangle', .2, 440], [554, .18, .22, 'triangle', .2, 554], [659, .36, .22, 'triangle', .2, 659], [880, .54, .55, 'sine', .25, 880]],
  lost: [[220, 0, .3, 'triangle', .22, 196], [165, .25, .3, 'triangle', .22, 147], [110, .5, .65, 'sine', .25, 55]],
  'ui-confirm': [[660, 0, .065, 'sine', .14, 880]],
  'ui-reject': [[180, 0, .11, 'triangle', .17, 90]]
} satisfies Record<Cue, readonly Note[]>;
export function cueGraph(context: BaseAudioContext, output: AudioNode, cue: Cue, start: number, track: (source: OscillatorNode, gain: GainNode) => void) {
  for (const [frequency, delay, duration, type, volume, end] of cues[cue]) {
    const osc = context.createOscillator(), gain = context.createGain(), at = start + delay;
    osc.type = type; osc.frequency.setValueAtTime(frequency, at); osc.frequency.exponentialRampToValueAtTime(end, at + duration);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .008); gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    osc.connect(gain); gain.connect(output); track(osc, gain); osc.start(at); osc.stop(at + duration + .02);
  }
}
export class Synth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private beat = 0;
  private generation = 0;
  private operation = 0;
  private ready = false;
  private terminalPlayed = false;
  private session: AudioSession = 'menu';
  private hidden = false;
  private silent = false;
  private voices = new Map<AudioScheduledSourceNode, { gain: GainNode; bus: Bus }>();
  private recent = new Map<Cue, number>();
  get muted() { return this.silent; }
  get status() { return { session: this.session, hidden: this.hidden, muted: this.silent, ready: this.ready, voices: this.voices.size, generation: this.generation }; }
  async activate(feedback?: 'ui-confirm') {
    if (this.silent || this.hidden) return false;
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = .17; this.master.connect(this.context.destination);
    }
    const generation = this.generation, operation = this.operation;
    await this.context.resume();
    if (generation !== this.generation || this.silent || this.hidden) return false;
    this.ready = true; this.next = this.context.currentTime + .05;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 70);
    if (operation !== this.operation) return false;
    if (feedback) this.play(feedback);
    return true;
  }
  setSession(session: AudioSession) {
    if (session === this.session) return;
    this.session = session; this.operation++;
    this.stop(() => true);
    if (this.context) this.next = this.context.currentTime + .05;
  }
  setMuted(value: boolean) { if (value === this.silent) return; this.silent = value; this.quiet(); }
  setHidden(value: boolean) { if (value === this.hidden) return; this.hidden = value; this.quiet(); }
  reset() { this.quiet(); this.session = 'menu'; this.beat = 0; this.terminalPlayed = false; this.recent.clear(); }
  private quiet() {
    this.generation++; this.ready = false; this.stop(() => true);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  private stop(select: (bus: Bus) => boolean) {
    for (const [source, { gain, bus }] of this.voices) if (select(bus)) { source.stop(); source.disconnect(); gain.disconnect(); this.voices.delete(source); }
  }
  private track(source: AudioScheduledSourceNode, gain: GainNode, bus: Bus) {
    this.voices.set(source, { gain, bus });
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(source); };
  }
  play(cue: Cue) {
    const terminal = cue === 'won' || cue === 'lost';
    if (terminal) {
      if (this.terminalPlayed) return;
      this.terminalPlayed = true; this.setSession('terminal'); this.stop(() => true);
    }
    const feedback = terminal || cue === 'ui-confirm' || cue === 'ui-reject' || cue === 'upgrade';
    if (!this.context || !this.master || !this.ready || this.silent || this.hidden || (!feedback && this.session !== 'running')) return;
    const now = this.context.currentTime, cooldown = cue === 'shot' ? .045 : cue === 'enemy-hit' ? .075 : .1;
    if (now - (this.recent.get(cue) ?? -Infinity) < cooldown || this.voices.size + cues[cue].length > 24) return;
    this.recent.set(cue, now);
    cueGraph(this.context, this.master, cue, now, (source, gain) => this.track(source, gain, feedback ? 'feedback' : 'battle'));
  }
  events(events: readonly Event[]) {
    const outcome = events.find(event => event === 'won' || event === 'lost');
    if (outcome) { this.play(outcome); return; }
    for (const event of new Set(events)) this.play(event);
  }
  private tone(frequency: number, start: number, duration: number, type: OscillatorType, volume: number, end = frequency) {
    if (!this.context || !this.master || this.voices.size >= 24) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain); gain.connect(this.master); this.track(osc, gain, 'music'); osc.start(start); osc.stop(start + duration + .02);
  }
  private noise(start: number) {
    if (!this.context || !this.master || this.voices.size >= 24) return;
    const duration = .045, buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate), data = buffer.getChannelData(0);
    let seed = 753;
    for (let i = 0; i < data.length; i++) { seed = Math.imul(seed, 1664525) + 1013904223; data[i] = ((seed >>> 0) / 2147483648 - 1) * (1 - i / data.length); }
    const source = this.context.createBufferSource(), gain = this.context.createGain(); source.buffer = buffer; gain.gain.value = .12; source.connect(gain); gain.connect(this.master); this.track(source, gain, 'music'); source.start(start); source.stop(start + duration);
  }
  private schedule() {
    if (!this.context || !this.master || !this.ready || this.silent || this.hidden || this.session !== 'running') return;
    const melody = 'A4 - E5 - G5 E5 C5 - A4 - C5 D5 E5 - G4 -'.split(' ');
    const bass = [55, 65.406, 49, 73.416];
    const notes: Record<string, number> = { A4: 440, E5: 659.255, G5: 783.991, C5: 523.251, D5: 587.33, G4: 391.995 };
    if (this.next < this.context.currentTime) this.next = this.context.currentTime + .05;
    while (this.next < this.context.currentTime + .16) {
      const note = notes[melody[this.beat % melody.length]];
      if (note) this.tone(note, this.next, .23, 'square', .075);
      if (this.beat % 2 === 0) this.tone(bass[Math.floor(this.beat / 16) % 4], this.next, .29, 'triangle', .32);
      if (this.beat % 4 === 0) this.tone(100, this.next, .13, 'sine', .5, 30);
      if (this.beat % 4 === 2) this.noise(this.next);
      this.beat++; this.next += .19;
    }
  }
}
