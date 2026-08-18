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
    if (n.amplitude > prev.amplitude * 1.08) {
      picked[clash] = n
    }
  }

  picked.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
  return mergeAdjacent(picked)
}

function mergeAdjacent(notes: BasicPitchNote[]): BasicPitchNote[] {
  if (notes.length === 0) return notes
  const out: BasicPitchNote[] = [{ ...notes[0]! }]
  for (let i = 1; i < notes.length; i++) {
    const cur = notes[i]!
    const prev = out[out.length - 1]!
    const gap = cur.startTimeSeconds - (prev.startTimeSeconds + prev.durationSeconds)
    if (cur.pitchMidi === prev.pitchMidi && gap < 0.045 && gap > -0.02) {
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
