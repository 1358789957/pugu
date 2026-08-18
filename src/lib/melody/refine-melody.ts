import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_RATE } from "./basic-pitch-options";
import { polishMelody } from "./basic-pitch-notes";
import { yinPitch, frameRms } from "./pitch";
import { hzToMidi } from "./notes";

const WIN = 1024;

export type YinFrame = {
  t: number;
  midi: number;
  conf: number;
  rms: number;
};

export function yinTrack(
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  t0 = 0,
  hop = 0.02,
): YinFrame[] {
  const out: YinFrame[] = [];
  const duration = samples.length / sampleRate;
  for (let t = 0; t < duration; t += hop) {
    const i0 = Math.max(0, Math.floor(t * sampleRate - WIN / 2));
    const frame = samples.subarray(i0, Math.min(samples.length, i0 + WIN));
    if (frame.length < WIN / 2) break;
    const { hz, conf } = yinPitch(frame, {
      sampleRate,
      minHz: 180,
      maxHz: 900,
      threshold: 0.15,
    });
    const midi = hz > 0 ? hzToMidi(hz) : 0;
    out.push({ t: t + t0, midi, conf, rms: frameRms(frame) });
  }
  return out;
}

/**
 * Insert a sung degree that Basic Pitch left in a gap, when f0 is stable
 * and different from both neighboring melody notes.
 */
export function fillMelodyGaps(
  notes: BasicPitchNote[],
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  origin = 0,
): BasicPitchNote[] {
  if (notes.length < 2) return notes;
  const track = yinTrack(samples, sampleRate, origin);
  const out: BasicPitchNote[] = notes.map((n) => ({ ...n }));
  const inserts: BasicPitchNote[] = [];
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i]!;
    const b = out[i + 1]!;
    const gap0 = a.startTimeSeconds + a.durationSeconds;
    const gap1 = b.startTimeSeconds;
    if (gap1 - gap0 < 0.2) continue;
    const left = Math.round(a.pitchMidi);
    const right = Math.round(b.pitchMidi);
    if (left === right) continue;
    const cand = bestGapPitch(track, gap0 + 0.03, gap1 - 0.03, left, right);
    if (!cand) continue;
    inserts.push({
      startTimeSeconds: cand.start,
      durationSeconds: Math.max(0.08, cand.end - cand.start),
      pitchMidi: cand.midi,
      amplitude: Math.max(0.25, cand.conf * 0.7),
    });
  }
  if (!inserts.length) return out;
  return [...out, ...inserts].sort((x, y) => x.startTimeSeconds - y.startTimeSeconds);
}

function bestGapPitch(
  track: YinFrame[],
  t0: number,
  t1: number,
  leftMidi: number,
  rightMidi: number,
): { midi: number; start: number; end: number; conf: number } | null {
  const leftPc = ((leftMidi % 12) + 12) % 12;
  const rightPc = ((rightMidi % 12) + 12) % 12;
  const bins = new Map<number, { n: number; conf: number; t0: number; t1: number }>();
  for (const f of track) {
    if (f.t < t0 || f.t > t1 || f.conf < 0.55 || f.midi < 50) continue;
    const midi = Math.round(f.midi);
    if (midi < 62 || midi > 76) continue;
    const pc = ((midi % 12) + 12) % 12;
    if (pc === leftPc || pc === rightPc) continue;
    const cur = bins.get(pc);
    if (!cur) bins.set(pc, { n: 1, conf: f.conf, t0: f.t, t1: f.t });
    else {
      cur.n += 1;
      cur.conf += f.conf;
      cur.t1 = f.t;
    }
  }
  let best: { midi: number; start: number; end: number; conf: number } | null = null;
  for (const [pc, v] of bins) {
    if (v.n < 1) continue;
    const mean = v.conf / v.n;
    if (mean < 0.64) continue;
    const midi = 60 + pc;
    const cand = { midi, start: v.t0, end: v.t1 + 0.04, conf: mean };
    if (!best || cand.conf > best.conf) best = cand;
  }
  return best;
}

export function refineMelody(
  notes: BasicPitchNote[],
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  origin = 0,
): BasicPitchNote[] {
  return polishMelody(fillMelodyGaps(notes, samples, sampleRate, origin));
}
