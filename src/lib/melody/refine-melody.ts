import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_RATE } from "./basic-pitch-options";
import { polishMelodyTight } from "./basic-pitch-notes";
import {
  buildPitchContour,
  continueWavelength,
  contourToPitchFrames,
  mergeContourIntoNotes,
  type ContourFrame,
} from "./pitch-contour";
import type { PitchFrame } from "./notes";

export type { ContourFrame };

export type RefinedMelody = {
  notes: BasicPitchNote[];
  rawContour: ContourFrame[];
  filledContour: ContourFrame[];
  rawPitchTrack: PitchFrame[];
  pitchTrack: PitchFrame[];
};

/** @deprecated Use buildPitchContour. Kept for older call sites. */
export function yinTrack(
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  t0 = 0,
  hop = 0.02,
) {
  return buildPitchContour(samples, sampleRate, t0, hop).map((f) => ({
    t: f.t,
    midi: f.midi,
    conf: f.conf,
    rms: f.rms,
  }));
}

/**
 * @deprecated Discrete MIDI voting in a hole (could octave-boost B3).
 * Wavelength-continue the contour first; this is a no-op alias.
 */
export function fillMelodyGaps(
  notes: BasicPitchNote[],
  _samples: Float32Array,
  _sampleRate = BASIC_PITCH_RATE,
  _origin = 0,
): BasicPitchNote[] {
  return notes;
}

export function refineMelodyDetail(
  notes: BasicPitchNote[],
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  origin = 0,
): RefinedMelody {
  const rawContour = buildPitchContour(samples, sampleRate, origin);
  const filledContour = continueWavelength(rawContour, sampleRate);
  const merged = mergeContourIntoNotes(notes, filledContour);
  return {
    notes: polishMelodyTight(merged),
    rawContour,
    filledContour,
    rawPitchTrack: contourToPitchFrames(rawContour),
    pitchTrack: contourToPitchFrames(filledContour),
  };
}

export function refineMelody(
  notes: BasicPitchNote[],
  samples: Float32Array,
  sampleRate = BASIC_PITCH_RATE,
  origin = 0,
): BasicPitchNote[] {
  return refineMelodyDetail(notes, samples, sampleRate, origin).notes;
}
