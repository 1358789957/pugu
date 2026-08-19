import { chordAtTime, notateAnalysis } from "./notation";
import { midiName, prefersFlats, type AnalysisResult, type ChordEvent, type NoteEvent } from "./notes";

export type LyricLine = {
  start: number;
  end: number;
  text: string;
};

export type LeadCell = {
  name: string;
  jianpu: string;
  midi: number;
  start: number;
  duration: number;
  lyric: string;
  chord: string;
  bar: boolean;
  under: 0 | 1 | 2;
  dash: string;
  rest?: boolean;
  dotted?: boolean;
};

export type LeadLine = {
  start: number;
  duration: number;
  text: string;
  cells: LeadCell[];
};

/**
 * 固定调: C is always 1, D=2, E=3, F=4, G=5, A=6, B=7.
 * `tonic` is ignored for the number (kept so old call sites compile).
 * A G-major opening G A B… is 5 6 7…, not 1 2 3….
 */
export function midiToJianpu(
  midi: number,
  _tonic = 0,
  centerMidi = 60,
  flats = false,
): string {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const table = flats
    ? ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"]
    : ["1", "#1", "2", "#2", "3", "4", "#4", "5", "#5", "6", "#6", "7"];
  const num = table[pc] ?? "1";
  let refC = 60;
  while (refC < centerMidi - 6) refC += 12;
  while (refC > centerMidi + 6) refC -= 12;
  const off = Math.floor((rounded - refC) / 12);
  if (off > 0) return num + "'".repeat(off);
  if (off < 0) return num + ",".repeat(-off);
  return num;
}

/** 固定调 degree with no octave marks. C=1 … B=7. */
export function jianpuDegree(midi: number): string {
  return midiToJianpu(midi, 0, 60, false).replace(/[,']/g, "");
}

/** Move concert pitches so a G-major song is written in C, then 固定调. */
export function transposeToC(midi: number, fromTonic: number): number {
  const tpc = ((fromTonic % 12) + 12) % 12;
  return midi - tpc;
}

export function cMajorDegrees(midis: number[], fromTonic = 0): string[] {
  return midis.map((m) => jianpuDegree(transposeToC(m, fromTonic)));
}

export function keyJianpuLabel(_tonic?: number, _flats = false): string {
  return "1=C 固定调";
}

export function melodyPhrases(notes: NoteEvent[], maxLen = 7.2): { start: number; end: number }[] {
  const sung = notes.filter((n) => n.duration >= 0.08 && n.confidence > 0.28);
  if (!sung.length) return [];
  const phrases: { start: number; end: number }[] = [];
  let start = sung[0].start;
  let end = sung[0].start + sung[0].duration;
  for (let i = 1; i < sung.length; i++) {
    const n = sung[i];
    const gap = n.start - end;
    if (gap > 0.42 || n.start - start > maxLen) {
      phrases.push({ start, end });
      start = n.start;
    }
    end = Math.max(end, n.start + n.duration);
  }
  phrases.push({ start, end });
  return phrases;
}

export function tokenizeLyric(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/\s/.test(trimmed)) {
    return trimmed.split(/\s+/).filter(Boolean);
  }
  return Array.from(trimmed.replace(/\s+/g, "")).filter((ch) => ch !== "　");
}

function chordLabel(chords: ChordEvent[], t: number): string {
  return chordAtTime(chords, t)?.symbol ?? "";
}

export function assignLyrics(
  raw: string,
  result: AnalysisResult,
  timed?: LyricLine[],
): LyricLine[] {
  if (timed?.length) return timed;
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const phrases =
    result.listenPhrases?.length
      ? result.listenPhrases.map((p) => ({ start: p.start, end: p.end }))
      : melodyPhrases(result.notes);
  if (!phrases.length) {
    const slice = result.duration / lines.length;
    return lines.map((text, i) => ({
      start: i * slice,
      end: (i + 1) * slice,
      text,
    }));
  }
  return lines.map((text, i) => {
    const p = phrases[Math.min(i, phrases.length - 1)];
    return { start: p.start, end: p.end, text };
  });
}

export function buildLeadSheet(result: AnalysisResult, lyrics: LyricLine[]): LeadLine[] {
  const flats = prefersFlats(result.key.tonic, result.key.mode);
  const measures = notateAnalysis(result);
  if (!measures.length) return [];

  const queues = lyrics.map((line) => ({
    start: line.start,
    end: line.end,
    tokens: tokenizeLyric(line.text),
    i: 0,
  }));

  function lyricFor(start: number, duration: number, isNote: boolean): string {
    if (!isNote || !queues.length) return "";
    const line = queues.find((q) => start + duration * 0.25 >= q.start && start < q.end);
    if (!line) return "";
    const tok = line.tokens[line.i];
    if (tok === undefined) return "";
    line.i += 1;
    return tok;
  }

  const cellsByMeasure: LeadCell[][] = measures.map((measure) => {
    const cells: LeadCell[] = [];
    for (const ev of measure.events) {
      if (ev.tieFromPrev) continue;
      const isRest = ev.kind === "rest";
      const under: 0 | 1 | 2 = ev.units <= 1 ? 2 : ev.units <= 2 ? 1 : 0;
      const hold = ev.units >= 16 ? "— — —" : ev.units >= 12 ? "— —" : ev.units >= 8 ? "—" : ev.units >= 6 ? "-" : "";
      cells.push({
        name: isRest ? "" : midiName(ev.midi, flats).replace("♯", "#").replace("♭", "b"),
        jianpu: isRest ? "0" : midiToJianpu(ev.midi, 0, 60, flats),
        midi: ev.midi,
        start: ev.start,
        duration: ev.duration,
        lyric: lyricFor(ev.start, ev.duration, !isRest),
        chord: "",
        bar: cells.length === 0,
        under,
        dash: hold,
        rest: isRest,
        dotted: ev.dotted,
      });
    }
    return cells;
  });

  for (const q of queues) {
    if (q.i >= q.tokens.length || !q.tokens.length) continue;
    const leftover = q.tokens.slice(q.i).join("");
    let last: LeadCell | undefined;
    for (const row of cellsByMeasure) {
      for (const cell of row) {
        if (cell.start + cell.duration > q.start && cell.start < q.end && !cell.rest) last = cell;
      }
    }
    if (last) last.lyric = `${last.lyric}${leftover}`;
  }

  let lastChord = "";
  for (const row of cellsByMeasure) {
    for (const cell of row) {
      const ch = chordLabel(result.chords, cell.start + cell.duration * 0.1);
      cell.chord = ch && ch !== lastChord ? ch : "";
      if (ch) lastChord = ch;
    }
  }

  const lines: LeadLine[] = [];
  for (let i = 0; i < measures.length; i += 4) {
    const chunk = measures.slice(i, i + 4);
    const cells = cellsByMeasure.slice(i, i + 4).flat();
    const start = chunk[0]?.start ?? 0;
    const bar = (60 / Math.max(40, result.bpm)) * 4;
    const text = cells
      .map((c) => c.lyric)
      .join("")
      .trim();
    lines.push({
      start,
      duration: Math.max(0.4, chunk.length * bar),
      text,
      cells,
    });
  }
  return lines;
}

export function leadSheetPlainText(lines: LeadLine[], title: string, key: string, bpm: number): string {
  const blocks = lines.map((line) => {
    const names = line.cells
      .map((c) => `${c.bar ? "| " : ""}${(c.jianpu || c.name).padEnd(4, " ")}`)
      .join(" ");
    const words = line.cells
      .map((c) => `${c.bar ? "| " : ""}${(c.lyric || "·").padEnd(4, " ")}`)
      .join(" ");
    const chords = line.cells
      .map((c) => `${c.bar ? "| " : ""}${(c.chord || "").padEnd(4, " ")}`)
      .join(" ");
    return `${names}\n${words}\n${chords}`.replace(/[ \t]+$/gm, "");
  });
  return `${title}\n${key} · ${Math.round(bpm)} BPM · 4/4\n\n${blocks.join("\n\n")}\n`;
}

export const HIRUMAWARI_LYRICS: LyricLine[] = [
  { start: 1.1, end: 5.2, text: "雨 の 匂 い 駅 前 の" },
  { start: 5.2, end: 8.4, text: "道 で 傘 の 影 に 二 人" },
  { start: 8.5, end: 12.4, text: "並 ん で た 言 え な い" },
  { start: 12.4, end: 16.6, text: "ま ま 解 け て く 言 葉" },
  { start: 16.8, end: 21.5, text: "手 と 手 の 間 触 れ る 距 離" },
  { start: 32.0, end: 36.5, text: "い つ か ま た 同 じ 雨 に" },
  { start: 36.5, end: 40.2, text: "出 会 え た ら 微 笑 む か ら" },
  { start: 40.4, end: 44.6, text: "違 っ て い た 季 節 さ え も" },
  { start: 44.6, end: 48.8, text: "宝 物 と 呼 べ る よ う に" },
  { start: 109.0, end: 113.0, text: "喉 が 震 え た よ" },
  { start: 113.0, end: 117.2, text: "約 束 よ り 大 事 な 気 持 ち を" },
  { start: 117.2, end: 121.4, text: "守 れ な い ま ま 立 ち 尽 く し て た" },
  { start: 121.5, end: 125.6, text: "言 葉 じゃ き っ と 足 り な い か ら" },
  { start: 125.6, end: 130.0, text: "触 れ た 指 を そっ と ほ ど い た" },
  { start: 146.0, end: 150.5, text: "回 る 雲 の 隙 こ ぼ れ 落 ち る 光" },
  { start: 150.5, end: 155.0, text: "き み の こ と を 思 い 出 し て" },
  { start: 235.0, end: 239.5, text: "胸 の 奥 光 る メ モ リ ー" },
  { start: 239.5, end: 244.2, text: "い つ か ま た 同 じ 雨 に 逢 え た ら" },
  { start: 244.2, end: 248.5, text: "微 笑 む か ら 離 れ た ま ま" },
  { start: 248.5, end: 254.0, text: "繋 が っ て る" },
];

export const TWINKLE_LYRICS: LyricLine[] = [
  { start: 0.0, end: 4.0, text: "一 闪 一 闪 亮 晶 晶" },
  { start: 4.0, end: 8.0, text: "满 天 都 是 小 星 星" },
  { start: 8.0, end: 12.0, text: "挂 在 天 上 放 光 明" },
  { start: 12.0, end: 16.0, text: "一 闪 一 闪 亮 晶 晶" },
];

export function lyricsForFile(fileName: string): LyricLine[] | null {
  const n = fileName.toLowerCase();
  if (n.includes("昼回") || n.includes("hirumawari") || n.includes("メモリー") || n.includes("memory")) {
    return HIRUMAWARI_LYRICS;
  }
  if (n.includes("小星星") || n.includes("demo") || n.includes("twinkle")) return TWINKLE_LYRICS;
  return null;
}
