export type NoteEvent = {
  id: string;
  midi: number;
  start: number;
  duration: number;
  velocity: number;
  confidence: number;
};

export type ChordQuality = "maj" | "min" | "7" | "m7" | "sus4" | "dim";

export type ChordEvent = {
  symbol: string;
  root: number;
  quality: ChordQuality;
  start: number;
  duration: number;
  confidence: number;
  roman: string;
};

export type PitchFrame = {
  t: number;
  hz: number;
  midi: number;
  cents: number;
  conf: number;
  rms: number;
};

export type DetectedKey = {
  tonic: number;
  mode: "major" | "minor";
  name: string;
  confidence: number;
};

export type AnalysisResult = {
  notes: NoteEvent[];
  chords: ChordEvent[];
  key: DetectedKey;
  bpm: number;
  duration: number;
  sampleRate: number;
  waveform: Float32Array;
  pitchTrack: PitchFrame[];
};

export const NOTE_NAMES_SHARP = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export const NOTE_NAMES_FLAT = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;

export const MAJOR_KEYS_USE_FLATS = new Set([1, 3, 5, 8, 10]);

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function hzToMidi(hz: number): number {
  if (hz <= 0) return 0;
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiName(midi: number, flats = false): string {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const names = flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return `${names[pc]}${octave}`;
}

export function pitchClassName(pc: number, flats = false): string {
  const names = flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[((pc % 12) + 12) % 12];
}

export function prefersFlats(tonic: number, mode: "major" | "minor"): boolean {
  const majorTonic = mode === "minor" ? (tonic + 3) % 12 : tonic;
  return MAJOR_KEYS_USE_FLATS.has(majorTonic);
}

let noteSeq = 0;
export function makeNoteId(): string {
  noteSeq += 1;
  return `n${noteSeq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function resetNoteIds() {
  noteSeq = 0;
}

/** Krumhansl-Kessler key profiles (major / minor). */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(a: number[], b: number[]): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

const MAJOR_PENT = [0, 2, 4, 7, 9];

function fitsMajorPentatonic(hist: number[], tonic: number): boolean {
  const peak = Math.max(...hist, 1e-6);
  for (let pc = 0; pc < 12; pc++) {
    if (hist[pc] < peak * 0.12) continue;
    const degree = (pc - tonic + 12) % 12;
    if (!MAJOR_PENT.includes(degree)) return false;
  }
  return hist.some((v) => v > 0);
}

export function detectKey(notes: NoteEvent[]): DetectedKey {
  const hist = new Array<number>(12).fill(0);
  for (const n of notes) {
    const pc = ((Math.round(n.midi) % 12) + 12) % 12;
    hist[pc] += n.duration * (0.5 + n.velocity);
  }
  let best: DetectedKey = {
    tonic: 0,
    mode: "major",
    name: "C 大调",
    confidence: 0,
  };
  let second = 0;
  for (const mode of ["major", "minor"] as const) {
    const profile = mode === "major" ? MAJOR_PROFILE : MINOR_PROFILE;
    for (let tonic = 0; tonic < 12; tonic++) {
      const rotated = profile.map((_, i) => profile[(i - tonic + 12) % 12]);
      let score = correlate(hist, rotated);
      if (mode === "major" && fitsMajorPentatonic(hist, tonic)) {
        const peak = Math.max(...hist, 1e-6);
        score += 0.3;
        if (hist[tonic] > peak * 0.18 || hist[(tonic + 7) % 12] > peak * 0.18) score += 0.08;
      }
      if (score > best.confidence) {
        second = best.confidence;
        const flats = prefersFlats(tonic, mode);
        best = {
          tonic,
          mode,
          name: `${pitchClassName(tonic, flats)} ${mode === "major" ? "大调" : "小调"}`,
          confidence: score,
        };
      } else if (score > second) {
        second = score;
      }
    }
  }
  const gap = best.confidence - second;
  best.confidence = Math.max(0, Math.min(1, (best.confidence + gap) / 2));
  return best;
}

export function formatBpm(bpm: number): string {
  return `${Math.round(bpm)} BPM`;
}

export function snapMidi(hz: number): { midi: number; cents: number } {
  const raw = hzToMidi(hz);
  const midi = Math.round(raw);
  return { midi, cents: (raw - midi) * 100 };
}

export function transposeNotes(notes: NoteEvent[], semitones: number): NoteEvent[] {
  if (!semitones) return notes;
  return notes.map((n) => ({
    ...n,
    midi: Math.max(24, Math.min(96, n.midi + semitones)),
  }));
}

/** Pull stray octave jumps back toward the local median, then lock to one register. */
export function correctOctaves(notes: NoteEvent[]): NoteEvent[] {
  if (notes.length < 3) return notes;
  const out = notes.map((n) => ({ ...n }));
  for (let i = 0; i < out.length; i++) {
    const nearby: number[] = [];
    for (let j = Math.max(0, i - 4); j <= Math.min(out.length - 1, i + 4); j++) {
      if (j !== i) nearby.push(out[j].midi);
    }
    nearby.sort((a, b) => a - b);
    const med = nearby[Math.floor(nearby.length / 2)];
    let midi = out[i].midi;
    while (midi - med > 8) midi -= 12;
    while (med - midi > 8) midi += 12;
    out[i].midi = midi;
  }
  return lockMelodyOctave(out);
}

/** Walk from the strongest note so neighboring pitches stay in one singing octave. */
export function lockMelodyOctave(notes: NoteEvent[]): NoteEvent[] {
  if (notes.length < 2) return notes;
  const out = notes.map((n) => ({ ...n }));
  let anchor = 0;
  let best = -1;
  for (let i = 0; i < out.length; i++) {
    const band = out[i].midi >= 53 && out[i].midi <= 81 ? 1.5 : 0.8;
    const score = out[i].duration * (0.35 + out[i].confidence) * band;
    if (score > best) {
      best = score;
      anchor = i;
    }
  }
  for (let i = anchor + 1; i < out.length; i++) {
    out[i].midi = nearestMelodyOctave(out[i].midi, out[i - 1].midi);
  }
  for (let i = anchor - 1; i >= 0; i--) {
    out[i].midi = nearestMelodyOctave(out[i].midi, out[i + 1].midi);
  }
  const sorted = out.map((n) => n.midi).sort((a, b) => a - b);
  const globalMed = sorted[Math.floor(sorted.length / 2)];
  if (globalMed < 52) {
    for (const n of out) n.midi = Math.min(96, n.midi + 12);
  } else if (globalMed > 84) {
    for (const n of out) n.midi = Math.max(24, n.midi - 12);
  }
  return out;
}

function nearestMelodyOctave(midi: number, ref: number): number {
  let best = midi;
  let bestScore = Infinity;
  for (const d of [-24, -12, 0, 12, 24]) {
    const m = midi + d;
    if (m < 24 || m > 96) continue;
    const interval = Math.abs(m - ref);
    const band = m >= 53 && m <= 81 ? 0 : 4;
    const score = interval + band;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/**
 * Snap starts and lengths to a beat grid. Searches a small phase offset so
 * pickup notes (like a lead-in) still land on the grid.
 */
export function quantizeNotes(notes: NoteEvent[], bpm: number, division = 4): NoteEvent[] {
  if (!notes.length || !Number.isFinite(bpm) || bpm < 40) return notes;
  const grid = 60 / Math.max(40, bpm) / division;
  let bestOff = 0;
  let bestErr = Infinity;
  const steps = division * 2;
  for (let i = 0; i < steps; i++) {
    const off = (i * grid) / 2;
    let err = 0;
    for (const n of notes) {
      const snapped = Math.round((n.start - off) / grid) * grid + off;
      err += Math.abs(snapped - n.start);
    }
    if (err < bestErr) {
      bestErr = err;
      bestOff = off;
    }
  }

  const snapped = notes
    .map((n) => {
      const start = Math.max(0, Math.round((n.start - bestOff) / grid) * grid + bestOff);
      const rawEnd = n.start + n.duration;
      const end = Math.max(start + grid, Math.round((rawEnd - bestOff) / grid) * grid + bestOff);
      return { ...n, start, duration: end - start };
    })
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < snapped.length; i++) {
    const prev = snapped[i - 1];
    const prevEnd = prev.start + prev.duration;
    if (snapped[i].start < prevEnd) {
      const nextStart = snapped[i].start;
      prev.duration = Math.max(grid, nextStart - prev.start);
      if (prev.start + prev.duration > nextStart) {
        snapped[i].start = prev.start + prev.duration;
      }
    }
  }
  return snapped.filter((n) => n.duration >= grid * 0.9);
}

/** Circle-of-fifths: positive = sharps, negative = flats. */
export function keySignatureCount(tonic: number, mode: "major" | "minor"): number {
  const majorTonic = mode === "minor" ? (tonic + 3) % 12 : tonic;
  const map: Record<number, number> = {
    0: 0,
    7: 1,
    2: 2,
    9: 3,
    4: 4,
    11: 5,
    6: 6,
    1: -5,
    8: -4,
    3: -3,
    10: -2,
    5: -1,
  };
  return map[majorTonic] ?? 0;
}

const SHARP_ORDER_PC = [5, 0, 7, 2, 9, 4, 11]; // F C G D A E B
const FLAT_ORDER_PC = [11, 4, 9, 2, 7, 0, 5]; // B E A D G C F

/** Pitch-class → alteration in this key (−1 flat, +1 sharp). */
export function keyAlterations(tonic: number, mode: "major" | "minor"): Map<number, number> {
  const n = keySignatureCount(tonic, mode);
  const map = new Map<number, number>();
  if (n > 0) {
    for (let i = 0; i < n; i++) map.set(SHARP_ORDER_PC[i], 1);
  } else if (n < 0) {
    for (let i = 0; i < -n; i++) map.set(FLAT_ORDER_PC[i], -1);
  }
  return map;
}

/**
 * Accidental to print next to a note, given the key signature.
 * Uses letter spelling (C D E F G A B) so F# in G major is silent,
 * and F natural needs a natural.
 */
export function printedAccidental(
  midi: number,
  tonic: number,
  mode: "major" | "minor",
): "♯" | "♭" | "♮" | null {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const alters = keyAlterations(tonic, mode);
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  let bestLetter = 0;
  let bestDist = 99;
  for (let letter = 0; letter < 7; letter++) {
    const natural = LETTER_PC[letter];
    const expected = (natural + (alters.get(natural) ?? 0) + 12) % 12;
    const dist = Math.min((pc - expected + 12) % 12, (expected - pc + 12) % 12);
    if (dist < bestDist) {
      bestDist = dist;
      bestLetter = letter;
    }
  }
  const natural = LETTER_PC[bestLetter];
  const keyAlt = alters.get(natural) ?? 0;
  const expected = (natural + keyAlt + 12) % 12;
  if (pc === expected) return null;
  const writtenAlt = ((pc - natural + 12) % 12);
  if (writtenAlt === 0) return keyAlt !== 0 ? "♮" : null;
  if (writtenAlt === 1 || writtenAlt === 2) return "♯";
  return "♭";
}

/** Treble-clef key-signature mark positions as MIDI (for staffY). */
export function keySignatureMarks(
  tonic: number,
  mode: "major" | "minor",
): { midi: number; mark: "♯" | "♭" }[] {
  const n = keySignatureCount(tonic, mode);
  const sharpMidi = [77, 72, 79, 74, 69, 76, 71]; // F5 C5 G5 D5 A4 E5 B4
  const flatMidi = [71, 76, 69, 74, 67, 72, 65]; // B4 E5 A4 D5 G4 C5 F4
  if (n > 0) return sharpMidi.slice(0, n).map((midi) => ({ midi, mark: "♯" as const }));
  if (n < 0) return flatMidi.slice(0, -n).map((midi) => ({ midi, mark: "♭" as const }));
  return [];
}

export function durationBeats(duration: number, bpm: number): number {
  return duration / beatSeconds(bpm);
}

export function beatSeconds(bpm: number): number {
  return 60 / Math.max(40, Math.min(220, bpm || 100));
}

export function firstNoteTime(notes: NoteEvent[]): number {
  if (!notes.length) return 0;
  return Math.min(...notes.map((n) => n.start));
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 100;
  return Math.max(40, Math.min(220, Math.round(bpm)));
}

