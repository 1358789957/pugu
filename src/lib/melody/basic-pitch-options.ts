export const BASIC_PITCH_RATE = 22050;

/** Solo-vocal defaults: singing band, drop bass leak, keep short syllables. */
export const BASIC_PITCH_OPTS = {
  onsetThresh: 0.34,
  frameThresh: 0.28,
  minNoteLen: 6,
  inferOnsets: true,
  minFreq: 196,
  maxFreq: 880,
  melodiaTrick: true,
} as const;

export type BasicPitchNote = {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
  pitchBends?: number[];
};
