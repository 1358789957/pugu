/**
 * Public-domain / in-repo C=1 固定调 alignment set.
 * 简谱 is 固定调: C=1 … B=7. Synth songs are written and played in C (fromTonic 0).
 * 昼回 audio is in G — transpose −7 before comparing to the C fixtures.
 */
import type { ScoreNote } from "./demo";
import { TWINKLE } from "./demo";
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "./hirumawari-opening";

export const ALIGN_BPM = 96;

export const TWINKLE_ALIGN_C = ["1", "1", "5", "5", "6", "6", "5", "4", "4", "3", "3", "2", "2", "1"] as const;

export const ODE_TO_JOY_C = ["3", "3", "4", "5", "5", "4", "3", "2", "1", "1", "2", "3", "3", "2", "2"] as const;

export const HAPPY_BIRTHDAY_C = ["5", "5", "6", "5", "1", "7", "5", "5", "6", "5", "2", "1"] as const;

export const TWO_TIGERS_C = ["1", "2", "3", "1", "1", "2", "3", "1", "3", "4", "5"] as const;

/** First two phrases of the in-repo 小星星 score. */
export const TWINKLE_ALIGN_SCORE: ScoreNote[] = TWINKLE.slice(0, 14);

export const ODE_TO_JOY_SCORE: ScoreNote[] = [
  { midi: 64, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 62, beats: 1 },
];

export const HAPPY_BIRTHDAY_SCORE: ScoreNote[] = [
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 72, beats: 1 },
  { midi: 71, beats: 2 },
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 74, beats: 1 },
  { midi: 72, beats: 2 },
];

export const TWO_TIGERS_SCORE: ScoreNote[] = [
  { midi: 60, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 67, beats: 2 },
];

export type AlignSong = {
  id: string;
  name: string;
  degrees: readonly string[];
  fromTonic: number;
  source: "synth" | "hirumawari-vocal";
  score?: readonly ScoreNote[];
  bpm?: number;
};

export const ALIGN_SONGS: AlignSong[] = [
  {
    id: "twinkle",
    name: "小星星",
    degrees: TWINKLE_ALIGN_C,
    fromTonic: 0,
    source: "synth",
    score: TWINKLE_ALIGN_SCORE,
    bpm: ALIGN_BPM,
  },
  {
    id: "ode",
    name: "欢乐颂",
    degrees: ODE_TO_JOY_C,
    fromTonic: 0,
    source: "synth",
    score: ODE_TO_JOY_SCORE,
    bpm: ALIGN_BPM,
  },
  {
    id: "birthday",
    name: "生日快乐",
    degrees: HAPPY_BIRTHDAY_C,
    fromTonic: 0,
    source: "synth",
    score: HAPPY_BIRTHDAY_SCORE,
    bpm: ALIGN_BPM,
  },
  {
    id: "tigers",
    name: "两只老虎",
    degrees: TWO_TIGERS_C,
    fromTonic: 0,
    source: "synth",
    score: TWO_TIGERS_SCORE,
    bpm: ALIGN_BPM,
  },
  {
    id: "hirumawari-1",
    name: "昼回 第一句",
    degrees: HIRUMAWARI_OPENING_C,
    fromTonic: 7,
    source: "hirumawari-vocal",
  },
  {
    id: "hirumawari-2",
    name: "昼回 第二句",
    degrees: HIRUMAWARI_PHRASE2_C,
    fromTonic: 7,
    source: "hirumawari-vocal",
  },
];
