import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_RATE } from "./basic-pitch-options";
import { hzToMidi, type PitchFrame } from "./notes";
import { frameRms, yinPitch } from "./pitch";

export type ContourFrame = {
  t: number;
  hz: number;
  periodSec: number;
  periodSamples: number;
  midi: number;
  conf: number;
  rms: number;
  voiced: boolean;
  filled: boolean;
};

const WIN = 1024;
const HOP = 0.01;
const VOICED_CONF = 0.36;
const REST_SEC = 0.34;
const SAME_PERIOD = 1.08;
const SING_LO = 60;
const SING_HI = 79;

export function periodRatio(a: number, b: number): number {
  if (a <= 0 || b <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(a, b) / Math.min(a, b);
}

/** Frame-wise tuner contour: time, Hz, period/wavelength, voiced confidence. */
export function buildPitchContour(
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  t0 = 0,
  hop = HOP,
): ContourFrame[] {
  const out: ContourFrame[] = [];
  const duration = samples.length / sampleRate;
  for (let t = 0; t < duration; t += hop) {
    const i0 = Math.max(0, Math.floor(t * sampleRate - WIN / 2));
    const frame = samples.subarray(i0, Math.min(samples.length, i0 + WIN));
    if (frame.length < WIN / 2) break;
    const rms = frameRms(frame);
    const { hz, conf } = yinPitch(frame, {
      sampleRate,
      minHz: 180,
      maxHz: 900,
      threshold: 0.15,
      preferOctaveUp: false,
    });
    const voiced = hz > 0 && conf >= VOICED_CONF && rms > 0.008;
    const periodSec = voiced ? 1 / hz : 0;
    out.push({
      t: t + t0,
      hz: voiced ? hz : 0,
      periodSec,
      periodSamples: periodSec * sampleRate,
      midi: voiced ? hzToMidi(hz) : 0,
      conf: voiced ? conf : 0,
      rms,
      voiced,
      filled: false,
    });
  }
  return out;
}

function holdFrame(f: ContourFrame, proto: ContourFrame, sampleRate: number) {
  f.hz = proto.hz;
  f.periodSec = proto.periodSec;
  f.periodSamples = proto.periodSec * sampleRate;
  f.midi = proto.midi;
  f.filled = true;
  f.conf = proto.conf * 0.8;
}

function islandProto(frames: ContourFrame[], lo: number, hi: number): ContourFrame {
  const hz = median(
    frames.slice(lo, hi + 1).map((f) => f.hz).filter((h) => h > 0),
  );
  const proto = { ...frames[lo]! };
  if (hz > 0) {
    proto.hz = hz;
    proto.periodSec = 1 / hz;
    proto.midi = hzToMidi(hz);
  }
  return proto;
}

function voicedIslands(frames: ContourFrame[]): { lo: number; hi: number }[] {
  const out: { lo: number; hi: number }[] = [];
  let lo = -1;
  for (let i = 0; i <= frames.length; i++) {
    const v = i < frames.length && frames[i]!.voiced;
    if (v && lo < 0) lo = i;
    if (!v && lo >= 0) {
      out.push({ lo, hi: i - 1 });
      lo = -1;
    }
  }
  return out;
}

/**
 * Complete short dropouts by holding/interpolating a neighbor period.
 * Same-ish wavelength only — never 2× octave boost. Long gaps stay breaks.
 */
export function continueWavelength(frames: ContourFrame[], sampleRate = BASIC_PITCH_RATE): ContourFrame[] {
  const hop = frames.length >= 2 ? Math.max(0.005, frames[1]!.t - frames[0]!.t) : HOP;
  const out = frames.map((f) => ({ ...f }));

  let i = 0;
  while (i < out.length) {
    if (out[i]!.voiced) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < out.length && !out[i]!.voiced) i += 1;
    const end = i;
    const left = start > 0 ? out[start - 1] : null;
    const right = end < out.length ? out[end] : null;
    const dur = out[end - 1]!.t - out[start]!.t + hop;
    if (dur >= REST_SEC) continue;
    if (left?.voiced && right?.voiced && periodRatio(left.periodSec, right.periodSec) <= SAME_PERIOD) {
      const n = end - start;
      for (let k = 0; k < n; k++) {
        const u = (k + 1) / (n + 1);
        const period = left.periodSec * (1 - u) + right.periodSec * u;
        const hz = 1 / period;
        const f = out[start + k]!;
        f.hz = hz;
        f.periodSec = period;
        f.periodSamples = period * sampleRate;
        f.midi = hzToMidi(hz);
        f.filled = true;
        f.conf = Math.min(left.conf, right.conf) * 0.85;
      }
    } else if (left?.voiced && !right && dur < 0.1 && Math.round(left.midi) >= SING_LO) {
      for (let k = start; k < end; k++) holdFrame(out[k]!, left, sampleRate);
    } else if (right?.voiced && !left && dur < 0.1 && Math.round(right.midi) >= SING_LO) {
      for (let k = start; k < end; k++) holdFrame(out[k]!, right, sampleRate);
    }
  }

  for (const isl of voicedIslands(out)) {
    const span = out[isl.hi]!.t - out[isl.lo]!.t + hop;
    if (span >= 0.14) continue;
    const proto = islandProto(out, isl.lo, isl.hi);
    if (Math.round(proto.midi) < SING_LO) continue;
    for (let j = isl.lo - 1; j >= 0; j--) {
      const f = out[j]!;
      if (f.voiced || f.filled) break;
      if (out[isl.lo]!.t - f.t > 0.1) break;
      holdFrame(f, proto, sampleRate);
    }
    for (let j = isl.hi + 1; j < out.length; j++) {
      const f = out[j]!;
      if (f.voiced || f.filled) break;
      if (f.t - out[isl.hi]!.t > 0.1) break;
      holdFrame(f, proto, sampleRate);
    }
  }
  return out;
}

export function contourToPitchFrames(frames: ContourFrame[]): PitchFrame[] {
  return frames.map((f) => ({
    t: f.t,
    hz: f.hz,
    midi: f.midi,
    cents: 0,
    conf: f.conf,
    rms: f.rms,
    periodSec: f.periodSec,
    filled: f.filled,
  }));
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/**
 * Stable degree runs on the completed contour. Pitch is the measured period
 * (hz → midi), never `60 + pitchClass`.
 */
export function notesFromFilledContour(frames: ContourFrame[]): BasicPitchNote[] {
  const hop = frames.length >= 2 ? Math.max(0.005, frames[1]!.t - frames[0]!.t) : HOP;
  const notes: BasicPitchNote[] = [];
  let run: ContourFrame[] = [];
  const flush = () => {
    if (run.length < 2) {
      run = [];
      return;
    }
    const hz = median(run.map((f) => f.hz).filter((h) => h > 0));
    if (hz <= 0) {
      run = [];
      return;
    }
    const midi = Math.round(hzToMidi(hz));
    const first = run[0]!;
    const last = run[run.length - 1]!;
    notes.push({
      startTimeSeconds: first.t,
      durationSeconds: Math.max(0.05, last.t - first.t + hop),
      pitchMidi: midi,
      amplitude: Math.max(0.2, median(run.map((f) => f.conf))),
    });
    run = [];
  };
  const active = (f: ContourFrame) => f.hz > 0 && (f.voiced || f.filled);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (!active(f)) {
      flush();
      continue;
    }
    const prev = run[run.length - 1];
    if (prev && Math.abs(f.midi - prev.midi) >= 0.9) {
      let stable = 1;
      for (let k = i + 1; k < frames.length && k <= i + 2; k++) {
        const n = frames[k]!;
        if (!active(n)) break;
        if (Math.abs(n.midi - f.midi) < 0.9) stable += 1;
        else break;
      }
      if (stable < 3) continue;
      flush();
    }
    run.push(f);
  }
  flush();
  return tightenContourNotes(notes);
}

/**
 * Keep syllable-length contour notes; drop 1–2-frame spikes and squeezed ghosts.
 * Isolated short islands in a rest stay (they can be the missing `5`).
 */
export function tightenContourNotes(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length === 0) return notes;
  const merged: BasicPitchNote[] = [];
  for (const raw of notes) {
    const n = { ...raw, pitchBends: raw.pitchBends ? raw.pitchBends.slice() : undefined };
    const prev = merged[merged.length - 1];
    const samePc = prev && (((Math.round(n.pitchMidi) - Math.round(prev.pitchMidi)) % 12) + 12) % 12 === 0;
    const gap = prev
      ? n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
      : Infinity;
    if (prev && samePc && gap < 0.08 && gap > -0.05) {
      const prefer =
        n.pitchMidi >= SING_LO && n.pitchMidi <= SING_HI
          ? n.pitchMidi
          : prev.pitchMidi >= SING_LO && prev.pitchMidi <= SING_HI
            ? prev.pitchMidi
            : n.pitchMidi;
      prev.pitchMidi = prefer;
      prev.durationSeconds =
        Math.max(prev.startTimeSeconds + prev.durationSeconds, n.startTimeSeconds + n.durationSeconds) -
        prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, n.amplitude);
      continue;
    }
    merged.push(n);
  }
  if (merged.length < 3) return merged;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < merged.length; i++) {
    const n = merged[i]!;
    const prev = out[out.length - 1];
    const next = merged[i + 1];
    if (prev && next && n.durationSeconds <= 0.1) {
      const gapPrev = n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds);
      const gapNext = next.startTimeSeconds - (n.startTimeSeconds + n.durationSeconds);
      const midi = Math.round(n.pitchMidi);
      const ornament =
        midi !== Math.round(prev.pitchMidi) && midi !== Math.round(next.pitchMidi);
      const neighborsInBand =
        prev.pitchMidi >= SING_LO &&
        prev.pitchMidi <= SING_HI &&
        next.pitchMidi >= SING_LO &&
        next.pitchMidi <= SING_HI;
      if (
        ornament &&
        neighborsInBand &&
        gapPrev < 0.16 &&
        gapNext < 0.16 &&
        n.durationSeconds < prev.durationSeconds &&
        n.durationSeconds < next.durationSeconds
      ) {
        continue;
      }
    }
    out.push({ ...n });
  }
  return out;
}

function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

function overlapsExisting(notes: BasicPitchNote[], start: number, end: number): boolean {
  return notes.some((n) => {
    const a = n.startTimeSeconds;
    const b = a + n.durationSeconds;
    return Math.min(end, b) - Math.max(start, a) > 0.04;
  });
}

/**
 * Insert contour-segmented notes into Basic Pitch holes.
 * Midi comes from the measured/held period (hz), never `60 + pitchClass`.
 */
export function mergeContourIntoNotes(notes: BasicPitchNote[], filled: ContourFrame[]): BasicPitchNote[] {
  if (notes.length < 2) return notes;
  const sorted = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const contourNotes = notesFromFilledContour(filled);
  const inserts: BasicPitchNote[] = [];
  for (const cn of contourNotes) {
    const midi = Math.round(cn.pitchMidi);
    if (midi < SING_LO || midi > SING_HI) continue;
    const start = cn.startTimeSeconds;
    const end = start + cn.durationSeconds;
    if (overlapsExisting(sorted, start, end)) continue;
    let host = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      const gap0 = a.startTimeSeconds + a.durationSeconds;
      const gap1 = b.startTimeSeconds;
      if (gap1 - gap0 < 0.15) continue;
      if (Math.round(a.pitchMidi) === Math.round(b.pitchMidi)) continue;
      const margin = 0.08;
      const overlap = Math.min(end, gap1 - margin) - Math.max(start, gap0 + margin);
      if (overlap >= 0.03) {
        host = i;
        break;
      }
    }
    if (host < 0) continue;
    const left = Math.round(sorted[host]!.pitchMidi);
    const right = Math.round(sorted[host + 1]!.pitchMidi);
    const prev = host > 0 ? Math.round(sorted[host - 1]!.pitchMidi) : null;
    const pc = pitchClass(midi);
    if (pc === pitchClass(left) || pc === pitchClass(right)) continue;
    if (prev != null && pc === pitchClass(prev)) continue;
    if (Math.abs(midi - left) % 12 === 0 || Math.abs(midi - right) % 12 === 0) continue;
    const lo = Math.min(left, right);
    const hi = Math.max(left, right);
    if (midi > lo && midi < hi) continue;
    inserts.push({
      startTimeSeconds: start,
      durationSeconds: Math.max(0.08, cn.durationSeconds),
      pitchMidi: midi,
      amplitude: Math.max(0.25, cn.amplitude),
    });
  }
  if (!inserts.length) return sorted;
  return [...sorted, ...inserts].sort((x, y) => x.startTimeSeconds - y.startTimeSeconds);
}
