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
  energyTolerance: 11,
} as const;

export type BasicPitchDecodeOpts = {
  onsetThresh: number;
  frameThresh: number;
  minNoteLen: number;
  inferOnsets: boolean;
  minFreq: number;
  maxFreq: number;
  melodiaTrick: boolean;
  energyTolerance: number;
};

export type BasicPitchNote = {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
  pitchBends?: number[];
};
