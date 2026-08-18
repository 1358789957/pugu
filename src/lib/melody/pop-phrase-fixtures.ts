/**
 * Pop first-line 简谱 fixtures. Phrase + published key + source URL + lyric cue.
 * No copyrighted audio, no full scores, no nursery-rhyme rulers.
 *
 * Source of truth is the published 首调 string plus the site `/key(...)`.
 * C=1 固定调 is only stored when already locked (昼回) or derived
 * from 1=B via movableMajorToCFixed (告白气球 / 夜空 / 孤勇者).
 * New Bb / Eb / G / D / A / Gb lines keep published movable-do only.
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

export function publishedToScore(
  published: readonly string[],
  tonicMidi: number,
  beats?: readonly number[],
): ScoreNote[] {
  return published.map((token, i) => {
    const deg = Number(token.replace(/[^1-7]/g, ""));
    const down = (token.match(/,/g) ?? []).length;
    const up = (token.match(/'/g) ?? []).length;
    const step = MAJOR_SEMITONES[deg - 1] ?? 0;
    return { midi: tonicMidi + step + (up - down) * 12, beats: beats?.[i] ?? 1 };
  });
}

/** Lift the published tonic so every phrase note sits in the vocal MIDI band. */
export function synthTonicMidi(published: readonly string[], tonicMidi: number): number {
  const midis = publishedToScore(published, tonicMidi).map((n) => n.midi);
  let shift = 0;
  while (Math.min(...midis) + shift < 56) shift += 12;
  while (Math.max(...midis) + shift > 79 && Math.min(...midis) + shift - 12 >= 55) shift -= 12;
  return tonicMidi + shift;
}

/** Keep a synth note in the Basic Pitch vocal band without changing pitch class. */
export function clampToMelodyBand(midi: number): number {
  let m = midi;
  while (m < 55) m += 12;
  while (m > 79) m -= 12;
  return m;
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
  /** Optional per-note beats for triangle synth (site holds). */
  synthBeats?: readonly number[];
};

const TONIC_B = 11;
const TONIC_A = 9;
const TONIC_GB = 6;
const TONIC_BB = 10;
const TONIC_EB = 3;
const TONIC_G = 7;
const TONIC_D = 2;

export const GAOBAI_QIQU_PUBLISHED = ["1", "1", "7,", "1", "7,", "1", "7,", "1", "2"] as const;
export const GAOBAI_QIQU_C = movableMajorToCFixed(GAOBAI_QIQU_PUBLISHED, TONIC_B);

export const YEKONG_PUBLISHED = ["3", "2", "3", "2", "3", "5", "5", "1", "2", "1"] as const;
export const YEKONG_C = movableMajorToCFixed(YEKONG_PUBLISHED, TONIC_B);

export const QINGHUACI_PUBLISHED = ["2", "1", "6,", "1", "1", "6,", "1", "1", "6,", "1", "6,", "5,"] as const;

export const DAOXIANG_PUBLISHED = ["1", "1", "6,", "1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1"] as const;

export const QIFENGLE_PUBLISHED = ["2", "1", "2", "1", "2", "3", "5", "3"] as const;

/** 风到这里就是黏 / 黏住过客的思念 */
export const JIANGNAN_PUBLISHED = [
  "6,",
  "7,",
  "1",
  "5",
  "3",
  "1",
  "6,",
  "7,",
  "7,",
  "7,",
  "1",
  "7,",
  "5,",
  "6,",
] as const;

/** Verse 栀子花 白花瓣 — page prints chorus first. */
export const HOULAI_PUBLISHED = ["1", "7,", "1", "3,", "4,", "5,"] as const;

/** 别堆砌怀念让剧情 */
export const TIMIAN_PUBLISHED = ["5,", "3", "3", "2", "3", "3", "2", "3", "3", "2", "3", "7,"] as const;

/** Pickup 5, then 冷咖啡离开了杯垫 */
export const BUNENG_SHUO_DE_MIMI_PUBLISHED = ["5,", "4", "4", "4", "4", "4", "3", "3"] as const;

/** 都是勇敢的 */
export const GUYONGZHE_PUBLISHED = ["3", "1", "2", "1", "3"] as const;
export const GUYONGZHE_C = movableMajorToCFixed(GUYONGZHE_PUBLISHED, TONIC_B);

/** 这是一首简单的小情歌 */
export const XIAOQINGGE_PUBLISHED = ["1", "7,", "1", "7,", "1", "7,", "5,", "3,", "5,", "7,", "6"] as const;

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
    id: "jiangnan",
    title: "江南",
    artist: "林俊杰",
    lyricCue: "风到这里就是黏",
    sourceUrl: "https://jianpu.space/zh-tw/songList/643b8ac73ac403ab8420f6c8",
    publishedKey: "/key(Bb3)",
    tonicName: "Bb",
    tonicPc: TONIC_BB,
    tonicMidi: 58,
    bpm: 120,
    publishedMovableDo: JIANGNAN_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "houlai",
    title: "后来",
    artist: "刘若英",
    lyricCue: "栀子花 白花瓣",
    sourceUrl: "https://jianpu.space/zh-tw/songList/64971f65adff71bd86e8d5e7",
    publishedKey: "/key(Eb4)",
    tonicName: "Eb",
    tonicPc: TONIC_EB,
    tonicMidi: 63,
    bpm: 74.9,
    publishedMovableDo: HOULAI_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "timian",
    title: "体面",
    artist: "于文文",
    lyricCue: "别堆砌怀念让剧情",
    sourceUrl: "https://jianpu.space/zh-tw/songList/65675f21bcebbf7e531862d0",
    publishedKey: "/key(Bb3)",
    tonicName: "Bb",
    tonicPc: TONIC_BB,
    tonicMidi: 58,
    bpm: 85,
    publishedMovableDo: TIMIAN_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "buneng-shuo-de-mimi",
    title: "不能说的秘密",
    artist: "周杰伦",
    lyricCue: "冷咖啡离开了杯垫",
    sourceUrl: "https://jianpu.space/zh-tw/songList/6507272490e1087b5a0c2c2f",
    publishedKey: "/key(G3)",
    tonicName: "G",
    tonicPc: TONIC_G,
    tonicMidi: 55,
    bpm: 72,
    publishedMovableDo: BUNENG_SHUO_DE_MIMI_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
    // Site `4_4_4_4_4_3=3=-`: hold the two 3s so BP does not stick on 4.
    synthBeats: [1, 1, 1, 1, 1, 1, 2, 2],
  },
  {
    id: "guyongzhe",
    title: "孤勇者",
    artist: "陈奕迅",
    lyricCue: "都是勇敢的",
    sourceUrl: "https://jianpu.space/zh-tw/songList/6666bf5f1e85a6493d60e8b8",
    publishedKey: "/key(B2)",
    tonicName: "B",
    tonicPc: TONIC_B,
    tonicMidi: 47,
    bpm: 130,
    publishedMovableDo: GUYONGZHE_PUBLISHED,
    cMajorFixed: GUYONGZHE_C,
    liveAudio: null,
  },
  {
    id: "xiaoqingge",
    title: "小情歌",
    artist: "苏打绿",
    lyricCue: "这是一首简单的小情歌",
    sourceUrl: "https://jianpu.space/zh-tw/songList/25",
    publishedKey: "/key(D4)",
    tonicName: "D",
    tonicPc: TONIC_D,
    tonicMidi: 62,
    bpm: 66,
    publishedMovableDo: XIAOQINGGE_PUBLISHED,
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
