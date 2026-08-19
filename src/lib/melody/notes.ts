export type NoteEvent = {
  id: string;
  midi: number;
  start: number;
  duration: number;
  velocity: number;
  confidence: number;
  /** Unquantized analysis time. MIDI export uses this; the staff stays on `start`. */
  rawStart?: number;
  rawDuration?: number;
  /** Phrase-local decode index. Extras stay in this phrase. */
  phraseIndex?: number;
  /** Machine pitch is a hint only — show `?` until the user writes the degree. */
  uncertain?: boolean;
  /** User wrote this pitch onto a counted slot. Resegment must keep it. */
  pitchLocked?: boolean;
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
  /** 1/f0 when voiced or wavelength-continued. */
  periodSec?: number;
  /** True when this sample was completed from a neighbor period. */
  filled?: boolean;
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
  /** Wavelength-filled 音调仪 contour (time × pitch). */
  pitchTrack: PitchFrame[];
  /** Raw tuner frames before wavelength-continue. Breaks are unvoiced. */
  rawPitchTrack?: PitchFrame[];
  /** Time of a 4/4 downbeat. Barlines sit at gridOffset + n * (4 beats). */
  gridOffset?: number;
  /** Unquantized melody from the listen-to-score path (or YIN fallback). Resegment uses this. */
  sourceNotes?: NoteEvent[];
  /** Phrase windows + local note counts from the real-audio path. */
  listenPhrases?: ListenPhraseInfo[];
};

export type ListenPhraseInfo = {
  start: number;
  end: number;
  text?: string;
  noteCount: number;
  section: "verse" | "pre" | "chorus" | "other";
  grid: "16th" | "triplet";
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

export function secondsPerSixteenth(bpm: number): number {
  return beatSeconds(bpm) / 4;
}

export function timeToTick(t: number, bpm: number, gridOffset: number): number {
  return Math.round((t - gridOffset) / secondsPerSixteenth(bpm));
}

export function tickToTime(tick: number, bpm: number, gridOffset: number): number {
  return gridOffset + tick * secondsPerSixteenth(bpm);
}

export function resolveGridOffset(
  result: Pick<AnalysisResult, "notes" | "bpm" | "gridOffset">,
): number {
  if (Number.isFinite(result.gridOffset)) return result.gridOffset as number;
  return findGridOffset(result.notes, result.bpm);
}

/** Sub-16th phase in [0, sixteenth) that best matches note attacks. */
export function findGridPhase(notes: NoteEvent[], bpm: number): number {
  if (!notes.length || !Number.isFinite(bpm) || bpm < 40) return 0;
  const sixteenth = secondsPerSixteenth(bpm);
  const steps = 8;
  let bestOff = 0;
  let bestErr = Infinity;
  for (let i = 0; i < steps; i++) {
    const off = (i * sixteenth) / steps;
    let err = 0;
    let wsum = 0;
    for (const n of notes) {
      const w = (0.4 + n.confidence) * Math.min(2.5, Math.sqrt(Math.max(0.08, n.duration)));
      const snapped = Math.round((n.start - off) / sixteenth) * sixteenth + off;
      err += Math.abs(snapped - n.start) * w;
      wsum += w;
    }
    const mean = wsum ? err / wsum : err;
    if (mean < bestErr) {
      bestErr = mean;
      bestOff = off;
    }
  }
  return bestOff;
}

/**
 * Time of a 4/4 downbeat. Phase is chosen from attacks; the 16th that is
 * beat 1 is the rotation that puts the most weight on beats.
 */
export function findGridOffset(notes: NoteEvent[], bpm: number): number {
  if (!notes.length || !Number.isFinite(bpm) || bpm < 40) return 0;
  const sixteenth = secondsPerSixteenth(bpm);
  const phase = findGridPhase(notes, bpm);
  let bestK = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < 16; k++) {
    let score = 0;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const step = Math.round((n.start - phase) / sixteenth);
      const pos = (((step - k) % 16) + 16) % 16;
      const units = Math.max(1, Math.round(n.duration / sixteenth));
      const w = 0.5 + 0.5 * n.confidence;
      if (pos === 0) score += 1.15 * w;
      else if (pos % 4 === 0) score += 1 * w;
      else if (pos % 2 === 0) score += 0.15 * w;
      else score -= 0.12 * w;
      if (i === 0 && pos % 4 === 0) score += 0.55 * w;
      if (i === 0 && pos === 0) score += 0.4 * w;
      if (units >= 6 && (pos + units) % 16 === 0) score += 0.75 * w;
    }
    if (score > bestScore + 1e-6) {
      bestScore = score;
      bestK = k;
    }
  }
  return phase + bestK * sixteenth;
}

const BEAT_UNITS = [1, 2, 4, 8, 16, 24, 32];
const DOTTED_UNITS = [3, 6, 12];
const PREFERRED_UNITS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

function snapDurationUnits(raw: number, maxUnits: number, startTick: number): number {
  const cap = Math.max(1, Math.floor(maxUnits));
  const r = Math.max(0.51, Math.min(cap, raw));
  const onBeat = ((startTick % 4) + 4) % 4 === 0;
  const pool = onBeat ? [...BEAT_UNITS, ...DOTTED_UNITS] : PREFERRED_UNITS;
  let best = Math.max(1, Math.min(cap, Math.round(r)));
  let bestScore = Infinity;
  for (const p of pool) {
    if (p > cap) continue;
    const d = Math.abs(p - r);
    const dotted = p === 3 || p === 6 || p === 12;
    const score = d + (dotted ? 0.28 : 0) + (onBeat && p % 4 !== 0 && p > 2 ? 0.12 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export type QuantizeResult = {
  notes: NoteEvent[];
  gridOffset: number;
};

/**
 * Snap attacks and lengths to a 16th grid aligned to the detected downbeat.
 * Durations prefer readable values (16th / 8th / quarter / dotted / half).
 */
export function quantizeToGrid(notes: NoteEvent[], bpm: number): QuantizeResult {
  if (!notes.length || !Number.isFinite(bpm) || bpm < 40) {
    return { notes, gridOffset: 0 };
  }
  const sixteenth = secondsPerSixteenth(bpm);
  const gridOffset = findGridOffset(notes, bpm);

  const snapped = notes
    .map((n) => {
      const startTick = timeToTick(n.start, bpm, gridOffset);
      const rawUnits = Math.max(0.51, n.duration / sixteenth);
      return { n, startTick, rawUnits };
    })
    .sort((a, b) => a.startTick - b.startTick || b.rawUnits - a.rawUnits);

  const placed: { n: NoteEvent; startTick: number; units: number }[] = [];
  for (let i = 0; i < snapped.length; i++) {
    const cur = snapped[i];
    const nextStart = snapped[i + 1]?.startTick ?? cur.startTick + 64;
    const gap = nextStart - cur.startTick;
    const maxUnits = Math.max(1, gap);
    let units = snapDurationUnits(cur.rawUnits, maxUnits, cur.startTick);
    const nextOnBeat = !snapped[i + 1] || (((nextStart % 4) + 4) % 4 === 0);
    if (nextOnBeat && [2, 4, 8, 16].includes(gap) && cur.rawUnits >= gap * 0.62) {
      units = gap;
    } else if (gap >= 1 && gap <= 32 && Math.abs(cur.rawUnits - gap) <= 1.15) {
      const filled = snapDurationUnits(gap, gap, cur.startTick);
      if (filled <= maxUnits) units = Math.min(maxUnits, Math.max(units, filled));
    }
    if (placed.length) {
      const prev = placed[placed.length - 1];
      if (cur.startTick < prev.startTick + prev.units) {
        prev.units = Math.max(1, cur.startTick - prev.startTick);
      }
    }
    placed.push({ n: cur.n, startTick: cur.startTick, units });
  }

  const out = placed
    .filter((p) => p.units >= 1)
    .map((p) => ({
      ...p.n,
      start: Math.max(0, tickToTime(p.startTick, bpm, gridOffset)),
      duration: p.units * sixteenth,
      rawStart: p.n.rawStart ?? p.n.start,
      rawDuration: p.n.rawDuration ?? p.n.duration,
    }));

  return { notes: out, gridOffset };
}

export function quantizeNotes(notes: NoteEvent[], bpm: number, _division = 4): NoteEvent[] {
  return quantizeToGrid(notes, bpm).notes;
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

export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;

export type NoteSpelling = {
  letter: number;
  alter: number;
  octave: number;
  /** White-key MIDI used for staff position (letter + octave). */
  staffMidi: number;
  printed: "♯" | "♭" | "♮" | null;
};

function alterMark(alter: number): "♯" | "♭" | "♮" | null {
  if (alter > 0) return "♯";
  if (alter < 0) return "♭";
  return "♮";
}

function octaveForLetter(midi: number, writtenPc: number): number {
  const rounded = Math.round(midi);
  let oct = Math.floor(rounded / 12) - 1;
  const naturalMidi = (oct + 1) * 12 + writtenPc;
  if (rounded - naturalMidi > 6) oct += 1;
  if (naturalMidi - rounded > 6) oct -= 1;
  return oct;
}

/**
 * Spell a MIDI pitch in this key (letter + accidental + staff line).
 * F♯ in G major sits on F with no printed accidental; F♮ needs a natural.
 */
export function spellNote(midi: number, tonic: number, mode: "major" | "minor"): NoteSpelling {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const alters = keyAlterations(tonic, mode);
  const preferFlat = prefersFlats(tonic, mode);

  for (let letter = 0; letter < 7; letter++) {
    const natural = LETTER_PC[letter];
    const keyAlt = alters.get(natural) ?? 0;
    if ((natural + keyAlt + 12) % 12 === pc) {
      const octave = octaveForLetter(midi, natural);
      return {
        letter,
        alter: keyAlt,
        octave,
        staffMidi: (octave + 1) * 12 + natural,
        printed: null,
      };
    }
  }

  const candidates: { letter: number; alter: number }[] = [];
  for (let letter = 0; letter < 7; letter++) {
    const natural = LETTER_PC[letter];
    let alter = pc - natural;
    if (alter > 6) alter -= 12;
    if (alter < -6) alter += 12;
    if (alter < -2 || alter > 2) continue;
    candidates.push({ letter, alter });
  }
  candidates.sort((a, b) => {
    const aOdd = Math.abs(a.alter);
    const bOdd = Math.abs(b.alter);
    if (aOdd !== bOdd) return aOdd - bOdd;
    if (preferFlat && a.alter !== b.alter) return a.alter - b.alter;
    if (!preferFlat && a.alter !== b.alter) return b.alter - a.alter;
    return a.letter - b.letter;
  });
  const pick = candidates[0] ?? { letter: 0, alter: 0 };
  const natural = LETTER_PC[pick.letter];
  const keyAlt = alters.get(natural) ?? 0;
  const octave = octaveForLetter(midi, natural);
  return {
    letter: pick.letter,
    alter: pick.alter,
    octave,
    staffMidi: (octave + 1) * 12 + natural,
    printed: pick.alter === keyAlt ? null : alterMark(pick.alter),
  };
}

export function printedAccidental(
  midi: number,
  tonic: number,
  mode: "major" | "minor",
): "♯" | "♭" | "♮" | null {
  return spellNote(midi, tonic, mode).printed;
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

