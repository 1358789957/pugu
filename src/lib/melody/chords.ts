import { fft, hann } from "./fft";
import { downsampleMono, mixToMono } from "./pitch";
import {
  beatSeconds,
  pitchClassName,
  prefersFlats,
  secondsPerSixteenth,
  tickToTime,
  timeToTick,
  type ChordEvent,
  type ChordQuality,
  type DetectedKey,
  type NoteEvent,
} from "./notes";

const WORK = 11025;
const FFT = 2048;
const HOP = 512;
const BINS = FFT / 2 + 1;

const QUALITIES: ChordQuality[] = ["maj", "min", "7", "m7", "sus4", "dim"];

/** Relative pitch-class templates (root at 0). */
const TEMPLATES: Record<ChordQuality, number[]> = {
  maj: [1, 0.05, 0.08, 0.08, 0.85, 0.08, 0.05, 1, 0.05, 0.15, 0.25, 0.08],
  min: [1, 0.05, 0.08, 0.85, 0.08, 0.1, 0.05, 1, 0.08, 0.12, 0.2, 0.08],
  "7": [1, 0.05, 0.06, 0.08, 0.75, 0.08, 0.05, 0.9, 0.05, 0.08, 0.8, 0.08],
  m7: [1, 0.05, 0.06, 0.8, 0.08, 0.1, 0.05, 0.9, 0.08, 0.08, 0.75, 0.08],
  sus4: [1, 0.05, 0.08, 0.1, 0.15, 0.85, 0.08, 1, 0.05, 0.1, 0.15, 0.08],
  dim: [1, 0.05, 0.08, 0.85, 0.08, 0.12, 0.85, 0.15, 0.08, 0.1, 0.15, 0.08],
};

const QUALITY_LABEL: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  "7": "7",
  m7: "m7",
  sus4: "sus4",
  dim: "dim",
};

export function chordSymbol(root: number, quality: ChordQuality, flats = false): string {
  return `${pitchClassName(root, flats)}${QUALITY_LABEL[quality]}`;
}

export function chordRoman(root: number, quality: ChordQuality, key: DetectedKey): string {
  const deg = (root - key.tonic + 12) % 12;
  const majorMap: Record<number, string> = {
    0: "I",
    2: "ii",
    3: "bIII",
    4: "iii",
    5: "IV",
    7: "V",
    8: "bVI",
    9: "vi",
    10: "bVII",
    11: "vii",
  };
  const minorMap: Record<number, string> = {
    0: "i",
    2: "ii",
    3: "III",
    5: "iv",
    7: "V",
    8: "VI",
    10: "VII",
    11: "vii",
  };
  const base = (key.mode === "minor" ? minorMap : majorMap)[deg] ?? `${deg}`;
  if (quality === "7" || quality === "m7") return `${base}7`;
  if (quality === "maj" && key.mode === "minor" && deg === 7) return "V";
  if (quality === "sus4") return `${base}sus`;
  if (quality === "dim") return `${base}°`;
  return base;
}

function diatonicBonus(root: number, quality: ChordQuality, key: DetectedKey): number {
  const deg = (root - key.tonic + 12) % 12;
  if (key.mode === "major") {
    const ok: Record<number, ChordQuality[]> = {
      0: ["maj", "7", "sus4"],
      2: ["min", "m7"],
      4: ["min", "m7"],
      5: ["maj", "7", "sus4"],
      7: ["maj", "7", "sus4"],
      9: ["min", "m7"],
      11: ["dim"],
    };
    if (ok[deg]?.includes(quality)) return deg === 0 || deg === 7 ? 0.16 : 0.12;
    return -0.04;
  }
  const ok: Record<number, ChordQuality[]> = {
    0: ["min", "m7"],
    3: ["maj", "7"],
    5: ["min", "m7"],
    7: ["maj", "7"],
    8: ["maj"],
    10: ["maj", "7"],
  };
  if (ok[deg]?.includes(quality)) return 0.12;
  return -0.03;
}

function rotate(tmpl: number[], root: number): number[] {
  const out = new Array<number>(12);
  for (let i = 0; i < 12; i++) out[(i + root) % 12] = tmpl[i] ?? 0;
  return out;
}

function cosine(a: number[], b: number[]): number {
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    num += a[i] * b[i];
    da += a[i] * a[i];
    db += b[i] * b[i];
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function binWeight(hz: number): number {
  if (hz < 60) return 0.08;
  if (hz < 90) return 0.45;
  if (hz < 280) return 1.45;
  if (hz < 700) return 1.1;
  if (hz < 1400) return 0.45;
  if (hz < 2200) return 0.12;
  return 0.04;
}

export function voicingFor(root: number, quality: ChordQuality, bassMidi = 48): number[] {
  const r = ((root % 12) + 12) % 12;
  let midi = bassMidi + r;
  if (midi < 48) midi += 12;
  if (midi > 59) midi -= 12;
  const third = quality === "min" || quality === "m7" || quality === "dim" ? 3 : quality === "sus4" ? 5 : 4;
  const fifth = quality === "dim" ? 6 : 7;
  const notes = [midi, midi + third, midi + fifth];
  if (quality === "7" || quality === "m7") notes.push(midi + 10);
  return notes;
}

export function transposeChords(chords: ChordEvent[], semitones: number, key?: DetectedKey): ChordEvent[] {
  if (!semitones) return chords;
  return chords.map((c) => {
    const root = (c.root + semitones + 120) % 12;
    const nextKey = key ?? { tonic: 0, mode: "major" as const, name: "C 大调", confidence: 1 };
    const flats = prefersFlats(nextKey.tonic, nextKey.mode);
    return {
      ...c,
      root,
      symbol: chordSymbol(root, c.quality, flats),
      roman: chordRoman(root, c.quality, nextKey),
    };
  });
}

export function formatProgression(
  chords: ChordEvent[],
  barsPerLine = 4,
  opts?: { bpm: number; gridOffset?: number },
): string {
  if (!chords.length) return "";
  const names = opts?.bpm ? barSymbols(chords, opts.bpm, opts.gridOffset ?? 0) : chords.map((c) => c.symbol);
  const lines: string[] = [];
  for (let i = 0; i < names.length; i += barsPerLine) {
    lines.push("| " + names.slice(i, i + barsPerLine).join("  | ") + "  |");
  }
  return lines.join("\n");
}

function barSymbols(chords: ChordEvent[], bpm: number, gridOffset: number): string[] {
  const measure = beatSeconds(bpm) * 4;
  const end = Math.max(...chords.map((c) => c.start + c.duration));
  const origin = gridOffset;
  const nBars = Math.max(1, Math.ceil((end - origin) / measure - 1e-4));
  const out: string[] = [];
  for (let i = 0; i < nBars; i++) {
    const t0 = origin + i * measure;
    const t1 = t0 + measure;
    const here = chords.filter((c) => c.start < t1 - 1e-3 && c.start + c.duration > t0 + 1e-3);
    if (!here.length) {
      out.push("N.C.");
      continue;
    }
    const parts: string[] = [];
    for (const c of here) {
      if (parts[parts.length - 1] !== c.symbol) parts.push(c.symbol);
    }
    out.push(parts.join(" "));
  }
  return out;
}

/** Snap chord edges to the same 16th / half-bar grid the melody uses. */
export function snapChordsToGrid(chords: ChordEvent[], bpm: number, gridOffset: number): ChordEvent[] {
  if (!chords.length || !Number.isFinite(bpm) || bpm < 40) return chords;
  const sixteenth = secondsPerSixteenth(bpm);
  const minUnits = 8;
  const snapped = chords
    .map((c) => {
      const startTick = timeToTick(c.start, bpm, gridOffset);
      const endTick = Math.max(startTick + minUnits, timeToTick(c.start + c.duration, bpm, gridOffset));
      return {
        ...c,
        start: tickToTime(startTick, bpm, gridOffset),
        duration: (endTick - startTick) * sixteenth,
      };
    })
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < snapped.length; i++) {
    const prev = snapped[i - 1];
    if (snapped[i].start < prev.start + prev.duration) {
      prev.duration = Math.max(sixteenth, snapped[i].start - prev.start);
    }
  }
  return mergeChords(snapped, beatSeconds(bpm));
}

type State = { root: number; quality: ChordQuality };

export async function detectChords(
  buffer: AudioBuffer,
  opts: {
    bpm: number;
    key: DetectedKey;
    gridOffset?: number;
    startSeconds?: number;
    duration?: number;
    melody?: NoteEvent[];
    onProgress?: (p: number, label: string) => void;
  },
): Promise<ChordEvent[]> {
  opts.onProgress?.(0.02, "听和弦");
  const start = opts.startSeconds ?? 0;
  const end = Math.min(buffer.duration, start + (opts.duration ?? buffer.duration));
  const mono = mixToMono(buffer);
  const a = Math.max(0, Math.floor(start * buffer.sampleRate));
  const b = Math.min(mono.length, Math.floor(end * buffer.sampleRate));
  const region = mono.subarray(a, b);
  const samples = downsampleMono(region, buffer.sampleRate, WORK);
  const win = hann(FFT);
  const frames = Math.max(1, Math.floor((samples.length - FFT) / HOP) + 1);
  const chroma = new Float32Array(frames * 12);
  const re = new Float32Array(FFT);
  const im = new Float32Array(FFT);
  let lastYield = performance.now();

  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < FFT; i++) {
      re[i] = (samples[off + i] ?? 0) * win[i];
    }
    fft(re, im, false);
    for (let k = 1; k < BINS; k++) {
      const hz = (k * WORK) / FFT;
      const w = binWeight(hz);
      if (w <= 0) continue;
      const mag = Math.hypot(re[k], im[k]) * w;
      const midi = 69 + 12 * Math.log2(Math.max(hz, 1e-6) / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[f * 12 + pc] += mag;
    }
    if (f % 40 === 0) {
      opts.onProgress?.(0.05 + (f / frames) * 0.55, "听和弦");
      const now = performance.now();
      if (now - lastYield > 22) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = now;
      }
    }
  }

  const bpm = Math.max(40, Math.min(220, opts.bpm || 100));
  const beat = 60 / bpm;
  const cell = beat * 2;
  const origin = Number.isFinite(opts.gridOffset) ? (opts.gridOffset as number) : start;
  let cell0 = origin;
  while (cell0 > start + 1e-6) cell0 -= cell;
  const nCells = Math.max(1, Math.ceil((end - cell0) / cell - 1e-6));
  const states: State[] = [];
  for (const quality of QUALITIES) {
    for (let root = 0; root < 12; root++) states.push({ root, quality });
  }
  const templates = states.map((s) => rotate(TEMPLATES[s.quality], s.root));
  const obs: number[][] = [];
  const cellStarts: number[] = [];

  for (let c = 0; c < nCells; c++) {
    const t0 = cell0 + c * cell;
    const t1 = t0 + cell;
    cellStarts.push(t0);
    const f0 = Math.max(0, Math.floor(((t0 - start) * WORK) / HOP));
    const f1 = Math.min(frames, Math.ceil(((t1 - start) * WORK) / HOP));
    const vec = new Array<number>(12).fill(0);
    for (let f = f0; f < f1; f++) {
      for (let p = 0; p < 12; p++) vec[p] += chroma[f * 12 + p];
    }
    const peak = Math.max(...vec, 1e-6);
    for (let p = 0; p < 12; p++) vec[p] /= peak;
    if (opts.melody?.length) {
      for (const n of opts.melody) {
        if (n.start + n.duration < t0 || n.start > t1) continue;
        vec[((Math.round(n.midi) % 12) + 12) % 12] += 0.12 * n.confidence;
      }
    }
    const scores = states.map((s, i) => {
      let sc = cosine(vec, templates[i]) * 2.2;
      sc += diatonicBonus(s.root, s.quality, opts.key);
      sc += triadPrior(vec, s.root, s.quality);
      return sc;
    });
    obs.push(scores);
  }

  const path = viterbi(obs, states);
  const flats = prefersFlats(opts.key.tonic, opts.key.mode);
  const raw: ChordEvent[] = path.map((s, i) => ({
    symbol: chordSymbol(s.root, s.quality, flats),
    root: s.root,
    quality: s.quality,
    start: cellStarts[i] ?? start + i * cell,
    duration: cell,
    confidence: Math.max(0, Math.min(1, (obs[i]?.[stateIndex(s)] ?? 0.5))),
    roman: chordRoman(s.root, s.quality, opts.key),
  }));

  opts.onProgress?.(0.95, "整理和弦");
  return snapChordsToGrid(
    mergeChords(
      raw.map((c) => simplifyChord(c, opts.key, flats)),
      beat,
    ),
    bpm,
    origin,
  );
}

function simplifyChord(c: ChordEvent, key: DetectedKey, flats: boolean): ChordEvent {
  let quality: ChordQuality = c.quality;
  if (quality === "7") quality = "maj";
  if (quality === "m7") quality = "min";
  if (quality === "sus4") quality = "maj";
  if (quality === "dim") quality = "min";
  return {
    ...c,
    quality,
    symbol: chordSymbol(c.root, quality, flats),
    roman: chordRoman(c.root, quality, key),
  };
}

function stateIndex(s: State): number {
  return QUALITIES.indexOf(s.quality) * 12 + s.root;
}

function viterbi(obs: number[][], states: State[]): State[] {
  const T = obs.length;
  const N = states.length;
  if (!T) return [];
  const dp = Array.from({ length: T }, () => new Float32Array(N).fill(-1e9));
  const back = Array.from({ length: T }, () => new Int16Array(N).fill(0));
  for (let i = 0; i < N; i++) dp[0][i] = obs[0][i];

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let best = -1e9;
      let arg = 0;
      for (let i = 0; i < N; i++) {
        const trans = transition(states[i], states[j]);
        const v = dp[t - 1][i] + trans;
        if (v > best) {
          best = v;
          arg = i;
        }
      }
      dp[t][j] = best + obs[t][j];
      back[t][j] = arg;
    }
  }
  let last = 0;
  let best = -1e9;
  for (let i = 0; i < N; i++) {
    if (dp[T - 1][i] > best) {
      best = dp[T - 1][i];
      last = i;
    }
  }
  const path = new Array<State>(T);
  let s = last;
  for (let t = T - 1; t >= 0; t--) {
    path[t] = states[s];
    s = back[t][s];
  }
  return path;
}

function triadPrior(chroma: number[], root: number, quality: ChordQuality): number {
  const thirdM = chroma[(root + 4) % 12] ?? 0;
  const thirdm = chroma[(root + 3) % 12] ?? 0;
  const fourth = chroma[(root + 5) % 12] ?? 0;
  const seventh = chroma[(root + 10) % 12] ?? 0;
  if (quality === "sus4") return fourth > thirdM + 0.12 && fourth > thirdm + 0.12 ? 0.02 : -0.18;
  if (quality === "maj") return thirdM >= thirdm ? 0.06 : -0.04;
  if (quality === "min") return thirdm > thirdM ? 0.06 : -0.04;
  if (quality === "7") return seventh > 0.35 && thirdM >= thirdm ? 0.04 : -0.08;
  if (quality === "m7") return seventh > 0.35 && thirdm > thirdM ? 0.04 : -0.08;
  if (quality === "dim") return -0.06;
  return 0;
}

function transition(a: State, b: State): number {
  if (a.root === b.root && a.quality === b.quality) return 0.3;
  if (a.root === b.root) return 0.02;
  const d = Math.min((b.root - a.root + 12) % 12, (a.root - b.root + 12) % 12);
  if (d === 5 || d === 7) return 0.03;
  if (d === 3 || d === 4) return 0.01;
  return -0.05;
}

function mergeChords(chords: ChordEvent[], beat: number): ChordEvent[] {
  if (!chords.length) return [];
  const out: ChordEvent[] = [];
  for (const c of chords) {
    const prev = out[out.length - 1];
    if (prev && prev.symbol === c.symbol) {
      prev.duration += c.duration;
      prev.confidence = (prev.confidence + c.confidence) / 2;
      continue;
    }
    out.push({ ...c });
  }
  // drop tiny flickers shorter than a beat if neighbors agree
  const cleaned: ChordEvent[] = [];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (
      c.duration <= beat * 2.2 &&
      i > 0 &&
      i < out.length - 1 &&
      out[i - 1].symbol === out[i + 1].symbol
    ) {
      cleaned[cleaned.length - 1].duration += c.duration + out[i + 1].duration;
      i += 1;
      continue;
    }
    cleaned.push(c);
  }
  return cleaned;
}
