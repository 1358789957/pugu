/**
 * Pop first-line 简谱 fixtures. Phrase + published key + source URL + lyric cue.
 * No copyrighted audio, no nursery-rhyme rulers.
 * First-line 首调 stays here; full / verse+chorus sequences live in pop-full-fixtures.
 *
 * Source of truth is the published 首调 string plus the site `/key(...)`.
 * C=1 固定调 is only stored when already locked (昼回) or derived
 * from 1=B via movableMajorToCFixed (告白气球 / 夜空 / 孤勇者).
 * New Bb / Eb / G / D / A / Gb lines keep published movable-do only.
 */
import type { ScoreNote } from "./demo";
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "./hirumawari-opening";
import { cMajorDegrees, jianpuDegree } from "./leadsheet";
import {
  ANJING_PHRASES,
  GANBEI_PHRASES,
  GUANGNIAN_ZHIWAI_PHRASES,
  KEXI_MEI_RUGUO_PHRASES,
  KGE_ZHI_WANG_PHRASES,
  NAXIENIAN_PHRASES,
  PAOMO_PHRASES,
  TURAN_HAO_XIANG_NI_PHRASES,
  XIANGJIANNI_PHRASES,
  YUJIAN_PHRASES,
} from "./pop-new-fixtures";

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

/** `#` +1, `b` −1, `n` cancels. Octave marks are not accidentals. */
export function accidentalSemitones(token: string): number {
  if (token.includes("n")) return 0;
  if (token.includes("#")) return 1;
  if (token.includes("b")) return -1;
  return 0;
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
    return {
      midi: tonicMidi + step + accidentalSemitones(token) + (up - down) * 12,
      beats: beats?.[i] ?? 1,
    };
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
  /** Optional triangle-synth inter-note gap in seconds (default 0.1). */
  synthGap?: number;
};

const TONIC_C = 0;
const TONIC_D = 2;
const TONIC_EB = 3;
const TONIC_E = 4;
const TONIC_F = 5;
const TONIC_GB = 6;
const TONIC_G = 7;
const TONIC_AB = 8;
const TONIC_A = 9;
const TONIC_BB = 10;
const TONIC_B = 11;

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

export const PAOMO_PUBLISHED = PAOMO_PHRASES[0].publishedMovableDo;
export const NAXIENIAN_PUBLISHED = NAXIENIAN_PHRASES[0].publishedMovableDo;
export const ANJING_PUBLISHED = ANJING_PHRASES[0].publishedMovableDo;
export const YUJIAN_PUBLISHED = YUJIAN_PHRASES[0].publishedMovableDo;
export const KEXI_MEI_RUGUO_PUBLISHED = KEXI_MEI_RUGUO_PHRASES[0].publishedMovableDo;
export const GANBEI_PUBLISHED = GANBEI_PHRASES[0].publishedMovableDo;
export const TURAN_HAO_XIANG_NI_PUBLISHED = TURAN_HAO_XIANG_NI_PHRASES[0].publishedMovableDo;
export const GUANGNIAN_ZHIWAI_PUBLISHED = GUANGNIAN_ZHIWAI_PHRASES[0].publishedMovableDo;
export const KGE_ZHI_WANG_PUBLISHED = KGE_ZHI_WANG_PHRASES[0].publishedMovableDo;
export const XIANGJIANNI_PUBLISHED = XIANGJIANNI_PHRASES[0].publishedMovableDo;

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
    // Site `4_4_4_4_4_3=3=-`. After five 4s, BP sticks on C unless the synth gap is ~0.24–0.32s.
    synthBeats: [1, 1, 1, 1, 1, 1, 2, 2],
    synthGap: 0.26,
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
    id: "paomo",
    title: "泡沫",
    artist: "邓紫棋",
    lyricCue: "阳光下的泡沫 是彩色的",
    sourceUrl: "https://jianpu.space/zh-tw/songList/68c6faf98989a2a93c94ae74",
    publishedKey: "/key(E3)",
    tonicName: "E",
    tonicPc: TONIC_E,
    tonicMidi: 52,
    bpm: 68,
    publishedMovableDo: PAOMO_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "naxienian",
    title: "那些年",
    artist: "胡夏",
    lyricCue: "又回到最初的起点",
    sourceUrl: "https://jianpu.space/zh-tw/songList/654a62cfbbc8d3f848b6a70f",
    publishedKey: "/key(F3)",
    tonicName: "F",
    tonicPc: TONIC_F,
    tonicMidi: 53,
    bpm: 79,
    publishedMovableDo: NAXIENIAN_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "anjing",
    title: "安静",
    artist: "周杰伦",
    lyricCue: "只剩下钢琴陪我弹了一天",
    sourceUrl: "https://jianpu.space/zh-tw/songList/65086cad90e1087b5a0c2c35",
    publishedKey: "/key(Bb3)",
    tonicName: "Bb",
    tonicPc: TONIC_BB,
    tonicMidi: 58,
    bpm: 72,
    publishedMovableDo: ANJING_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "yujian",
    title: "遇见",
    artist: "孙燕姿",
    lyricCue: "听见 冬天 的离开",
    sourceUrl: "https://jianpu.space/zh-tw/songList/6472ad21a45093f82717628a",
    publishedKey: "/key(Ab3)",
    tonicName: "Ab",
    tonicPc: TONIC_AB,
    tonicMidi: 56,
    bpm: 92,
    publishedMovableDo: YUJIAN_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "kexi-mei-ruguo",
    title: "可惜没如果",
    artist: "林俊杰",
    lyricCue: "假如把犯得起的错",
    sourceUrl: "https://jianpu.space/zh-tw/songList/65199ac390e1087b5a0c2c59",
    publishedKey: "/key(C4)",
    tonicName: "C",
    tonicPc: TONIC_C,
    tonicMidi: 60,
    bpm: 80,
    publishedMovableDo: KEXI_MEI_RUGUO_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "ganbei",
    title: "干杯",
    artist: "五月天",
    lyricCue: "会不会 有一天 时间真的能倒退",
    sourceUrl: "https://jianpu.space/zh-tw/songList/641fc89d5bc3d689b97f538b",
    publishedKey: "/key(F3)",
    tonicName: "F",
    tonicPc: TONIC_F,
    tonicMidi: 53,
    bpm: 82,
    publishedMovableDo: GANBEI_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "turan-hao-xiang-ni",
    title: "突然好想你",
    artist: "五月天",
    lyricCue: "最怕空气突然安静",
    sourceUrl: "https://jianpu.space/zh-tw/songList/87",
    publishedKey: "/key(D3)",
    tonicName: "D",
    tonicPc: TONIC_D,
    tonicMidi: 50,
    bpm: 70,
    publishedMovableDo: TURAN_HAO_XIANG_NI_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "guangnian-zhiwai",
    title: "光年之外",
    artist: "邓紫棋",
    lyricCue: "感受停在我发端的指尖",
    sourceUrl: "https://jianpu.space/zh-tw/songList/64a59a633ec51ba7274d31f3",
    publishedKey: "/key(E4)",
    tonicName: "E",
    tonicPc: TONIC_E,
    tonicMidi: 64,
    bpm: 88,
    publishedMovableDo: GUANGNIAN_ZHIWAI_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "kge-zhi-wang",
    title: "K歌之王",
    artist: "陈奕迅",
    lyricCue: "我以为要是唱得用心良苦",
    sourceUrl: "https://jianpu.space/zh-tw/songList/6623fc572cce837239c1fc68",
    publishedKey: "/key(D3)",
    tonicName: "D",
    tonicPc: TONIC_D,
    tonicMidi: 50,
    bpm: 78,
    publishedMovableDo: KGE_ZHI_WANG_PUBLISHED,
    cMajorFixed: null,
    liveAudio: null,
  },
  {
    id: "xiangjianni",
    title: "想见你想见你想见你",
    artist: "八三夭",
    lyricCue: "当爱情遗落成遗迹",
    sourceUrl: "https://jianpu.space/zh-tw/songList/655b721f9b75b03cae7a9030",
    publishedKey: "/key(F#3)",
    tonicName: "F#",
    tonicPc: TONIC_GB,
    tonicMidi: 54,
    bpm: 65,
    publishedMovableDo: XIANGJIANNI_PUBLISHED,
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

/** 首调 degrees after the same tonic-lift + vocal-band clamp the triangle synth uses. */
export function expectedSynthDegrees(
  published: readonly string[],
  tonicMidi: number,
  tonicPc: number,
): string[] {
  const tonic = synthTonicMidi(published, tonicMidi);
  const midis = publishedToScore(published, tonic).map((n) => clampToMelodyBand(n.midi));
  return cMajorDegrees(midis, tonicPc);
}

export function matchFirstPhrase(actual: readonly string[], want: readonly string[]): boolean {
  if (actual.length < want.length) return false;
  return want.every((d, i) => actual[i] === d);
}

export type PhraseScore = {
  /** Longest leading run where actual[i] === expected[i]. */
  prefix: number;
  expectedLen: number;
  actualLen: number;
  /** prefix / expectedLen — extras after a full prefix do not lower this. */
  accuracy: number;
  /** Actual notes past the matched prefix (trailing extras, or everything after the first miss). */
  extra: number;
  /** Expected notes past the matched prefix. */
  missing: number;
  /** Full expected prefix is present — same as matchFirstPhrase. */
  exact: boolean;
};

export type AlignmentScore = {
  matched: number;
  expectedLen: number;
  actualLen: number;
  /** LCS(actual, expected) / expectedLen */
  accuracy: number;
  extra: number;
  missing: number;
  exact: boolean;
  prefix: number;
};

/** Longest common subsequence length (note tokens). */
export function lcsLength(actual: readonly string[], expected: readonly string[]): number {
  const m = actual.length;
  const n = expected.length;
  const prev = new Uint16Array(n + 1);
  const cur = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    const a = actual[i - 1];
    for (let j = 1; j <= n; j++) {
      cur[j] = a === expected[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev.set(cur);
  }
  return prev[n];
}

/**
 * Sequence alignment used by the full-song pop report.
 * n_matched = LCS length; extra / missing are notes outside that common spine.
 */
export type PhraseSetScore = {
  phrases: AlignmentScore[];
  nPhrases: number;
  exactPhrases: number;
  phraseExactRate: number;
  /** Mean of per-phrase LCS/expected. A miss in phrase k does not move k+1. */
  meanAcc: number;
  matched: number;
  expectedLen: number;
  actualLen: number;
  extra: number;
  missing: number;
  microAcc: number;
};

/** Score each phrase on its own. Concatenating would let one extra shift later lines. */
export function scorePhraseSet(
  actualPhrases: readonly (readonly string[])[],
  expectedPhrases: readonly (readonly string[])[],
): PhraseSetScore {
  const n = expectedPhrases.length;
  const phrases: AlignmentScore[] = [];
  for (let i = 0; i < n; i++) {
    phrases.push(scoreAlignment(actualPhrases[i] ?? [], expectedPhrases[i] ?? []));
  }
  const exactPhrases = phrases.filter((p) => p.exact).length;
  const matched = phrases.reduce((a, p) => a + p.matched, 0);
  const expectedLen = phrases.reduce((a, p) => a + p.expectedLen, 0);
  const actualLen = phrases.reduce((a, p) => a + p.actualLen, 0);
  const extra = phrases.reduce((a, p) => a + p.extra, 0);
  const missing = phrases.reduce((a, p) => a + p.missing, 0);
  const meanAcc = phrases.length === 0 ? 1 : phrases.reduce((a, p) => a + p.accuracy, 0) / phrases.length;
  return {
    phrases,
    nPhrases: phrases.length,
    exactPhrases,
    phraseExactRate: phrases.length === 0 ? 1 : exactPhrases / phrases.length,
    meanAcc,
    matched,
    expectedLen,
    actualLen,
    extra,
    missing,
    microAcc: expectedLen === 0 ? 1 : matched / expectedLen,
  };
}

export function scoreAlignment(actual: readonly string[], expected: readonly string[]): AlignmentScore {
  const expectedLen = expected.length;
  const actualLen = actual.length;
  const matched = lcsLength(actual, expected);
  let prefix = 0;
  const lim = Math.min(actualLen, expectedLen);
  while (prefix < lim && actual[prefix] === expected[prefix]) prefix++;
  return {
    matched,
    expectedLen,
    actualLen,
    accuracy: expectedLen === 0 ? 1 : matched / expectedLen,
    extra: actualLen - matched,
    missing: expectedLen - matched,
    exact: matched === expectedLen && actualLen === expectedLen,
    prefix,
  };
}

/** Note-level score used by the first-line align accuracy report. */
export function scorePhrase(actual: readonly string[], expected: readonly string[]): PhraseScore {
  let prefix = 0;
  const n = Math.min(actual.length, expected.length);
  while (prefix < n && actual[prefix] === expected[prefix]) prefix++;
  const expectedLen = expected.length;
  const actualLen = actual.length;
  return {
    prefix,
    expectedLen,
    actualLen,
    accuracy: expectedLen === 0 ? 1 : prefix / expectedLen,
    extra: actualLen - prefix,
    missing: expectedLen - prefix,
    exact: prefix === expectedLen,
  };
}

export function comparedScale(song: PopPhraseFixture): "C=1" | "首调" {
  return song.liveAudio && song.cMajorFixed ? "C=1" : "首调";
}
