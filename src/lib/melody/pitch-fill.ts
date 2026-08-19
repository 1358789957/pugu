import type { ContourFrame } from "./pitch-contour";
import type { NoteEvent } from "./notes";
import { foldSingingMidi } from "./phrase-onsets";

export type PhraseSection = "verse" | "pre" | "chorus" | "other";

export type FillPhrase = {
  start: number;
  end: number;
  section: PhraseSection;
};

type Slot = NoteEvent & {
  hint: number;
  octaveFolded: boolean;
  hintConf: number;
  uncertain: boolean;
};

function median(values: number[]): number {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function framesIn(frames: ContourFrame[], start: number, end: number): ContourFrame[] {
  return frames.filter((f) => f.t >= start && f.t < end && f.hz > 0);
}

function contourHint(frames: ContourFrame[], start: number, end: number): { midi: number; conf: number; folded: boolean } {
  const hit = framesIn(frames, start, Math.max(start + 0.04, end));
  const raw = median(hit.map((f) => f.midi));
  const conf = hit.length ? hit.reduce((s, f) => s + f.conf, 0) / hit.length : 0;
  const folded = foldSingingMidi(raw);
  return { midi: folded.midi, conf, folded: folded.folded };
}

function inPhrase(t: number, phrases: FillPhrase[]): FillPhrase | undefined {
  return phrases.find((p) => t >= p.start && t < p.end);
}

/**
 * Guess verse / pre / chorus from line order and optional lyric text.
 * A prior for register only — not an arrangement recipe.
 */
export function guessSection(index: number, total: number, text = ""): PhraseSection {
  const t = text.toLowerCase();
  if (/pre-?chorus|预副|副歌前/.test(t)) return "pre";
  if (/chorus|refrain|副歌/.test(t)) return "chorus";
  if (/verse|主歌/.test(t)) return "verse";
  if (total <= 1) return "verse";
  if (index >= Math.max(2, Math.floor(total * 0.55))) return "chorus";
  if (index >= Math.max(1, Math.floor(total * 0.4))) return "pre";
  return "verse";
}

function sectionRegister(section: PhraseSection): { lo: number; hi: number } {
  if (section === "chorus") return { lo: 62, hi: 81 };
  if (section === "pre") return { lo: 60, hi: 79 };
  return { lo: 57, hi: 76 };
}

function intervalKey(a: number, b: number): number {
  return Math.round(b) - Math.round(a);
}

/**
 * Repeated interval pairs from confident notes. Used only to fill a hole
 * that already has neighbors — never to invent a melody from scratch.
 */
export function extractMotives(midis: number[], mask: boolean[]): number[][] {
  const motives: number[][] = [];
  for (let i = 0; i < midis.length - 2; i++) {
    if (!mask[i] || !mask[i + 1] || !mask[i + 2]) continue;
    motives.push([
      intervalKey(midis[i]!, midis[i + 1]!),
      intervalKey(midis[i + 1]!, midis[i + 2]!),
    ]);
  }
  return motives;
}

function motiveSuggestion(left2: number | undefined, left1: number | undefined, motives: number[][]): number | null {
  if (left2 == null || left1 == null || !motives.length) return null;
  const d0 = intervalKey(left2, left1);
  const votes = new Map<number, number>();
  for (const m of motives) {
    if (m[0] === d0) votes.set(m[1]!, (votes.get(m[1]!) ?? 0) + 1);
  }
  let best: number | null = null;
  let n = 0;
  for (const [d, c] of votes) {
    if (c > n) {
      n = c;
      best = d;
    }
  }
  return best == null ? null : left1 + best;
}

function nearestOctave(midi: number, ref: number): number {
  let best = midi;
  let score = Math.abs(midi - ref);
  for (const d of [-12, 12]) {
    const m = midi + d;
    const s = Math.abs(m - ref);
    if (s < score && m >= 48 && m <= 84) {
      score = s;
      best = m;
    }
  }
  return best;
}

/**
 * Fill uncertain pitches **after** phrase count and the display grid exist.
 *
 * Uses measured f0, local smoothness, song motive, and verse/pre/chorus
 * register. Does not whitelist diatonic degrees. Does not hardcode a song.
 */
export function fillUncertainPitches(
  notes: NoteEvent[],
  frames: ContourFrame[],
  phrases: FillPhrase[] = [],
): NoteEvent[] {
  if (!notes.length) return notes;
  const slots: Slot[] = notes.map((n) => {
    const start = n.rawStart ?? n.start;
    const duration = n.rawDuration ?? n.duration;
    const hint = contourHint(frames, start, start + duration);
    const midi = hint.midi || n.midi;
    // Octave fold is register, not a hole. A stable folded F# / G must
    // keep its pitch class — do not let smoothness eat accidentals.
    const uncertain =
      hint.conf < 0.42 ||
      hint.midi <= 0 ||
      n.confidence < 0.4;
    return {
      ...n,
      midi,
      hint: midi,
      octaveFolded: hint.folded,
      hintConf: hint.conf,
      uncertain,
      confidence: Math.max(n.confidence, hint.conf),
    };
  });

  const confident = slots.map((s) => !s.uncertain);
  const motives = extractMotives(
    slots.map((s) => s.midi),
    confident,
  );

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (!s.uncertain && s.hint > 0) continue;
    const left = i > 0 ? slots[i - 1]!.midi : undefined;
    const right = i < slots.length - 1 ? slots[i + 1]!.midi : undefined;
    const left2 = i > 1 ? slots[i - 2]!.midi : undefined;
    const phrase = inPhrase(s.rawStart ?? s.start, phrases);
    const band = sectionRegister(phrase?.section ?? "verse");
    const motive = motiveSuggestion(left2, left, motives);

    const candidates = new Set<number>();
    if (s.hint > 0) {
      candidates.add(s.hint);
      candidates.add(foldSingingMidi(s.hint).midi);
    }
    if (left != null && right != null) {
      candidates.add(Math.round((left + right) / 2));
    }
    if (left != null) candidates.add(left);
    if (right != null) candidates.add(right);
    if (motive != null) candidates.add(motive);
    if (s.hint > 0 && left != null) candidates.add(nearestOctave(s.hint, left));
    if (s.hint > 0 && right != null) candidates.add(nearestOctave(s.hint, right));

    let best = s.hint || left || right || 60;
    let bestScore = Infinity;
    for (const raw of candidates) {
      if (raw < 48 || raw > 86) continue;
      let midi = raw;
      if (left != null) midi = nearestOctave(midi, left);
      const jumpL = left == null ? 0 : Math.abs(midi - left);
      const jumpR = right == null ? 0 : Math.abs(midi - right);
      const hintPen = s.hint > 0 ? Math.abs(midi - s.hint) * 0.65 : 0;
      const bandPen = midi < band.lo || midi > band.hi ? 1.4 : 0;
      const motivePen = motive != null && midi !== motive ? 0.35 : 0;
      const score = jumpL + jumpR * 0.85 + hintPen + bandPen + motivePen;
      if (score < bestScore) {
        bestScore = score;
        best = midi;
      }
    }
    s.midi = best;
    s.uncertain = false;
  }

  return slots.map(({ hint, octaveFolded, hintConf, uncertain, ...n }) => n);
}
