/**
 * Parse jianpu.space `/zh-tw/songList/...` HTML into sung movable-do tokens.
 * Skip 前奏 / 间奏. Keep the first occurrence of each lyric line so repeats
 * are not triple-counted. Later unique lyrics (恋爱日记, 栀子花, …) stay.
 */

export type JianpuVocalLine = {
  lyric: string;
  degrees: string[];
};

export type ParsedJianpuSong = {
  key: string;
  bpm: number | null;
  lines: JianpuVocalLine[];
  degrees: string[];
};

const SKIP_LYRIC = /(前奏|间奏|間奏|尾奏)/;

function fromFullwidthDigits(s: string): string {
  return s.replace(/[０-９．]/g, (ch) =>
    ch === "．" ? "." : String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}
const DEGREE_RE = /[#bn]?[1-7][,']*/g;

export function decodeJianpuEntities(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** Pull `#jianpuOut` inner text from a full song page. */
export function extractJianpuOut(html: string): string {
  const m = html.match(/<div[^>]*id="jianpuOut"[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return "";
  return decodeJianpuEntities(m[1])
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .trim();
}

/** Sung degree tokens. `0` rest, `_` `=` rhythm, `-` hold, `.` dot are ignored. */
export function tokenizeJianpuDegrees(bar: string): string[] {
  const degrees: string[] = [];
  const re = new RegExp(DEGREE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(bar))) degrees.push(m[0]);
  return degrees;
}

export function normalizeLyricKey(lyric: string): string {
  return lyric
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/[*"'“”「」]/g, "")
    .replace(/[_—\-…·.,，。！？!?]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function isInstrumentalLyric(lyric: string): boolean {
  const stripped = lyric.replace(/[*"'\s]/g, "");
  if (!stripped) return true;
  if (SKIP_LYRIC.test(lyric)) return true;
  if (/^\*+$/.test(lyric.replace(/\s+/g, ""))) return true;
  return false;
}

export function parseJianpuText(text: string): ParsedJianpuSong {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let key = "";
  let bpm: number | null = null;
  const groups: { bars: string; lyric: string }[] = [];
  let pending: string[] = [];

  for (const line of lines) {
    if (line.startsWith("/key")) {
      const m = line.match(/\/key\([A-G][#b]?\d\)/i);
      key = m ? m[0] : line.replace(/\s+/g, "");
      continue;
    }
    const bpmNorm = fromFullwidthDigits(line);
    const bpmLine = bpmNorm.match(/^[ｂbＢ][ｐpＰ][ｍmＭ]\s*(\d+(?:\.\d+)?)$/i);
    if (bpmLine) {
      bpm = Number(bpmLine[1]);
      continue;
    }
    if (bpm == null && pending.length === 0 && /^\d+(\.\d+)?$/.test(bpmNorm)) {
      bpm = Number(bpmNorm);
      continue;
    }
    if (line.startsWith("L:")) {
      const lyric = line.slice(2).replace(/^"|"$/g, "").trim();
      groups.push({ bars: pending.join(" "), lyric });
      pending = [];
      continue;
    }
    pending.push(line);
  }
  if (pending.length) groups.push({ bars: pending.join(" "), lyric: "" });

  const vocal: JianpuVocalLine[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    if (isInstrumentalLyric(g.lyric)) continue;
    const deg = tokenizeJianpuDegrees(g.bars);
    if (!deg.length) continue;
    const norm = normalizeLyricKey(g.lyric);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    vocal.push({ lyric: g.lyric, degrees: deg });
  }

  return {
    key,
    bpm,
    lines: vocal,
    degrees: vocal.flatMap((l) => l.degrees),
  };
}

export function parseJianpuPage(html: string): ParsedJianpuSong {
  return parseJianpuText(extractJianpuOut(html));
}

const KEY_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** `/key(Bb3)` → published tonic name / pitch-class / MIDI. */
export function parsePublishedKey(key: string): { tonicName: string; tonicPc: number; tonicMidi: number } {
  const m = key.match(/\/key\(([A-G])([#b]?)(\d)\)/i);
  if (!m) throw new Error(`unparseable published key: ${key}`);
  const letter = m[1]!.toUpperCase();
  const acc = m[2] ?? "";
  const oct = Number(m[3]);
  let pc = KEY_PC[letter] ?? 0;
  if (acc === "#") pc = (pc + 1) % 12;
  if (acc === "b") pc = (pc + 11) % 12;
  return {
    tonicName: `${letter}${acc}`,
    tonicPc: pc,
    tonicMidi: 12 * (oct + 1) + pc,
  };
}

/** Drop `n` naturals so tokens match jianpuDegree output (`5`, not `n5`). */
export function normalizePublishedDegree(token: string): string {
  const oct = (token.match(/[,']/g) ?? []).join("");
  const acc = token.includes("#") ? "#" : token.includes("b") && !token.includes("n") ? "b" : "";
  const deg = token.replace(/[^1-7]/g, "");
  return `${acc}${deg}${oct}`;
}
