export const BASIC_PITCH_RATE = 22050;

/** Vocal-ish defaults. Onset is a bit more sensitive than the library's 0.5 so repeated notes speak. */
export const BASIC_PITCH_OPTS = {
  onsetThresh: 0.32,
  frameThresh: 0.3,
  minNoteLen: 7,
  inferOnsets: true,
  minFreq: 110,
  maxFreq: 1050,
  melodiaTrick: true,
} as const;

export type BasicPitchNote = {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
  pitchBends?: number[];
};
