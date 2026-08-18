/**
 * Pop first-line 简谱 fixtures. Phrase + published key + source URL + lyric cue.
 * No copyrighted audio, no full scores, no nursery-rhyme rulers.
 *
 * Source of truth is the published 首调 string plus the site `/key(...)`.
 * C=1 固定调 is only stored when already locked (昼回) or previously
 * derived from 1=B concert pitches (告白气球 / 夜空). New A / Gb lines
 * keep published movable-do only — do not invent a C=1 string.
 */
import type { ScoreNote } from "./demo";
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "./hirumawari-opening";
import { jianpuDegree } from "./leadsheet";

const MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/** Quarters must stay under the 0.5s neighbor-return cut and the 0.62s late-echo cut. */
export const SYNTH_ALIGN_BPM = 120;

export function stripOctaveMarks(tokens: readonly string[]): string[] {
  return tokens.map((t) => t.replace(/[,']/g, ""));
}

/** 1=tonic major 首调 → C=1 固定调 of those concert pitch classes. */
export function movableMajorToCFixed(published: readonly string[], tonicPc: number): string[] {
  return stripOctaveMarks(published).map((token) => {
    const deg = Number(token.replace(/[^1-7]/g, ""));
    const step = MAJOR_SEMITONES[deg - 1] ?? 0;
    const pc = (((tonicPc % 12) + 12 + step) % 12);
    return jianpuDegree(60 + pc);
  });
}

export function publishedToScore(published: readonly string[], tonicMidi: number): ScoreNote[] {
  return published.map((token) => {
    const deg = Number(token.replace(/[^1-7]/g, ""));
    const down = (token.match(/,/g) ?? []).length;
    const up = (token.match(/'/g) ?? []).length;
    const step = MAJOR_SEMITONES[deg - 1] ?? 0;
    return { midi: tonicMidi + step + (up - down) * 12, beats: 1 };
  });
}

/** Lift the published tonic so every phrase note sits in the vocal MIDI band. */
export function synthTonicMidi(published: readonly string[], tonicMidi: number): number {
  const midis = publishedToScore(published, tonicMidi).map((n) => n.midi);
  let shift = 0;
  while (Math.min(...midis) + shift < 55) shift += 12;
  while (Math.max(...midis) + shift > 79 && Math.min(...midis) + shift - 12 >= 55) shift -= 12;
  return tonicMidi + shift;
}

export type PopPhraseFixture = {
  id: string;
  title: string;
  artist: string;
  lyricCue: string;
  sourceUrl: string | null;
  publishedKey: string;
  tonicName: string;
  tonicPc: number;
  tonicMidi: number;
  bpm: number;
  publishedMovableDo: readonly string[];
  /** Set only when locked or previously derived. Published 首调 is SoT. */
  cMajorFixed: readonly string[] | null;
  liveAudio: "hirumawari-vocal" | null;
};

const TONIC_B = 11;
const TONIC_A = 9;
const TONIC_GB = 6;

export const GAOBAI_QIQU_PUBLISHED = ["1", "1", "7,", "1", "7,", "1", "7,", "1", "2"] as const;
export const GAOBAI_QIQU_C = movableMajorToCFixed(GAOBAI_QIQU_PUBLISHED, TONIC_B);

export const YEKONG_PUBLISHED = ["3", "2", "3", "2", "3", "5", "5", "1", "2", "1"] as const;
export const YEKONG_C = movableMajorToCFixed(YEKONG_PUBLISHED, TONIC_B);

export const QINGHUACI_PUBLISHED = ["2", "1", "6,", "1", "1", "6,", "1", "1", "6,", "1", "6,", "5,"] as const;

export const DAOXIANG_PUBLISHED = ["1", "1", "6,", "1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1"] as const;

export const QIFENGLE_PUBLISHED = ["2", "1", "2", "1", "2", "3", "5", "3"] as const;

export const POP_PHRASE_FIXTURES: PopPhraseFixture[] = [
  {
    id: "gaobai-qiqu",
    title: "告白气球",
    artist: "周杰伦",
    lyricCue: "塞纳河畔 左岸的咖啡",
    sourceUrl: "https://jianpu.space/zh-tw/songList/651c2bce90e1087b5a0c2c5f",
    publishedKey: "/key(B3)",
    tonicName: "B",
    tonicPc: TONIC_B,
    tonicMidi: 59,
    bpm: 90,
    publishedMovableDo: GAOBAI_QIQU_PUBLISHED,
    cMajorFixed: GAOBAI_QIQU_C,
    liveAudio: null,
  },
  {
    id: "yekong-zui-liang",
    title: "夜空中最亮的星",
    artist: "逃跑计划",
    lyricCue: "夜空中最亮的星 能否听清",
    sourceUrl: "https://jianpu.space/zh-tw/songList/112",
    publishedKey: "/key(B2)",
    tonicName: "B",
    tonicPc: TONIC_B,
    tonicMidi: 47,
    bpm: 108,
    publishedMovableDo: YEKONG_PUBLISHED,
    cMajorFixed: YEKONG_C,
    liveAudio: null,
  },
  {
    id: "qinghuaci",
    title: "青花瓷",
    artist: "周杰伦",
    lyricCue: "素胚勾勒出青花笔锋浓转淡",
    sourceUrl: "https://jianpu.space/zh-tw/songList/650f084690e1087b5a0c2c45",
    publishedKey: "/key(A3)",
    tonicName: "A",
    tonicPc: TONIC_A,
    tonicMidi: 57,
    bpm: 108,
    publishedMovableDo: QINGHUACI_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "daoxiang",
    title: "稻香",
    artist: "周杰伦",
    lyricCue: "对这个世界如果你有太多的抱怨",
    sourceUrl: "https://jianpu.space/zh-tw/songList/651455a390e1087b5a0c2c4f",
    publishedKey: "/key(A3)",
    tonicName: "A",
    tonicPc: TONIC_A,
    tonicMidi: 57,
    bpm: 82,
    publishedMovableDo: DAOXIANG_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "qifengle",
    title: "起风了",
    artist: "买辣椒也用券",
    lyricCue: "这一路上走走停停",
    sourceUrl: "https://jianpu.space/zh-tw/songList/65df55bc2cce837239c1fbe2",
    publishedKey: "/key(Gb3)",
    tonicName: "Gb",
    tonicPc: TONIC_GB,
    tonicMidi: 54,
    bpm: 75,
    publishedMovableDo: QIFENGLE_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "hirumawari-1",
    title: "昼回のメモリー 第一句",
    artist: "in-repo dry vocal",
    lyricCue: "opening phrase 1",
    sourceUrl: null,
    publishedKey: "1=C 固定调 (G audio transposed −7)",
    tonicName: "C",
    tonicPc: 0,
    tonicMidi: 60,
    bpm: 117,
    publishedMovableDo: HIRUMAWARI_OPENING_C,
    cMajorFixed: HIRUMAWARI_OPENING_C,
    liveAudio: "hirumawari-vocal",
  },
  {
    id: "hirumawari-2",
    title: "昼回のメモリー 第二句",
    artist: "in-repo dry vocal",
    lyricCue: "opening phrase 2 · 671111 17512 13",
    sourceUrl: null,
    publishedKey: "1=C 固定调 (G audio transposed −7)",
    tonicName: "C",
    tonicPc: 0,
    tonicMidi: 60,
    bpm: 117,
    publishedMovableDo: HIRUMAWARI_PHRASE2_C,
    cMajorFixed: HIRUMAWARI_PHRASE2_C,
    liveAudio: "hirumawari-vocal",
  },
];

/** Pop alignment set. Published 首调 is SoT; 昼回 stays the live C=1 lock. */
export const ALIGN_SONGS = POP_PHRASE_FIXTURES;

export function expectedDegrees(song: PopPhraseFixture): string[] {
  if (song.liveAudio && song.cMajorFixed) return [...song.cMajorFixed];
  return stripOctaveMarks(song.publishedMovableDo);
}

export function matchFirstPhrase(actual: readonly string[], want: readonly string[]): boolean {
  if (actual.length < want.length) return false;
  return want.every((d, i) => actual[i] === d);
}
