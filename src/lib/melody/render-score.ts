import { BASIC_PITCH_RATE } from "./basic-pitch-options";
import type { ScoreNote } from "./demo";

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function triangle(phase: number): number {
  const f = phase - Math.floor(phase);
  return 4 * Math.abs(f - 0.5) - 1;
}

function expRamp(v0: number, v1: number, u: number): number {
  const a = Math.max(1e-6, v0);
  const b = Math.max(1e-6, v1);
  return a * (b / a) ** Math.min(1, Math.max(0, u));
}

/** Same envelope as the in-browser 小星星 demo (triangle + short gap). */
function envelope(localT: number, len: number, peak: number): number {
  const atk = 0.012;
  const decayEnd = Math.min(0.16, len * 0.35);
  const relHold = Math.max(0.05, len - 0.06);
  const relEnd = Math.max(relHold + 0.004, len - 0.008);
  if (localT <= 0 || localT >= len) return 0;
  if (localT < atk) return peak * (localT / atk);
  if (localT < decayEnd) return expRamp(peak, peak * 0.6, (localT - atk) / Math.max(0.001, decayEnd - atk));
  if (localT < relHold) return peak * 0.55;
  if (localT < relEnd) return expRamp(peak * 0.55, 0.0008, (localT - relHold) / Math.max(0.001, relEnd - relHold));
  return 0;
}

export type RenderScoreOpts = {
  bpm?: number;
  sampleRate?: number;
  lead?: number;
  tail?: number;
  gap?: number;
  peak?: number;
};

/** Render a dry C-major melody as mono float32, Basic Pitch rate. */
export function renderScoreSamples(
  notes: readonly ScoreNote[],
  opts: RenderScoreOpts = {},
): { samples: Float32Array; sampleRate: number } {
  const bpm = opts.bpm ?? 96;
  const sampleRate = opts.sampleRate ?? BASIC_PITCH_RATE;
  const lead = opts.lead ?? 0.35;
  const tail = opts.tail ?? 0.6;
  const gap = opts.gap ?? 0.08;
  const peak = opts.peak ?? 0.32;
  const beat = 60 / bpm;
  let beats = 0;
  for (const n of notes) beats += n.beats;
  const duration = lead + beats * beat + tail;
  const samples = new Float32Array(Math.max(1, Math.ceil(duration * sampleRate)));
  let t = lead;
  for (const n of notes) {
    const len = Math.max(0.09, n.beats * beat - gap);
    const hz = midiToHz(n.midi);
    const i0 = Math.floor(t * sampleRate);
    const i1 = Math.min(samples.length, Math.ceil((t + len) * sampleRate));
    for (let i = i0; i < i1; i++) {
      const localT = i / sampleRate - t;
      const env = envelope(localT, len, peak);
      if (env <= 0) continue;
      samples[i] += env * triangle(hz * localT);
    }
    t += n.beats * beat;
  }
  return { samples, sampleRate };
}
