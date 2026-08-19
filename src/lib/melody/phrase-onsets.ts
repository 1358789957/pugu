import { buildPitchContour, type ContourFrame } from "./pitch-contour";

export type PhraseWindow = {
  start: number;
  end: number;
  text?: string;
};

export type PhraseOnset = {
  /** Actual vocal attack (seconds). MIDI export uses this. */
  t: number;
  duration: number;
  rms: number;
  conf: number;
  /** Folded f0 median in the run — a hint, not a locked pitch. */
  midiHint: number;
  /** True when the raw tuner sat an octave outside the singing band. */
  octaveFolded: boolean;
};

export type PhraseOnsetResult = {
  count: number;
  onsets: PhraseOnset[];
  window: PhraseWindow;
};

export type OnsetCountOptions = {
  minDuration?: number;
  minConfidence?: number;
  minRms?: number;
  dipRatio?: number;
  mergeGap?: number;
  /** Minimum inter-onset interval. Syllable floor, not a 16th export snap. */
  minIoI?: number;
  pad?: number;
};

const DEFAULTS = {
  minDuration: 0.09,
  minConfidence: 0.36,
  minRms: 0.012,
  dipRatio: 0.42,
  mergeGap: 0.08,
  minIoI: 0.12,
  pad: 0.05,
} as const;

const SING_LO = 58;
const SING_HI = 81;
const CORE_LO = 62;
const CORE_HI = 76;

/**
 * Fold a raw tuner MIDI into the singing band. Octave only — never a
 * diatonic rewrite.
 */
export function foldSingingMidi(midi: number): { midi: number; folded: boolean } {
  if (midi <= 0) return { midi: 0, folded: false };
  let m = Math.round(midi);
  let folded = false;
  while (m < SING_LO) {
    m += 12;
    folded = true;
  }
  while (m > SING_HI) {
    m -= 12;
    folded = true;
  }
  return { midi: m, folded };
}

/** Pitch class 0–11. B3 and B4 are the same singing degree. */
export function singingPitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function sameSingingPc(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return singingPitchClass(a) === singingPitchClass(b);
}

function addVote(votes: Map<number, number>, midi: number) {
  votes.set(midi, (votes.get(midi) ?? 0) + 1);
}

function mergeVotes(into: Map<number, number>, from: Map<number, number>) {
  for (const [midi, n] of from) into.set(midi, (into.get(midi) ?? 0) + n);
}

/** Prefer the in-band octave when YIN flips B3/B4 inside one syllable. */
function pickBandMidi(votes: Map<number, number>, fallback: number): number {
  let best = fallback;
  let bestScore = -1;
  for (const [midi, n] of votes) {
    const band = midi >= CORE_LO && midi <= CORE_HI ? 3 : midi >= SING_LO && midi <= SING_HI ? 1 : 0;
    const score = n + band;
    if (score > bestScore) {
      bestScore = score;
      best = midi;
    }
  }
  return best;
}

function localEnergyDip(frames: ContourFrame[], i: number, dipRatio: number): boolean {
  const rms = frames[i]!.rms;
  const prev = frames[Math.max(0, i - 3)]!.rms;
  const next = frames[Math.min(frames.length - 1, i + 3)]!.rms;
  const peak = Math.max(prev, next, 1e-6);
  return rms < peak * dipRatio && prev > rms * 1.15 && next > rms * 1.15;
}

type Run = {
  midi: number;
  pc: number;
  start: number;
  end: number;
  rms: number;
  conf: number;
  n: number;
  folded: boolean;
  articulated: boolean;
  votes: Map<number, number>;
};

function finalizeRun(r: Run): Run {
  r.midi = pickBandMidi(r.votes, r.midi);
  return r;
}

/**
 * Segment a raw (not wavelength-continued) contour into syllable onsets.
 * Same-pitch re-attacks stay separate when energy dips. Pitch-change splits
 * use singing pitch class, so B3/B4 flicker is one note, not two ghosts.
 */
export function onsetsFromContour(
  frames: ContourFrame[],
  window: PhraseWindow,
  opts: OnsetCountOptions = {},
): PhraseOnsetResult {
  const minConf = opts.minConfidence ?? DEFAULTS.minConfidence;
  const minDur = opts.minDuration ?? DEFAULTS.minDuration;
  const minRms = opts.minRms ?? DEFAULTS.minRms;
  const dipRatio = opts.dipRatio ?? DEFAULTS.dipRatio;
  const mergeGap = opts.mergeGap ?? DEFAULTS.mergeGap;
  const minIoI = opts.minIoI ?? DEFAULTS.minIoI;
  const hop = frames.length > 1 ? frames[1]!.t - frames[0]!.t : 0.01;

  const runs: Run[] = [];
  let cur: Run | null = null;
  let unvoicedAt = -1;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.t < window.start - 0.02 || f.t >= window.end + 0.02) {
      if (cur) {
        cur.end = Math.min(cur.end, window.end);
        runs.push(finalizeRun(cur));
        cur = null;
      }
      if (unvoicedAt < 0) unvoicedAt = f.t;
      continue;
    }
    const folded = foldSingingMidi(f.midi);
    const voiced = f.voiced && f.conf >= minConf && f.rms >= minRms && folded.midi > 0;
    if (!voiced) {
      if (cur) {
        cur.end = f.t;
        runs.push(finalizeRun(cur));
        cur = null;
      }
      if (unvoicedAt < 0) unvoicedAt = f.t;
      continue;
    }
    const pc = singingPitchClass(folded.midi);
    let pitchChange = false;
    let reattack = false;
    if (cur) {
      pitchChange = cur.pc !== pc;
      reattack = !pitchChange && localEnergyDip(frames, i, dipRatio);
    }
    const restReattack: boolean = !cur && unvoicedAt >= 0 && f.t - unvoicedAt >= 0.055;
    if (!cur || pitchChange || reattack) {
      if (cur) {
        cur.end = f.t;
        runs.push(finalizeRun(cur));
      }
      const votes = new Map<number, number>();
      addVote(votes, folded.midi);
      cur = {
        midi: folded.midi,
        pc,
        start: f.t,
        end: f.t + hop,
        rms: f.rms,
        conf: f.conf,
        n: 1,
        folded: folded.folded,
        articulated: reattack || restReattack,
        votes,
      };
      unvoicedAt = -1;
    } else {
      cur.end = f.t + hop;
      cur.rms += f.rms;
      cur.conf += f.conf;
      cur.n += 1;
      cur.folded = cur.folded || folded.folded;
      addVote(cur.votes, folded.midi);
      unvoicedAt = -1;
    }
  }
  if (cur) runs.push(finalizeRun(cur));

  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    const tinyDropout =
      last &&
      last.pc === r.pc &&
      !r.articulated &&
      r.start - last.end <= Math.min(0.045, mergeGap);
    if (tinyDropout) {
      last.end = r.end;
      last.rms += r.rms;
      last.conf += r.conf;
      last.n += r.n;
      last.folded = last.folded || r.folded;
      mergeVotes(last.votes, r.votes);
      last.midi = pickBandMidi(last.votes, last.midi);
    } else {
      merged.push({
        ...r,
        votes: new Map(r.votes),
      });
    }
  }

  const durable: PhraseOnset[] = [];
  const rejected: { r: Run; start: number; duration: number }[] = [];
  for (const r of merged) {
    const start = Math.max(window.start, r.start);
    if (start < window.start || start >= window.end) continue;
    const duration = Math.min(window.end, r.end) - start;
    // 0.089999 from hop float must still count as minDur (15.98 on 昼回 第三句).
    if (duration + 0.005 < minDur) {
      rejected.push({ r, start, duration });
      continue;
    }
    const prev = durable[durable.length - 1];
    if (prev && start - prev.t < minIoI) {
      if (duration > prev.duration) {
        prev.t = start;
        prev.duration = duration;
        prev.midiHint = r.midi;
        prev.rms = r.rms / r.n;
        prev.conf = r.conf / r.n;
        prev.octaveFolded = r.folded;
      } else {
        prev.duration = Math.max(prev.duration, start + duration - prev.t);
      }
      continue;
    }
    durable.push({
      t: start,
      duration,
      rms: r.rms / r.n,
      conf: r.conf / r.n,
      midiHint: r.midi,
      octaveFolded: r.folded,
    });
  }

  // Isolated short pulses in a real gap (14.02 on 昼回 第三句). Not leading
  // ghosts, not glide crumbs hugging the next attack, not low-rms leftovers.
  const onsets = [...durable];
  for (const { r, start, duration } of rejected) {
    if (duration < 0.045 || r.rms / r.n < 0.12) continue;
    let insertAt = onsets.findIndex((o) => o.t > start);
    if (insertAt < 0) insertAt = onsets.length;
    const prev = insertAt > 0 ? onsets[insertAt - 1] : undefined;
    const next = onsets[insertAt];
    if (!prev) continue;
    if (next && next.t - start < 0.12) continue;
    if (sameSingingPc(prev.midiHint, r.midi) && start - (prev.t + prev.duration) <= 0.045) continue;
    if (prev && start - prev.t < minIoI - 0.01) continue;
    onsets.splice(insertAt, 0, {
      t: start,
      duration,
      rms: r.rms / r.n,
      conf: r.conf / r.n,
      midiHint: r.midi,
      octaveFolded: r.folded,
    });
  }
  onsets.sort((a, b) => a.t - b.t);

  for (let i = 0; i < onsets.length; i++) {
    const nextT = onsets[i + 1]?.t ?? window.end;
    const cap = Math.max(minDur, nextT - onsets[i]!.t);
    onsets[i]!.duration = Math.min(onsets[i]!.duration, cap);
  }

  return { count: onsets.length, onsets, window };
}

/**
 * Phrase-local vocal onset count.
 *
 * Given an isolated-vocal buffer and a lyric/energy phrase window, returns
 * syllable onsets from energy rises and f0 re-attacks. Does **not** ingest a
 * polyphonic Basic Pitch stream.
 *
 * Check (in-repo dry vocal, do not invent pop MP3s):
 *   昼回 第一句 1.45–6.4s  → N close to 14  (`12323432712271`)
 *   昼回 第二句 7.55–12.0s → N close to 13  (`6711111751213`)
 *   昼回 第三句 12.55–16.15s → N close to 14 (ear `12323632712231`;
 *     stem f0 may still miss the 6 — do not hardcode that string)
 */
export function countPhraseOnsets(
  samples: Float32Array,
  sampleRate: number,
  window: PhraseWindow,
  opts: OnsetCountOptions = {},
): PhraseOnsetResult {
  const pad = opts.pad ?? DEFAULTS.pad;
  const t0 = Math.max(0, window.start - pad);
  const t1 = Math.min(samples.length / sampleRate, window.end + pad);
  const a = Math.max(0, Math.floor(t0 * sampleRate));
  const b = Math.min(samples.length, Math.floor(t1 * sampleRate));
  const slice = samples.subarray(a, Math.max(a + 1, b));
  const frames = buildPitchContour(slice, sampleRate, t0, 0.01);
  return onsetsFromContour(frames, window, opts);
}

export type VocalPhraseOptions = {
  gap?: number;
  minDuration?: number;
  maxDuration?: number;
  minRms?: number;
};

/**
 * Cut phrases from isolated-vocal energy. Extra notes later stay in their
 * own window — they cannot shift a later phrase.
 */
export function detectVocalPhrases(
  samples: Float32Array,
  sampleRate: number,
  opts: VocalPhraseOptions = {},
): PhraseWindow[] {
  const frames = buildPitchContour(samples, sampleRate, 0, 0.01);
  return detectVocalPhrasesFromFrames(frames, opts);
}

export function detectVocalPhrasesFromFrames(
  frames: ContourFrame[],
  opts: VocalPhraseOptions = {},
): PhraseWindow[] {
  const gap = opts.gap ?? 0.42;
  const minDur = opts.minDuration ?? 0.7;
  const maxDur = opts.maxDuration ?? 7.6;
  const minRms = opts.minRms ?? 0.012;
  const phrases: PhraseWindow[] = [];
  let start = -1;
  let last = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    const dur = end - start;
    if (dur >= minDur) phrases.push({ start, end: end + 0.04 });
    start = -1;
    last = -1;
  };
  for (const f of frames) {
    const v = f.voiced && f.rms >= minRms;
    if (v) {
      if (start < 0) start = f.t;
      if (f.t - start > maxDur) {
        flush(last >= 0 ? last : f.t);
        start = f.t;
      }
      last = f.t;
    } else if (start >= 0 && last >= 0 && f.t - last > gap) {
      flush(last);
    }
  }
  if (start >= 0 && last >= 0) flush(last);
  return phrases;
}

/** Map lyric lines onto already-cut windows. Extra lines do not steal later notes. */
export function pairLyricLines(
  phrases: PhraseWindow[],
  lyrics: { start?: number; end?: number; text: string }[],
): PhraseWindow[] {
  if (!lyrics.length) return phrases;
  if (!phrases.length) {
    return lyrics
      .filter((l) => Number.isFinite(l.start) && Number.isFinite(l.end))
      .map((l) => ({ start: l.start as number, end: l.end as number, text: l.text }));
  }
  return phrases.map((p, i) => ({
    ...p,
    text: lyrics[i]?.text ?? p.text,
  }));
}
