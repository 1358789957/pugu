import { makeNoteId, resetNoteIds, type NoteEvent } from "./notes";
import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_OPTS } from "./basic-pitch-options";

const MELODY_MIDI_LO = 48
const MELODY_MIDI_HI = 86

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
      // Short same-pitch blips in the gap between two quarters are not re-attacks.
      if (startDelta > 0.12 && n.durationSeconds >= 0.18) {
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
    if (n.amplitude > prev.amplitude * 1.08) {
      picked[clash] = n
    }
  }

  picked.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
  return dropPitchGhosts(mergeAdjacent(picked))
}

/** Drop sub-180ms same-pitch blips that sit in the gap between two real notes. */
function dropPitchGhosts(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length < 2) return notes
  const out: BasicPitchNote[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = { ...notes[i]! }
    const prev = out[out.length - 1]
    const next = notes[i + 1]
    const short = n.durationSeconds < 0.18
    const gapPrev = prev
      ? n.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
      : Infinity
    const gapNext = next
      ? next.startTimeSeconds - (n.startTimeSeconds + n.durationSeconds)
      : Infinity
    const samePrev = Boolean(prev && prev.pitchMidi === n.pitchMidi && gapPrev < 0.14)
    const sameNext = Boolean(next && next.pitchMidi === n.pitchMidi && gapNext < 0.14)
    if (short && (samePrev || sameNext)) {
      if (samePrev && prev) {
        const end = Math.max(
          prev.startTimeSeconds + prev.durationSeconds,
          n.startTimeSeconds + n.durationSeconds,
        )
        prev.durationSeconds = end - prev.startTimeSeconds
      }
      continue
    }
    out.push(n)
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
    const startDelta = cur.startTimeSeconds - prev.startTimeSeconds;
    if (cur.pitchMidi === prev.pitchMidi && startDelta < 0.12 && gap < 0.012 && gap > -0.02) {
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
