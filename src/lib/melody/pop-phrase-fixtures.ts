/**
 * Pop first-line 简谱 fixtures for later local-upload checks.
 * Phrase + key + source URL + lyric cue only. No audio, no full scores.
 *
 * Published pages are 首调 (1 = song tonic). This app writes 1=C 固定调
 * of the concert pitches (C=1 … B=7, accidentals kept).
 *
 * A scale-degree rotation that drops sharps (1=B → 1→7, 2→1, 7→6)
 * is not 固定调. 告白气球 `117171712` is `7 7 #6 7 #6 7 #6 7 #1`, not `776767671`.
 * 夜空 `3232355 121` is `#2 #1 #2 #1 #2 #4 #4 7 #1 7`, not `2121244`.
 */
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "./hirumawari-opening";
import { jianpuDegree } from "./leadsheet";

const MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/** 1=tonic major 首调 → C=1 固定调 of those concert pitch classes. */
export function movableMajorToCFixed(published: readonly string[], tonicPc: number): string[] {
  return published.map((token) => {
    const deg = Number(token.replace(/[^1-7]/g, ""));
    const step = MAJOR_SEMITONES[deg - 1] ?? 0;
    const pc = (((tonicPc % 12) + 12 + step) % 12);
    return jianpuDegree(60 + pc);
  });
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
  bpm: number;
  publishedMovableDo: readonly string[];
  cMajorFixed: readonly string[];
  liveAudio: "hirumawari-vocal" | null;
};

const TONIC_B = 11;

export const GAOBAI_QIQU_PUBLISHED = ["1", "1", "7", "1", "7", "1", "7", "1", "2"] as const;
export const GAOBAI_QIQU_C = movableMajorToCFixed(GAOBAI_QIQU_PUBLISHED, TONIC_B);

export const YEKONG_PUBLISHED = ["3", "2", "3", "2", "3", "5", "5", "1", "2", "1"] as const;
export const YEKONG_C = movableMajorToCFixed(YEKONG_PUBLISHED, TONIC_B);

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
    bpm: 108,
    publishedMovableDo: YEKONG_PUBLISHED,
    cMajorFixed: YEKONG_C,
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
    bpm: 117,
    publishedMovableDo: HIRUMAWARI_PHRASE2_C,
    cMajorFixed: HIRUMAWARI_PHRASE2_C,
    liveAudio: "hirumawari-vocal",
  },
];

export function matchFirstPhrase(actual: readonly string[], want: readonly string[]): boolean {
  if (actual.length < want.length) return false;
  return want.every((d, i) => actual[i] === d);
}
