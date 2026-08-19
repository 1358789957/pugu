import type { ListenPhraseInfo, NoteEvent } from "./notes";

const MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;
const DEGREE_RE = /[#bn]?[1-7][,']*/g;

export type EarWriteMode = "tonic1" | "fixedC";

export type EarApplyResult = {
  notes: NoteEvent[];
  tokens: string[];
  slots: number;
  applied: number;
};

function fullwidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
}

/** Compact `12323632712231` or spaced `1 2 #4 3`. Accidentals and octave marks kept. */
export function parseDegreeTokens(text: string): string[] {
  const s = fullwidthDigits(text).trim();
  if (!s) return [];
  return s.match(DEGREE_RE) ?? [];
}

export function accidentalSemitones(token: string): number {
  if (token.includes("n")) return 0;
  if (token.includes("#")) return 1;
  if (token.includes("b")) return -1;
  return 0;
}

export function degreeTokenToPc(token: string, fromTonic = 0): number {
  const deg = Number(token.replace(/[^1-7]/g, ""));
  const step = MAJOR_SEMITONES[deg - 1] ?? 0;
  return (((fromTonic % 12) + 12 + step + accidentalSemitones(token)) % 12);
}

function nearestPcMidi(
  pc: number,
  ref: number,
  range?: { lo: number; hi: number },
): number {
  const target = ((pc % 12) + 12) % 12;
  const around = Number.isFinite(ref) && ref > 0 ? Math.round(ref) : 67;
  const lo = range?.lo ?? around;
  const hi = range?.hi ?? around;
  let best = target + 60;
  let score = Infinity;
  for (let m = 48; m <= 84; m++) {
    if (((m % 12) + 12) % 12 !== target) continue;
    const leap = Math.abs(m - around);
    let rangePen = 0;
    if (m < lo - 2) rangePen = lo - 2 - m;
    if (m > hi + 2) rangePen = m - (hi + 2);
    const band = m >= 60 && m <= 74 ? 0 : 1.4;
    const s = leap + rangePen * 2 + band;
    if (s < score) {
      score = s;
      best = m;
    }
  }
  return best;
}

export function degreeTokenToMidi(
  token: string,
  fromTonic: number,
  refMidi: number,
  range?: { lo: number; hi: number },
): number {
  const pc = degreeTokenToPc(token, fromTonic);
  const down = (token.match(/,/g) ?? []).length;
  const up = (token.match(/'/g) ?? []).length;
  return nearestPcMidi(pc, refMidi, range) + (up - down) * 12;
}

export function notesInPhrase(
  notes: NoteEvent[],
  phraseIndex: number,
  phrase?: Pick<ListenPhraseInfo, "start" | "end">,
): NoteEvent[] {
  const byIndex = notes.filter((n) => n.phraseIndex === phraseIndex);
  const hit = byIndex.length
    ? byIndex
    : phrase
      ? notes.filter((n) => {
          const t = n.rawStart ?? n.start;
          return t >= phrase.start && t < phrase.end;
        })
      : [];
  return [...hit].sort((a, b) => (a.rawStart ?? a.start) - (b.rawStart ?? b.start));
}

/**
 * Write a listened degree string onto already-counted phrase slots.
 * Timing / raw ticks stay. Does not invent a count.
 *
 * `fromTonic = 0` → tokens are C=1 固定调 (same numbers the cells show).
 * `fromTonic = key.tonic` → 听写 1=这首主音，写入后格子仍按 C=1 着色。
 */
export function applyEarDegrees(opts: {
  notes: NoteEvent[];
  phraseIndex: number;
  text: string;
  fromTonic?: number;
  phrase?: Pick<ListenPhraseInfo, "start" | "end">;
}): EarApplyResult {
  const tokens = parseDegreeTokens(opts.text);
  const fromTonic = opts.fromTonic ?? 0;
  const slots = notesInPhrase(opts.notes, opts.phraseIndex, opts.phrase);
  const n = Math.min(tokens.length, slots.length);
  const assigned = new Map<string, number>();
  const written: number[] = [];
  for (let i = 0; i < n; i++) {
    const slot = slots[i]!;
    const prev = written[written.length - 1];
    const ref = prev ?? (slot.midi >= 62 ? slot.midi : 67);
    const range = written.length
      ? { lo: Math.min(...written), hi: Math.max(...written) }
      : { lo: ref, hi: ref };
    const midi = degreeTokenToMidi(tokens[i]!, fromTonic, ref, range);
    assigned.set(slot.id, midi);
    written.push(midi);
  }
  const notes = opts.notes.map((note) => {
    const midi = assigned.get(note.id);
    if (midi == null) return note;
    return {
      ...note,
      midi,
      uncertain: false,
      pitchLocked: true,
      confidence: Math.max(note.confidence, 0.9),
    };
  });
  return { notes, tokens, slots: slots.length, applied: n };
}

export function fromTonicForMode(mode: EarWriteMode, keyTonic: number): number {
  return mode === "tonic1" ? keyTonic : 0;
}
