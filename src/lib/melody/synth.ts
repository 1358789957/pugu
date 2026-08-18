import { voicingFor } from "./chords";
import { midiToHz, type ChordEvent, type NoteEvent } from "./notes";

export type PlayMode = "melody" | "vocals" | "source" | "both";

type Scheduled = { stop: () => void };

type PlayOpts = {
  notes: NoteEvent[];
  chords?: ChordEvent[];
  source?: AudioBuffer | null;
  vocals?: AudioBuffer | null;
  mode: PlayMode;
  from?: number;
  duration: number;
  sourceGain?: number;
  loop?: boolean;
};

export class StudioPlayer {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private voices: Scheduled[] = [];
  private startedAt = 0;
  private offset = 0;
  private playing = false;
  private raf = 0;
  private endTimer = 0;
  private lookTimer = 0;
  private lastOpts: PlayOpts | null = null;
  private scheduled = new Set<string>();
  private schedHorizon = 0;
  loop = false;
  onTime: ((t: number) => void) | null = null;
  onEnded: (() => void) | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  getCurrentTime(): number {
    if (!this.playing || !this.ctx) return this.offset;
    return this.offset + (this.ctx.currentTime - this.startedAt);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  private clearVoices() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.endTimer) window.clearTimeout(this.endTimer);
    this.endTimer = 0;
    if (this.lookTimer) window.clearInterval(this.lookTimer);
    this.lookTimer = 0;
    try {
      this.sourceNode?.stop();
    } catch {
      /* already stopped */
    }
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    for (const n of this.voices) n.stop();
    this.voices = [];
    this.scheduled.clear();
  }

  stop() {
    if (this.playing && this.ctx) {
      this.offset += this.ctx.currentTime - this.startedAt;
    }
    this.playing = false;
    this.clearVoices();
  }

  halt() {
    this.playing = false;
    this.clearVoices();
    this.offset = 0;
    this.onTime?.(0);
  }

  seek(t: number) {
    const was = this.playing;
    this.playing = false;
    this.clearVoices();
    this.offset = Math.max(0, t);
    this.onTime?.(this.offset);
    return was;
  }

  private tick = () => {
    if (!this.playing) return;
    this.onTime?.(this.getCurrentTime());
    this.raf = requestAnimationFrame(this.tick);
  };

  tap(midi: number) {
    void this.resume().then(() => {
      const ctx = this.ensure();
      this.voice(ctx, midi, ctx.currentTime, 0.28, 0.7);
    });
  }

  private voice(ctx: AudioContext, midi: number, when: number, dur: number, vel: number) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc2.type = "sine";
    const hz = midiToHz(midi);
    osc.frequency.setValueAtTime(hz, when);
    osc2.frequency.setValueAtTime(hz * 2, when);
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800 + vel * 1200, when);
    const peak = 0.18 + vel * 0.16;
    const safeDur = Math.max(0.05, dur);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0008, peak * 0.45),
      when + Math.min(0.22, safeDur * 0.4),
    );
    const releaseAt = when + Math.max(0.04, safeDur - 0.06);
    gain.gain.setValueAtTime(Math.max(0.0008, peak * 0.4), releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + safeDur);
    osc.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc2.start(when);
    osc.stop(when + safeDur + 0.02);
    osc2.stop(when + safeDur + 0.02);
    return {
      stop: () => {
        try {
          osc.stop();
          osc2.stop();
        } catch {
          /* already stopped */
        }
        osc.disconnect();
        osc2.disconnect();
        gain.disconnect();
      },
    };
  }

  private pad(ctx: AudioContext, midi: number, when: number, dur: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(midiToHz(midi), when);
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const safeDur = Math.max(0.08, dur);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.045, when + 0.04);
    const rel = when + Math.max(0.08, safeDur - 0.08);
    gain.gain.setValueAtTime(0.04, rel);
    gain.gain.exponentialRampToValueAtTime(0.0008, when + safeDur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + safeDur + 0.02);
    return {
      stop: () => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
        osc.disconnect();
        gain.disconnect();
      },
    };
  }

  private scheduleWindow() {
    const opts = this.lastOpts;
    if (!this.playing || !opts || !this.ctx) return;
    const ctx = this.ctx;
    const now = this.getCurrentTime();
    const until = now + 0.55;
    const from = this.schedHorizon;
    const score = opts.mode === "melody" || opts.mode === "both";

    if (score) {
      for (const n of opts.notes) {
        const end = n.start + n.duration;
        if (end <= now) continue;
        const key = `n:${n.id}`;
        if (this.scheduled.has(key)) continue;
        const audible = n.start < until && end > from;
        if (!audible) continue;
        this.scheduled.add(key);
        const when = ctx.currentTime + Math.max(0, n.start - now);
        const dur = end - Math.max(n.start, now);
        this.voices.push(this.voice(ctx, n.midi, when, dur, n.velocity));
      }
      for (const c of opts.chords ?? []) {
        const end = c.start + c.duration;
        if (end <= now) continue;
        if (!(c.start < until && end > from)) continue;
        for (const midi of voicingFor(c.root, c.quality)) {
          const key = `c:${c.start}:${midi}`;
          if (this.scheduled.has(key)) continue;
          this.scheduled.add(key);
          const when = ctx.currentTime + Math.max(0, c.start - now);
          const dur = end - Math.max(c.start, now);
          this.voices.push(this.pad(ctx, midi, when, dur));
        }
      }
    }

    this.schedHorizon = until;
  }

  async play(opts: PlayOpts) {
    await this.resume();
    this.playing = false;
    this.clearVoices();
    this.lastOpts = opts;
    if (opts.loop !== undefined) this.loop = opts.loop;
    const ctx = this.ensure();
    const from = opts.from ?? this.offset;
    this.offset = from;
    this.startedAt = ctx.currentTime;
    this.playing = true;
    this.schedHorizon = from;

    const bed =
      opts.mode === "vocals"
        ? opts.vocals
        : opts.mode === "source"
          ? opts.source
          : opts.mode === "both"
            ? (opts.vocals ?? opts.source)
            : null;
    if (bed) {
      const src = ctx.createBufferSource();
      src.buffer = bed;
      const g = ctx.createGain();
      g.gain.value = opts.mode === "both" ? (opts.sourceGain ?? 0.38) : 0.85;
      src.connect(g);
      g.connect(ctx.destination);
      const startAt = Math.min(from, Math.max(0, bed.duration - 0.01));
      src.start(ctx.currentTime, startAt);
      this.sourceNode = src;
    }

    this.scheduleWindow();
    this.lookTimer = window.setInterval(() => this.scheduleWindow(), 90);

    const remain = Math.max(0.05, opts.duration - from);
    this.endTimer = window.setTimeout(() => {
      if (!this.playing) return;
      if (this.loop && this.lastOpts) {
        this.offset = 0;
        void this.play({ ...this.lastOpts, from: 0 });
        return;
      }
      this.playing = false;
      this.clearVoices();
      this.offset = 0;
      this.onTime?.(0);
      this.onEnded?.();
    }, remain * 1000 + 40);

    this.tick();
  }
}

export const player = new StudioPlayer();
