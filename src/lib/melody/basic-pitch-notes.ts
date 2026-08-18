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

/** After contour merge: drop squeezed ornaments. Isolated rest islands stay. */
export function polishMelodyTight(notes: BasicPitchNote[]): BasicPitchNote[] {
  return dropSqueezedGhosts(polishMelody(notes));
}

function cloneNote(n: BasicPitchNote): BasicPitchNote {
  return { ...n, pitchBends: n.pitchBends ? n.pitchBends.slice() : undefined };
}

/**
 * Drop a short interior ornament squeezed between two longer notes.
 * Isolated short syllables in a rest (昼回 第二句 `5` ~0.08s) stay.
 */
export function dropSqueezedGhosts(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 3) return notes;
  const GHOST = 0.125;
  const GAP = 0.22;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const prev = out[out.length - 1];
    const next = notes[i + 1];
    if (prev && next && n.durationSeconds <= GHOST) {
      const gapPrev = n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds);
      const gapNext = next.startTimeSeconds - (n.startTimeSeconds + n.durationSeconds);
      const squeezed = gapPrev < GAP && gapNext < GAP && gapPrev > -0.06 && gapNext > -0.06;
      const shorter =
        n.durationSeconds < prev.durationSeconds - 0.02 &&
        n.durationSeconds < next.durationSeconds - 0.02;
      const midi = Math.round(n.pitchMidi);
      const ornament =
        midi !== Math.round(prev.pitchMidi) && midi !== Math.round(next.pitchMidi);
      if (squeezed && shorter && ornament) continue;
    }
    out.push(cloneNote(n));
  }
  return out;
}

/**
 * Drop sub-160ms same-pitch blips in a gap. Not a syllable:
 * the C-major `2 2` pair (~0.19s, ~0.5s apart) must stay two notes.
 */
function nearestSamePitch(notes: BasicPitchNote[], i: number, dir: -1 | 1): BasicPitchNote | null {
  const pitch = Math.round(notes[i]!.pitchMidi);
  const t0 = notes[i]!.startTimeSeconds;
  for (let j = i + dir; j >= 0 && j < notes.length; j += dir) {
    const p = notes[j]!;
    if (Math.abs(p.startTimeSeconds - t0) > 0.45) break;
    if (Math.round(p.pitchMidi) === pitch) return p;
  }
  return null;
}

function lastSamePitch(kept: BasicPitchNote[], n: BasicPitchNote): BasicPitchNote | null {
  const pitch = Math.round(n.pitchMidi);
  for (let j = kept.length - 1; j >= 0; j--) {
    const p = kept[j]!;
    if (n.startTimeSeconds - p.startTimeSeconds > 0.45) break;
    if (Math.round(p.pitchMidi) === pitch) return p;
  }
  return null;
}

function dropPitchGhosts(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 2) return notes;
  const out: BasicPitchNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = cloneNote(notes[i]!);
    const short = n.durationSeconds < SHORT;
    const sameBehind = lastSamePitch(out, n);
    const sameAhead = nearestSamePitch(notes, i, 1);
    const gapPrev = sameBehind
      ? n.startTimeSeconds - (sameBehind.startTimeSeconds + sameBehind.durationSeconds)
      : Infinity;
    const gapNext = sameAhead
      ? sameAhead.startTimeSeconds - (n.startTimeSeconds + n.durationSeconds)
      : Infinity;
    const samePrev = Boolean(sameBehind && gapPrev < 0.22);
    const sameNext = Boolean(sameAhead && gapNext < 0.14);
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

/**
 * Bass doubled under a vocal note (midi < 62 while a midi≥64 overlaps,
 * starts with it, or is the same pitch class an octave up). Sequential C4
 * after E4 is a third — melody, not an octave double.
 */
function dropBassUnderMelody(notes: BasicPitchNote[]): BasicPitchNote[] {
  return notes.filter((n, i) => {
    if (n.pitchMidi >= 62) return true;
    const n0 = n.startTimeSeconds;
    const n1 = n0 + n.durationSeconds;
    return !notes.some((o, j) => {
      if (j === i || o.pitchMidi < 64) return false;
      const o0 = o.startTimeSeconds;
      const o1 = o0 + o.durationSeconds;
      const overlap = Math.min(n1, o1) - Math.max(n0, o0);
      const startDelta = Math.abs(o0 - n0);
      const octaveDouble = Math.abs(Math.round(o.pitchMidi) - Math.round(n.pitchMidi)) % 12 === 0;
      // True bass (<C4) still drops when a high note sits close.
      // C4 (60) after E4 is a third — keep unless it overlaps / doubles.
      const lowBass = n.pitchMidi < 58 && startDelta < 0.4;
      return overlap > 0.04 || startDelta < 0.12 || (octaveDouble && startDelta < 0.45) || lowBass;
    });
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

/** Gap from the last consecutive same-pitch note to the next degree (or +∞). */
function restAfterSamePitchGroup(notes: BasicPitchNote[], i: number): number {
  const pitch = Math.round(notes[i]!.pitchMidi);
  let k = i;
  while (k + 1 < notes.length && Math.round(notes[k + 1]!.pitchMidi) === pitch) k += 1;
  const last = notes[k]!;
  const nxt = notes[k + 1];
  if (!nxt) return Number.POSITIVE_INFINITY;
  return nxt.startTimeSeconds - (last.startTimeSeconds + last.durationSeconds);
}

/**
 * Same-pitch quarters/re-attacks with a rest (or gap) before the next degree.
 * Do not glue those into one hold — a miss here must stay local.
 */
function samePitchRunHasRestAfter(notes: BasicPitchNote[], i: number): boolean {
  const rest = restAfterSamePitchGroup(notes, i);
  return rest >= 0.08 && Number.isFinite(rest);
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
      startDelta > 0.12 &&
      startDelta < 0.32
    ) {
      out[out.length - 1] = cloneNote(cur);
      continue;
    }
    const span =
      Math.max(prev.startTimeSeconds + prev.durationSeconds, cur.startTimeSeconds + cur.durationSeconds) -
      prev.startTimeSeconds;
    // 120 BPM quarter re-attack (~0.5s). Do not glue two published repeats.
    const quarterReattack =
      cur.pitchMidi === prev.pitchMidi &&
      startDelta >= 0.42 &&
      startDelta <= 0.62 &&
      cur.durationSeconds >= 0.14 &&
      prev.durationSeconds >= 0.14;
    if (quarterReattack) {
      prev.durationSeconds = Math.max(0.05, cur.startTimeSeconds - prev.startTimeSeconds);
      out.push(cloneNote(cur));
      continue;
    }
    if (cur.pitchMidi === prev.pitchMidi && isSyllableRun(notes, i)) {
      out.push(cloneNote(cur));
      continue;
    }
    // Leftover 0.16–0.21s same-pitch chop after a real note. Drop it —
    // absorbing extends prev and makes 1 2 1 look like a neighbor-return.
    const leftoverChop =
      cur.pitchMidi === prev.pitchMidi &&
      cur.durationSeconds < 0.24 &&
      prev.durationSeconds >= SHORT &&
      startDelta < 0.42 &&
      gap < 0.18 &&
      gap > -0.08;
    if (leftoverChop) {
      continue;
    }
    const moreSamePitch = Boolean(
      notes[i + 1] && Math.round(notes[i + 1]!.pitchMidi) === Math.round(cur.pitchMidi),
    );
    const absorbLeftover = moreSamePitch || !samePitchRunHasRestAfter(notes, i);
    // Rest after a same-pitch run: keep two substantial re-attacks split.
    // 青花瓷 `5 5 3` is 0.34s IOI with both pieces ≥0.22s — keep. Short 0.17s
    // leftovers (稻香 / 告白气球 +1) already dropped above.
    if (
      cur.pitchMidi === prev.pitchMidi &&
      cur.durationSeconds >= 0.22 &&
      prev.durationSeconds >= 0.22 &&
      startDelta >= 0.32 &&
      startDelta < 0.7 &&
      samePitchRunHasRestAfter(notes, i)
    ) {
      prev.durationSeconds = Math.max(
        0.05,
        Math.min(prev.durationSeconds, cur.startTimeSeconds - prev.startTimeSeconds),
      );
      out.push(cloneNote(cur));
      continue;
    }
    // One triangle/BP note chopped into two onsets (combined span still one beat).
    // Short syllable runs stay; only merge when the first piece is already a hold.
    if (
      cur.pitchMidi === prev.pitchMidi &&
      prev.durationSeconds >= 0.2 &&
      gap < 0.05 &&
      gap > -0.08 &&
      span <= 0.52 &&
      startDelta < 0.42 &&
      startDelta > 0.12
    ) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      );
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude);
      continue;
    }
    if (
      cur.pitchMidi === prev.pitchMidi &&
      prev.durationSeconds >= SHORT &&
      cur.durationSeconds < SHORT &&
      startDelta < 0.42 &&
      gap < 0.25 &&
      gap > -0.05 &&
      absorbLeftover
    ) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      );
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude);
      continue;
    }
    if (cur.pitchMidi === prev.pitchMidi && startDelta >= 0.42 && cur.durationSeconds >= 0.17) {
      if (gap < 0) {
        prev.durationSeconds = Math.max(0.05, cur.startTimeSeconds - prev.startTimeSeconds);
      }
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
        // Synth quarters are all ~0.4–0.5s; a real echo is much longer than Y.
        const echo =
          n.durationSeconds >= 0.5 && n.durationSeconds >= prev.durationSeconds + 0.16;
        if (step >= 1 && step <= 2 && echo) {
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
    if (samePrev && (trail || n.durationSeconds < 0.2)) {
      // A long same-pitch lyric run (稻香 8×3) is not a cadence trail.
      let lo = i;
      let hi = i;
      const pitch = Math.round(n.pitchMidi);
      while (lo > 0 && Math.round(notes[lo - 1]!.pitchMidi) === pitch) lo -= 1;
      while (hi + 1 < notes.length && Math.round(notes[hi + 1]!.pitchMidi) === pitch) hi += 1;
      const lyricRun = hi - lo + 1 >= 4 && n.durationSeconds >= 0.2 && samePitchRunHasRestAfter(notes, i);
      if (!lyricRun) continue;
    }
    // Leftover after a finished neighbor cell (`1 2 1` then a held 1 before 3).
    // A stepwise pair (`1 2 1 1 2`) stays; only a leap (cadence 1→3) is an echo.
    if (samePrev && n.durationSeconds >= 0.2 && next && out.length >= 3) {
      const older = out[out.length - 2]!;
      const x = out[out.length - 3]!;
      const neighbor =
        Math.round(older.pitchMidi) !== Math.round(n.pitchMidi) &&
        Math.abs(Math.round(older.pitchMidi) - Math.round(prev!.pitchMidi)) <= 2;
      const finishedCell = Math.round(x.pitchMidi) === Math.round(n.pitchMidi);
      const leap = Math.abs(Math.round(next.pitchMidi) - Math.round(n.pitchMidi)) >= 3;
      if (neighbor && finishedCell && leap) continue;
    }
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
