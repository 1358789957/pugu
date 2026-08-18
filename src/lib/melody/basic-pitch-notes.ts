import { makeNoteId, resetNoteIds, type NoteEvent } from "./notes";
import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_OPTS } from "./basic-pitch-options";

const MELODY_MIDI_LO = 55;
const MELODY_MIDI_HI = 79;
const SHORT = 0.16;

/** Prefer a single vocal melody: drop accompaniment, resolve overlaps. */
export function pickMelodyNotes(events: BasicPitchNote[]): BasicPitchNote[] {
  const { minFreq, maxFreq } = BASIC_PITCH_OPTS;
  const inBand = events.filter((n) => {
    if (n.durationSeconds < 0.04) return false;
    if (n.amplitude < 0.05) return false;
    const midi = Math.round(n.pitchMidi);
    if (midi < MELODY_MIDI_LO || midi > MELODY_MIDI_HI) return false;
    const hz = 440 * 2 ** ((midi - 69) / 12);
    return hz >= minFreq && hz <= maxFreq;
  });

  const sorted = [...inBand].sort((a, b) => {
    if (a.startTimeSeconds !== b.startTimeSeconds) {
      return a.startTimeSeconds - b.startTimeSeconds;
    }
    return b.amplitude - a.amplitude;
  });

  const picked: BasicPitchNote[] = [];
  for (const raw of sorted) {
    const n = cloneNote(raw);
    const nEnd = n.startTimeSeconds + n.durationSeconds;
    let clash = -1;
    for (let i = 0; i < picked.length; i++) {
      const p = picked[i]!;
      const pEnd = p.startTimeSeconds + p.durationSeconds;
      const overlap = Math.min(nEnd, pEnd) - Math.max(n.startTimeSeconds, p.startTimeSeconds);
      if (overlap > 0.04) {
        clash = i;
        break;
      }
    }
    if (clash < 0) {
      picked.push(n);
      continue;
    }
    const prev = picked[clash]!;
    if (Math.round(n.pitchMidi) === Math.round(prev.pitchMidi)) {
      const startDelta = n.startTimeSeconds - prev.startTimeSeconds;
      if (startDelta > 0.07) {
        prev.durationSeconds = Math.max(0.05, n.startTimeSeconds - prev.startTimeSeconds);
        picked.push(n);
      } else {
        const end = Math.max(
          prev.startTimeSeconds + prev.durationSeconds,
          n.startTimeSeconds + n.durationSeconds,
        );
        prev.durationSeconds = end - prev.startTimeSeconds;
        prev.amplitude = Math.max(prev.amplitude, n.amplitude);
      }
      continue;
    }
    const octaveRelated = Math.abs(n.pitchMidi - prev.pitchMidi) % 12 === 0;
    if (octaveRelated) {
      if (melodyScore(n) > melodyScore(prev)) picked[clash] = n;
      continue;
    }
    const startDelta = n.startTimeSeconds - prev.startTimeSeconds;
    if (
      startDelta > 0.1 &&
      n.durationSeconds >= 0.11 &&
      n.amplitude >= 0.22 &&
      n.pitchMidi >= 64
    ) {
      prev.durationSeconds = Math.max(0.05, n.startTimeSeconds - prev.startTimeSeconds);
      picked.push(n);
      continue;
    }
    if (prev.pitchMidi >= 64 && n.pitchMidi < 62) continue;
    if (n.pitchMidi >= 64 && prev.pitchMidi < 62) {
      picked[clash] = n;
      continue;
    }
    if (melodyScore(n) > melodyScore(prev) * 1.08) {
      picked[clash] = n;
    }
  }

  picked.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  return polishMelody(dropPitchGhosts(dropChromaticSlides(dropBassUnderMelody(picked))));
}

/** Second-pass line cleanup after gap-fill or another decoder. */
export function polishMelody(notes: BasicPitchNote[]): BasicPitchNote[] {
  return dropLateSamePitchEcho(
    dropPassingTones(dropNeighborReturns(dropFlourishRehits(mergeAdjacent(notes)))),
  );
}

function cloneNote(n: BasicPitchNote): BasicPitchNote {
  return { ...n, pitchBends: n.pitchBends ? n.pitchBends.slice() : undefined };
}

/**
 * Drop sub-160ms same-pitch blips in a gap. Not a syllable:
 * the C-major `2 2` pair (~0.19s, ~0.5s apart) must stay two notes.
 */
function dropPitchGhosts(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 2) return notes;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = cloneNote(notes[i]!);
    const prev = out[out.length - 1];
    const next = notes[i + 1];
    const short = n.durationSeconds < SHORT;
    const gapPrev = prev
      ? n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
      : Infinity;
    const gapNext = next
      ? next.startTimeSeconds - (n.startTimeSeconds + n.durationSeconds)
      : Infinity;
    const samePrev = Boolean(prev && prev.pitchMidi === n.pitchMidi && gapPrev < 0.22);
    const sameNext = Boolean(next && next.pitchMidi === n.pitchMidi && gapNext < 0.14);
    if (short && (samePrev || sameNext) && !shortPitchRun(notes, i)) {
      continue;
    }
    out.push(n);
  }
  return out;
}

/** Two or more short same-pitch hits in a row are syllables (`1 1 1`), not a gap ghost. */
function shortPitchRun(notes: BasicPitchNote[], i: number): boolean {
  const n = notes[i]!;
  let count = 1;
  for (let j = i - 1; j >= 0; j--) {
    const p = notes[j]!;
    if (p.pitchMidi !== n.pitchMidi || p.durationSeconds >= SHORT) break;
    if (n.startTimeSeconds - p.startTimeSeconds > 0.7) break;
    count++;
  }
  for (let j = i + 1; j < notes.length; j++) {
    const p = notes[j]!;
    if (p.pitchMidi !== n.pitchMidi || p.durationSeconds >= SHORT) break;
    if (p.startTimeSeconds - n.startTimeSeconds > 0.7) break;
    count++;
  }
  return count >= 2;
}

/** Bass under a nearby vocal note (midi < 62 while a midi≥64 sits close). Isolated C4 tests stay. */
function dropBassUnderMelody(notes: BasicPitchNote[]): BasicPitchNote[] {
  return notes.filter((n, i) => {
    if (n.pitchMidi >= 62) return true;
    return !notes.some(
      (o, j) =>
        j !== i &&
        o.pitchMidi >= 64 &&
        Math.abs(o.startTimeSeconds - n.startTimeSeconds) < 0.4,
    );
  });
}

function dropChromaticSlides(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 3) return notes;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const prev = out[out.length - 1];
    const next = notes[i + 1];
    const short = n.durationSeconds < SHORT;
    const nearPrev = prev && Math.abs(Math.round(n.pitchMidi) - Math.round(prev.pitchMidi)) === 1;
    const nearNext = next && Math.abs(Math.round(n.pitchMidi) - Math.round(next.pitchMidi)) === 1;
    if (short && nearPrev && nearNext && n.amplitude < 0.4 && n.durationSeconds < 0.12) {
      continue;
    }
    if (n.durationSeconds < 0.12 && nearNext && next && n.amplitude < next.amplitude * 0.9) continue;
    out.push(cloneNote(n));
  }
  return out;
}

function melodyScore(n: BasicPitchNote): number {
  const band = n.pitchMidi >= 55 && n.pitchMidi <= 79 ? 1.4 : 0.7;
  return n.amplitude * band;
}

/**
 * ≥4 short same-pitch onsets with 16th-ish spacing, then a rest, are
 * repeated syllables — not one held tone that Basic Pitch chopped.
 */
export function isSyllableRun(notes: BasicPitchNote[], i: number): boolean {
  const n = notes[i];
  if (!n || n.durationSeconds >= 0.17) return false;
  let lo = i;
  let hi = i;
  while (lo > 0) {
    const p = notes[lo - 1]!;
    if (Math.round(p.pitchMidi) !== Math.round(n.pitchMidi)) break;
    if (n.startTimeSeconds - p.startTimeSeconds > 0.8) break;
    lo--;
  }
  while (hi + 1 < notes.length) {
    const p = notes[hi + 1]!;
    if (Math.round(p.pitchMidi) !== Math.round(n.pitchMidi)) break;
    if (p.startTimeSeconds - n.startTimeSeconds > 0.8) break;
    hi++;
  }
  const group = notes.slice(lo, hi + 1);
  if (group.length < 4) return false;
  if (group.some((g) => g.durationSeconds >= 0.17)) return false;
  for (let k = 1; k < group.length; k++) {
    const ioi = group[k]!.startTimeSeconds - group[k - 1]!.startTimeSeconds;
    if (ioi < 0.07 || ioi > 0.18) return false;
  }
  const last = group[group.length - 1]!;
  const end = last.startTimeSeconds + last.durationSeconds;
  const next = notes.slice(hi + 1).find((x) => Math.round(x.pitchMidi) !== Math.round(n.pitchMidi));
  return Boolean(next && next.startTimeSeconds - end >= 0.12);
}

function mergeAdjacent(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length === 0) return notes;
  const out: BasicPitchNote[] = [cloneNote(notes[0]!)];
  for (let i = 1; i < notes.length; i++) {
    const cur = notes[i]!;
    const prev = out[out.length - 1]!;
    const gap = cur.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds);
    const startDelta = cur.startTimeSeconds - prev.startTimeSeconds;
    if (
      cur.pitchMidi === prev.pitchMidi &&
      prev.durationSeconds < SHORT &&
      cur.durationSeconds >= SHORT &&
      startDelta > 0.12
    ) {
      out[out.length - 1] = cloneNote(cur);
      continue;
    }
    const next = notes[i + 1];
    const beforeNewPitch = !next || next.pitchMidi !== cur.pitchMidi;
    if (
      cur.pitchMidi === prev.pitchMidi &&
      prev.durationSeconds >= SHORT &&
      cur.durationSeconds < SHORT &&
      startDelta < 0.5 &&
      gap < 0.25 &&
      gap > -0.05
    ) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      );
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude);
      continue;
    }
    if (cur.pitchMidi === prev.pitchMidi && isSyllableRun(notes, i)) {
      out.push(cloneNote(cur));
      continue;
    }
    if (cur.pitchMidi === prev.pitchMidi && startDelta > 0.3 && cur.durationSeconds >= 0.17) {
      prev.durationSeconds = Math.max(0.05, cur.startTimeSeconds - prev.startTimeSeconds);
      out.push(cloneNote(cur));
      continue;
    }
    if (cur.pitchMidi === prev.pitchMidi && startDelta <= 0.3 && gap < 0.08 && gap > -0.08) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      );
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude);
      continue;
    }
    if (cur.pitchMidi === prev.pitchMidi && cur.durationSeconds < SHORT && startDelta <= 0.3) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      );
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude);
      continue;
    }
    void beforeNewPitch;
    out.push(cloneNote(cur));
  }
  return out;
}

/**
 * After a repeated-syllable flourish on P plus the next degree Q, leftover
 * re-hits of P or Q are echoes, not new lyric notes.
 */
function dropFlourishRehits(notes: BasicPitchNote[]): BasicPitchNote[] {
  const out: BasicPitchNote[] = [];
  let skipP: number | null = null;
  let skipQ: number | null = null;
  let skipUntil = 0;
  for (const n of notes) {
    const midi = Math.round(n.pitchMidi);
    if (skipP != null && n.startTimeSeconds < skipUntil && (midi === skipP || midi === skipQ)) {
      continue;
    }
    if (skipP != null && n.startTimeSeconds >= skipUntil) {
      skipP = null;
      skipQ = null;
    }
    out.push(cloneNote(n));
    if (out.length < 5) continue;
    const q = out[out.length - 1]!;
    const qMidi = Math.round(q.pitchMidi);
    let run = 0;
    let runMidi = -1;
    for (let j = out.length - 2; j >= 0; j--) {
      const p = out[j]!;
      const pMidi = Math.round(p.pitchMidi);
      if (j === out.length - 2) {
        if (pMidi === qMidi) break;
        runMidi = pMidi;
      }
      if (pMidi !== runMidi || p.durationSeconds >= 0.17) break;
      if (q.startTimeSeconds - p.startTimeSeconds > 1.1) break;
      run++;
    }
    if (run < 4) continue;
    const runEnd = out[out.length - 2]!;
    if (q.startTimeSeconds - (runEnd.startTimeSeconds + runEnd.durationSeconds) < 0.12) continue;
    skipP = runMidi;
    skipQ = qMidi;
    skipUntil = q.startTimeSeconds + 0.85;
  }
  return out;
}

/** Drop the long return X in X Y X when Y is a neighbor. Keep X Y Y. */
function dropNeighborReturns(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 3) return notes;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const prev = out[out.length - 1];
    if (prev && out.length >= 2) {
      const older = out[out.length - 2]!;
      if (Math.round(n.pitchMidi) === Math.round(older.pitchMidi)) {
        const step = Math.abs(Math.round(n.pitchMidi) - Math.round(prev.pitchMidi));
        if (step >= 1 && step <= 2 && n.durationSeconds >= 0.5 && n.durationSeconds > prev.durationSeconds) {
          continue;
        }
      }
    }
    out.push(cloneNote(n));
  }
  return out;
}

/**
 * A later same-pitch hit more than ~a beat later is a new cell or leftover,
 * not the C-major `2 2` pair (~0.52s). Keep the first, drop the late echo.
 */
function dropLateSamePitchEcho(notes: BasicPitchNote[]): BasicPitchNote[] {
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const prev = out[out.length - 1];
    const next = notes[i + 1];
    const samePrev =
      prev &&
      Math.round(prev.pitchMidi) === Math.round(n.pitchMidi) &&
      n.startTimeSeconds - prev.startTimeSeconds > 0.62;
    const trail = Boolean(next && Math.round(next.pitchMidi) === Math.round(n.pitchMidi));
    if (samePrev && (trail || n.durationSeconds < 0.2)) continue;
    out.push(cloneNote(n));
  }
  return out;
}

/** Short stepwise passing tone between two notes a third apart. */
function dropPassingTones(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 3) return notes;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const prev = out[out.length - 1];
    const next = notes[i + 1];
    if (prev && next && n.durationSeconds < SHORT) {
      const a = Math.round(prev.pitchMidi);
      const b = Math.round(n.pitchMidi);
      const c = Math.round(next.pitchMidi);
      const left = Math.abs(b - a);
      const right = Math.abs(c - b);
      const span = Math.abs(c - a);
      if (left === 2 && right === 2 && span === 4) continue;
    }
    out.push(cloneNote(n));
  }
  return out;
}

export function toPuguNotes(events: BasicPitchNote[]): NoteEvent[] {
  resetNoteIds();
  return events.map((n) => {
    const start = Math.max(0, n.startTimeSeconds);
    const duration = Math.max(0.05, n.durationSeconds);
    const midi = Math.round(n.pitchMidi);
    const amp = Math.min(1, Math.max(0, n.amplitude));
    return {
      id: makeNoteId(),
      midi,
      start,
      duration,
      velocity: Math.max(0.18, Math.min(1, amp * 1.15 + 0.2)),
      confidence: Math.min(1, 0.4 + amp * 0.65),
      rawStart: start,
      rawDuration: duration,
    };
  });
}
