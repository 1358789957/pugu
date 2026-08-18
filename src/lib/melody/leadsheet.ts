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
};

export type LeadLine = {
  start: number;
  duration: number;
  text: string;
  cells: LeadCell[];
};

/** Numbered notation relative to the song key. G4 in G major → 1 */
export function midiToJianpu(midi: number, tonic: number, centerMidi = 67): string {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const tpc = ((tonic % 12) + 12) % 12;
  const rel = (pc - tpc + 12) % 12;
  const table = ["1", "#1", "2", "#2", "3", "4", "#4", "5", "#5", "6", "#6", "7"];
  const num = table[rel] ?? "1";
  let tonicMidi = 48 + tpc;
  while (tonicMidi < centerMidi - 6) tonicMidi += 12;
  while (tonicMidi > centerMidi + 6) tonicMidi -= 12;
  const off = Math.floor((rounded - tonicMidi) / 12);
  if (off > 0) return num + "'".repeat(off);
  if (off < 0) return num + ",".repeat(-off);
  return num;
}

export function keyJianpuLabel(tonic: number, flats = false): string {
  return `1=${midiName(60 + (((tonic % 12) + 12) % 12), flats).replace(/\d/g, "").replace("♯", "#").replace("♭", "b")}`;
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

function thinNotes(notes: NoteEvent[], count: number): NoteEvent[] {
  if (notes.length <= count) return notes;
  if (count <= 0) return notes;
  const start = notes[0].start;
  const end = notes[notes.length - 1].start;
  const used = new Set<number>();
  const out: NoteEvent[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? start : start + ((end - start) * i) / (count - 1);
    let best = 0;
    let bestD = 1e9;
    for (let j = 0; j < notes.length; j++) {
      if (used.has(j)) continue;
      const d = Math.abs(notes[j].start - t);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    used.add(best);
    out.push(notes[best]);
  }
  return out.sort((a, b) => a.start - b.start);
}

function chordAt(chords: ChordEvent[], t: number): string {
  for (let i = chords.length - 1; i >= 0; i--) {
    const c = chords[i];
    if (t + 0.03 >= c.start && t < c.start + c.duration + 0.05) return c.symbol;
  }
  return "";
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
  const phrases = melodyPhrases(result.notes);
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
  const tonic = result.key.tonic;
  const notes = result.notes.filter((n) => n.duration >= 0.08);
  const midis = notes.map((n) => n.midi).sort((a, b) => a - b);
  const center = midis.length ? midis[Math.floor(midis.length / 2)] : 67;
  const spans = lyrics.length
    ? lyrics
    : melodyPhrases(notes).map((p) => ({ start: p.start, end: p.end, text: "" }));

  return spans.map((line) => {
    const inLine = notes.filter(
      (n) => n.start + n.duration > line.start + 0.04 && n.start < line.end - 0.02,
    );
    const tokens = tokenizeLyric(line.text);
    const picked = tokens.length ? thinNotes(inLine, tokens.length) : inLine;
    const beat = 60 / Math.max(40, result.bpm || 100);
    const origin = notes[0]?.start ?? 0;
    const cells: LeadCell[] = picked.map((n, i) => {
      const beats = n.duration / beat;
      const under: 0 | 1 | 2 = beats < 0.4 ? 2 : beats < 0.75 ? 1 : 0;
      const dash = beats >= 3.5 ? "—" : beats >= 1.6 ? "-" : "";
      const step = Math.round((n.start - origin) / beat);
      return {
        name: midiName(n.midi, flats).replace("♯", "#").replace("♭", "b"),
        jianpu: midiToJianpu(n.midi, tonic, center),
        midi: n.midi,
        start: n.start,
        duration: n.duration,
        lyric: tokens.length ? (tokens[i] ?? "") : "",
        chord: "",
        bar: ((step % 4) + 4) % 4 === 0,
        under,
        dash,
      };
    });
    if (tokens.length > cells.length && cells.length) {
      cells[cells.length - 1].lyric = tokens.slice(cells.length - 1).join("");
    }
    let lastChord = "";
    for (const cell of cells) {
      const ch = chordAt(result.chords, cell.start + cell.duration * 0.15);
      cell.chord = ch && ch !== lastChord ? ch : "";
      if (ch) lastChord = ch;
    }
    if (!cells.length && line.text) {
      cells.push({
        name: "",
        jianpu: "",
        midi: 0,
        start: line.start,
        duration: Math.max(0.4, line.end - line.start),
        lyric: line.text,
        chord: chordAt(result.chords, line.start),
        bar: true,
        under: 0,
        dash: "",
      });
    }
    return {
      start: line.start,
      duration: Math.max(0.4, line.end - line.start),
      text: line.text,
      cells,
    };
  });
}

export function leadSheetPlainText(lines: LeadLine[], title: string, key: string, bpm: number): string {
  const blocks = lines.map((line) => {
    const names = line.cells.map((c) => (c.jianpu || c.name).padEnd(4, " ")).join(" ");
    const words = line.cells.map((c) => (c.lyric || "·").padEnd(4, " ")).join(" ");
    const chords = line.cells.map((c) => (c.chord || "").padEnd(4, " ")).join(" ");
    return `${names}\n${words}\n${chords}`.replace(/[ \t]+$/gm, "");
  });
  return `${title}\n${key} · ${Math.round(bpm)} BPM\n\n${blocks.join("\n\n")}\n`;
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
