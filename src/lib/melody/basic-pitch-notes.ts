import { makeNoteId, resetNoteIds, type NoteEvent } from "./notes";
import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_OPTS } from "./basic-pitch-options";

const MELODY_MIDI_LO = 55
const MELODY_MIDI_HI = 79

/** Prefer a single vocal melody: drop accompaniment, resolve overlaps. */
export function pickMelodyNotes(events: BasicPitchNote[]): BasicPitchNote[] {
  const { minFreq, maxFreq } = BASIC_PITCH_OPTS
  const inBand = events.filter((n) => {
    if (n.durationSeconds < 0.04) return false
    if (n.amplitude < 0.05) return false
    const midi = n.pitchMidi
    if (midi < MELODY_MIDI_LO || midi > MELODY_MIDI_HI) return false
    const hz = 440 * 2 ** ((midi - 69) / 12)
    return hz >= minFreq && hz <= maxFreq
  })

  const sorted = [...inBand].sort((a, b) => {
    if (a.startTimeSeconds !== b.startTimeSeconds) {
      return a.startTimeSeconds - b.startTimeSeconds
    }
    return b.amplitude - a.amplitude
  })

  const picked: BasicPitchNote[] = []
  for (const n of sorted) {
    const nEnd = n.startTimeSeconds + n.durationSeconds
    let clash = -1
    for (let i = 0; i < picked.length; i++) {
      const p = picked[i]!
      const pEnd = p.startTimeSeconds + p.durationSeconds
      const overlap = Math.min(nEnd, pEnd) - Math.max(n.startTimeSeconds, p.startTimeSeconds)
      if (overlap > 0.04) {
        clash = i
        break
      }
    }
    if (clash < 0) {
      picked.push(n)
      continue
    }
    const prev = picked[clash]!
    if (n.pitchMidi === prev.pitchMidi) {
      const startDelta = n.startTimeSeconds - prev.startTimeSeconds
      const gap = n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
      if (startDelta > 0.3 && n.durationSeconds >= 0.17) {
        prev.durationSeconds = Math.max(0.05, n.startTimeSeconds - prev.startTimeSeconds)
        picked.push(n)
      } else if (gap < 0.06) {
        const end = Math.max(
          prev.startTimeSeconds + prev.durationSeconds,
          n.startTimeSeconds + n.durationSeconds,
        )
        prev.durationSeconds = end - prev.startTimeSeconds
        prev.amplitude = Math.max(prev.amplitude, n.amplitude)
      } else if (startDelta > 0.18 && n.durationSeconds >= 0.16) {
        prev.durationSeconds = Math.max(0.05, n.startTimeSeconds - prev.startTimeSeconds)
        picked.push(n)
      } else {
        const end = Math.max(
          prev.startTimeSeconds + prev.durationSeconds,
          n.startTimeSeconds + n.durationSeconds,
        )
        prev.durationSeconds = end - prev.startTimeSeconds
        prev.amplitude = Math.max(prev.amplitude, n.amplitude)
      }
      continue
    }
    const octaveRelated = Math.abs(n.pitchMidi - prev.pitchMidi) % 12 === 0
    if (octaveRelated) {
      if (melodyScore(n) > melodyScore(prev)) picked[clash] = n
      continue
    }
    const startDelta = n.startTimeSeconds - prev.startTimeSeconds
    if (
      startDelta > 0.1 &&
      n.durationSeconds >= 0.11 &&
      n.amplitude >= 0.22 &&
      n.pitchMidi >= 64
    ) {
      prev.durationSeconds = Math.max(0.05, n.startTimeSeconds - prev.startTimeSeconds)
      picked.push(n)
      continue
    }
    if (prev.pitchMidi >= 64 && n.pitchMidi < 62) continue
    if (n.pitchMidi >= 64 && prev.pitchMidi < 62) {
      picked[clash] = n
      continue
    }
    if (melodyScore(n) > melodyScore(prev) * 1.08) {
      picked[clash] = n
    }
  }

  picked.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
  // Ghosts first: merging a 140ms blip into the next syllable steals its onset
  // (the C-major 2 2 pair must keep the later start, not the ghost).
  return mergeAdjacent(
    dropPitchGhosts(dropChromaticSlides(dropBassUnderMelody(picked))),
  )
}

/**
 * Drop sub-160ms same-pitch blips in a gap. Not a syllable:
 * the C-major `2 2` pair (~0.19s, ~0.5s apart) must stay two notes.
 */
function dropPitchGhosts(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 2) return notes
  const out: BasicPitchNote[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = { ...notes[i]! }
    const prev = out[out.length - 1]
    const next = notes[i + 1]
    const short = n.durationSeconds < 0.16
    const gapPrev = prev
      ? n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
      : Infinity
    const gapNext = next
      ? next.startTimeSeconds - (n.startTimeSeconds + n.durationSeconds)
      : Infinity
    const samePrev = Boolean(prev && prev.pitchMidi === n.pitchMidi && gapPrev < 0.22)
    const sameNext = Boolean(next && next.pitchMidi === n.pitchMidi && gapNext < 0.14)
    if (short && (samePrev || sameNext) && !shortPitchRun(notes, i)) {
      continue
    }
    out.push(n)
  }
  return out
}

/** Two or more short same-pitch hits in a row are syllables (`1 1 1`), not a gap ghost. */
function shortPitchRun(notes: BasicPitchNote[], i: number): boolean {
  const n = notes[i]!
  let count = 1
  for (let j = i - 1; j >= 0; j--) {
    const p = notes[j]!
    if (p.pitchMidi !== n.pitchMidi || p.durationSeconds >= 0.16) break
    if (n.startTimeSeconds - p.startTimeSeconds > 0.7) break
    count++
  }
  for (let j = i + 1; j < notes.length; j++) {
    const p = notes[j]!
    if (p.pitchMidi !== n.pitchMidi || p.durationSeconds >= 0.16) break
    if (p.startTimeSeconds - n.startTimeSeconds > 0.7) break
    count++
  }
  return count >= 2
}

/** Bass under a nearby vocal note (midi < 62 while a midi≥64 sits close). Isolated C4 tests stay. */
function dropBassUnderMelody(notes: BasicPitchNote[]): BasicPitchNote[] {
  return notes.filter((n, i) => {
    if (n.pitchMidi >= 62) return true
    return !notes.some(
      (o, j) =>
        j !== i &&
        o.pitchMidi >= 64 &&
        Math.abs(o.startTimeSeconds - n.startTimeSeconds) < 0.4,
    )
  })
}

function dropChromaticSlides(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 3) return notes
  const out: BasicPitchNote[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!
    const prev = out[out.length - 1]
    const next = notes[i + 1]
    const short = n.durationSeconds < 0.16
    const nearPrev = prev && Math.abs(Math.round(n.pitchMidi) - Math.round(prev.pitchMidi)) === 1
    const nearNext = next && Math.abs(Math.round(n.pitchMidi) - Math.round(next.pitchMidi)) === 1
    // Quiet chromatic blip only. C-major 第二句 `1 7 1` is G–F#–G and must stay.
    if (
      short &&
      nearPrev &&
      nearNext &&
      n.amplitude < 0.4 &&
      n.durationSeconds < 0.12
    ) {
      continue
    }
    if (n.durationSeconds < 0.12 && nearNext && next && n.amplitude < next.amplitude * 0.9) continue
    out.push({ ...n })
  }
  return out
}

function melodyScore(n: BasicPitchNote): number {
  const band = n.pitchMidi >= 55 && n.pitchMidi <= 79 ? 1.4 : 0.7
  return n.amplitude * band
}

function mergeAdjacent(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length === 0) return notes
  const out: BasicPitchNote[] = [{ ...notes[0]! }]
  for (let i = 1; i < notes.length; i++) {
    const cur = notes[i]!
    const prev = out[out.length - 1]!
    const gap = cur.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
    const startDelta = cur.startTimeSeconds - prev.startTimeSeconds
    // A leftover ghost must not become the start of the next real syllable.
    if (
      cur.pitchMidi === prev.pitchMidi &&
      prev.durationSeconds < 0.16 &&
      cur.durationSeconds >= 0.16 &&
      startDelta > 0.12
    ) {
      out[out.length - 1] = { ...cur }
      continue
    }
    const next = notes[i + 1]
    const beforeNewPitch = !next || next.pitchMidi !== cur.pitchMidi
    // Lone short stutter before a new degree — not a `1 1 1` syllable run.
    if (
      cur.pitchMidi === prev.pitchMidi &&
      prev.durationSeconds >= 0.16 &&
      cur.durationSeconds < 0.16 &&
      beforeNewPitch &&
      startDelta < 0.5 &&
      gap < 0.25 &&
      gap > -0.05
    ) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      )
      prev.durationSeconds = end - prev.startTimeSeconds
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude)
      continue
    }
    if (cur.pitchMidi === prev.pitchMidi && startDelta <= 0.3 && gap < 0.08 && gap > -0.05) {
      const end = Math.max(
        prev.startTimeSeconds + prev.durationSeconds,
        cur.startTimeSeconds + cur.durationSeconds,
      )
      prev.durationSeconds = end - prev.startTimeSeconds
      prev.amplitude = Math.max(prev.amplitude, cur.amplitude)
      continue
    }
    out.push({ ...cur })
  }
  return out
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
      // Amplitude is not YIN confidence — lift so the default 0.42 slider keeps melody notes.
      confidence: Math.min(1, 0.4 + amp * 0.65),
      rawStart: start,
      rawDuration: duration,
    };
  });
}
