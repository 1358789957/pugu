/**
 * 《昼回のメモリー》开口两句.
 *
 * 简谱是固定调: C=1, D=2, E=3, F=4, G=5, A=6, B=7. Never 1=G / 首调.
 *
 * C-major checks only (do not use G-major numbering as the C test):
 *   第一句 (14): 1 2 3 2 3 4 3 2 7 1 2 2 7 1
 *               C D E D E F E D B C D D B C
 *   第二句 (13): 6 7 1 1 1 1 1 7 5 1 2 1 3
 *               A B C C C C C B G C D C E
 *               groups 671111 | 17512 | 13
 *
 * G-audio 固定调 of the same concert line is a different string
 * (第一句 5 6 7… / 第二句 3 #4 5 5 5 5 5…) — not the C fixture.
 *
 * Hirumawari audio is in G. Transpose concert MIDI down 7
 * (`fromTonic = 7`) then 固定调 before comparing.
 */
export const HIRUMAWARI_OPENING_C = ["1", "2", "3", "2", "3", "4", "3", "2", "7", "1", "2", "2", "7", "1"] as const;

export const HIRUMAWARI_PHRASE2_C = ["6", "7", "1", "1", "1", "1", "1", "7", "5", "1", "2", "1", "3"] as const;

export const HIRUMAWARI_OPENING_G8 = ["5", "6", "7", "6", "7", "1", "7", "6"] as const;

export const HIRUMAWARI_PHRASE2_G = ["3", "#4", "5", "5", "5", "5", "5", "#4", "2", "5", "6", "5", "7"] as const;

export const HIRUMAWARI_AUDIO_TONIC = 7;
export const HIRUMAWARI_PHRASE_START = 1.45;
export const HIRUMAWARI_PHRASE_END = 6.4;
export const HIRUMAWARI_PHRASE2_START = 7.55;
export const HIRUMAWARI_PHRASE2_END = 12.0;

export type HirumawariPhraseHypothesis = {
  id: string;
  label: string;
  /** Inclusive decode slice (seconds on the dry vocal). */
  decodeStart: number;
  decodeEnd: number;
  /** Keep notes whose start is in [start, end). */
  start: number;
  end: number;
  /** Lyric file as a timing cue only — not pitch truth. */
  lyricCue: string;
  /** Last tuner+wavelength snapshot. Not a lock; do not test against this. */
  cMajorFixed: readonly string[];
  concertMidi: readonly number[];
};

/**
 * After 第二句 until the chorus lyric いつかまた同じ雨に.
 * These are HYPOTHESES from the dry-vocal contour path. Not ground truth.
 * The 词谱.txt note names are not used here (too coarse / wrong pitches).
 */
export const HIRUMAWARI_CHORUS_LYRIC = "いつかまた同じ雨に";
export const HIRUMAWARI_CHORUS_START_HYPOTHESIS = 28.55;

export const HIRUMAWARI_VERSE_DECODE_START = 12.0;
export const HIRUMAWARI_VERSE_DECODE_END = 28.6;

export const HIRUMAWARI_PHRASE3_HYPOTHESIS: HirumawariPhraseHypothesis = {
  id: "hirumawari-3",
  label: "第三句",
  decodeStart: HIRUMAWARI_VERSE_DECODE_START,
  decodeEnd: HIRUMAWARI_VERSE_DECODE_END,
  start: 12.2,
  end: 18.2,
  lyricCue: "並んでた言えない",
  cMajorFixed: ["3", "1", "2", "3", "2", "3", "6", "2", "3", "7", "7", "1", "7", "2", "2", "3", "1", "1", "7"],
  concertMidi: [71, 67, 69, 71, 69, 71, 64, 69, 71, 66, 66, 67, 66, 69, 69, 71, 67, 67, 66],
};

export const HIRUMAWARI_PHRASE4_HYPOTHESIS: HirumawariPhraseHypothesis = {
  id: "hirumawari-4",
  label: "第四句",
  decodeStart: HIRUMAWARI_VERSE_DECODE_START,
  decodeEnd: HIRUMAWARI_VERSE_DECODE_END,
  start: 19.55,
  end: 23.0,
  lyricCue: "まま解けてく言葉",
  cMajorFixed: ["1", "1", "7", "6", "7", "1", "4", "5", "4", "1"],
  concertMidi: [67, 67, 66, 64, 66, 67, 72, 62, 72, 67],
};

export const HIRUMAWARI_PHRASE5_HYPOTHESIS: HirumawariPhraseHypothesis = {
  id: "hirumawari-5",
  label: "第五句",
  decodeStart: HIRUMAWARI_VERSE_DECODE_START,
  decodeEnd: HIRUMAWARI_VERSE_DECODE_END,
  start: 23.0,
  end: 28.2,
  lyricCue: "手と手の間触れる距離",
  cMajorFixed: ["5", "1", "7", "5", "1", "7", "6", "1", "7", "5", "1", "7", "7", "1", "2", "1"],
  concertMidi: [62, 67, 66, 62, 67, 66, 64, 67, 66, 62, 67, 66, 66, 67, 69, 67],
};

export const HIRUMAWARI_VERSE_HYPOTHESES = [
  HIRUMAWARI_PHRASE3_HYPOTHESIS,
  HIRUMAWARI_PHRASE4_HYPOTHESIS,
  HIRUMAWARI_PHRASE5_HYPOTHESIS,
] as const;
