import { detectChords } from "./chords";
import {
  type AnalysisResult,
  type NoteEvent,
  type PitchFrame,
  correctOctaves,
  detectKey,
  makeNoteId,
  quantizeNotes,
  resetNoteIds,
  snapMidi,
} from "./notes";
import {
  downsampleMono,
  downsamplePeaks,
  frameRms,
  mixToMono,
  smoothMidi,
  yinPitch,
} from "./pitch";
import { isolateVocals } from "./vocals";

export type SegmentOptions = {
  minConfidence?: number;
  minDuration?: number;
  mergeGap?: number;
  splitRepeats?: boolean;
  quantize?: boolean;
  bpm?: number;
};

export type AnalyzeOptions = SegmentOptions & {
  maxSeconds?: number;
  startSeconds?: number;
  endSeconds?: number;
  isolateVocals?: boolean;
};

const TARGET_RATE = 16000;
const WINDOW = 1024;
const HOP = 256;

export async function bandpassMelody(buffer: AudioBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 160;
  hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1600;
  lp.Q.value = 0.7;
  src.connect(hp);
  hp.connect(lp);
  lp.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

function sliceMono(samples: Float32Array, sr: number, start: number, end: number): Float32Array {
  const a = Math.max(0, Math.floor(start * sr));
  const b = Math.min(samples.length, Math.floor(end * sr));
  return samples.subarray(a, b);
}

export async function extractPitchTrack(
  buffer: AudioBuffer,
  opts: AnalyzeOptions = {},
  onProgress?: (p: number, label: string) => void,
): Promise<{ track: PitchFrame[]; waveform: Float32Array; sampleRate: number; duration: number }> {
  onProgress?.(0.04, "滤出旋律频段");
  const filtered = await bandpassMelody(buffer);
  const mono = mixToMono(filtered);
  const start = opts.startSeconds ?? 0;
  const maxSeconds = opts.maxSeconds ?? 360;
  const end = Math.min(opts.endSeconds ?? buffer.duration, start + maxSeconds, buffer.duration);
  const region = sliceMono(mono, buffer.sampleRate, start, end);
  const samples = downsampleMono(region, buffer.sampleRate, TARGET_RATE);
  const waveform = downsamplePeaks(
    samples,
    Math.min(2400, Math.max(400, Math.floor(samples.length / 80))),
  );

  const track: PitchFrame[] = [];
  const total = Math.max(1, Math.floor((samples.length - WINDOW) / HOP));
  let lastYield = performance.now();
  let lastHz = 0;

  onProgress?.(0.12, "追踪音高");
  for (let i = 0; i < total; i++) {
    const offset = i * HOP;
    const frame = samples.subarray(offset, offset + WINDOW);
    const rms = frameRms(frame);
    const voiced = rms > (opts.isolateVocals ? 0.007 : 0.012);
    let { hz, conf } = voiced
      ? yinPitch(frame, {
          sampleRate: TARGET_RATE,
          threshold: opts.isolateVocals ? 0.16 : 0.14,
          minHz: 110,
          maxHz: 1050,
        })
      : { hz: 0, conf: 0 };

    if (hz > 0 && lastHz > 0) {
      let candidate = hz;
      while (candidate / lastHz > 1.8) candidate /= 2;
      while (lastHz / candidate > 1.8) candidate *= 2;
      const hi = candidate * 2;
      const lo = candidate / 2;
      const options = [candidate];
      if (hi >= 110 && hi <= 1050) options.push(hi);
      if (lo >= 110 && lo <= 1050) options.push(lo);
      hz = options.reduce((best, cur) =>
        melodyPitchCost(cur, lastHz) < melodyPitchCost(best, lastHz) ? cur : best,
      );
    }
    if (hz > 0 && conf > 0.4) lastHz = hz;
    else if (conf < 0.25) lastHz = 0;

    const snapped = hz > 0 ? snapMidi(hz) : { midi: 0, cents: 0 };
    track.push({
      t: start + offset / TARGET_RATE,
      hz,
      midi: snapped.midi,
      cents: snapped.cents,
      conf: voiced ? conf : 0,
      rms,
    });
    if (i % 80 === 0) {
      onProgress?.(0.12 + (i / total) * 0.72, "追踪音高");
      const now = performance.now();
      if (now - lastYield > 24) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = now;
      }
    }
  }

  const midis = smoothMidi(
    track.map((f) => f.midi),
    track.map((f) => f.conf),
  );
  for (let i = 0; i < track.length; i++) track[i].midi = midis[i];

  onProgress?.(0.88, "整理音高曲线");
  return { track, waveform, sampleRate: TARGET_RATE, duration: end - start };
}

function melodyPitchCost(hz: number, lastHz: number): number {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const lastMidi = 69 + 12 * Math.log2(lastHz / 440);
  const jump = Math.abs(midi - lastMidi);
  const band = midi >= 55 && midi <= 81 ? 0 : 3.5;
  return jump + band;
}

function localEnergyDip(track: PitchFrame[], i: number): boolean {
  const rms = track[i].rms;
  const prev = track[Math.max(0, i - 3)].rms;
  const next = track[Math.min(track.length - 1, i + 3)].rms;
  const peak = Math.max(prev, next, 1e-6);
  return rms < peak * 0.42 && prev > rms * 1.15 && next > rms * 1.15;
}

export function segmentNotes(track: PitchFrame[], opts: SegmentOptions = {}): NoteEvent[] {
  const minConf = opts.minConfidence ?? 0.42;
  const minDur = opts.minDuration ?? 0.09;
  const mergeGap = opts.mergeGap ?? 0.07;
  const splitRepeats = opts.splitRepeats ?? true;
  resetNoteIds();

  type Run = {
    midi: number;
    start: number;
    end: number;
    vel: number;
    conf: number;
    frames: number;
    articulated: boolean;
  };
  const runs: Run[] = [];
  let cur: Run | null = null;

  const hop = track.length > 1 ? track[1].t - track[0].t : HOP / TARGET_RATE;

  for (let i = 0; i < track.length; i++) {
    const f = track[i];
    const voiced = f.conf >= minConf && f.midi > 0 && f.rms > 0.007;
    if (!voiced) {
      if (cur) {
        cur.end = f.t;
        runs.push(cur);
        cur = null;
      }
      continue;
    }
    let pitchChange = false;
    let reattack = false;
    if (cur) {
      pitchChange = cur.midi !== f.midi;
      reattack = splitRepeats && !pitchChange && localEnergyDip(track, i);
    }
    if (!cur || pitchChange || reattack) {
      if (cur) {
        cur.end = f.t;
        runs.push(cur);
      }
      cur = {
        midi: f.midi,
        start: f.t,
        end: f.t + hop,
        vel: f.rms,
        conf: f.conf,
        frames: 1,
        articulated: reattack,
      };
    } else {
      cur.end = f.t + hop;
      cur.vel += f.rms;
      cur.conf += f.conf;
      cur.frames += 1;
    }
  }
  if (cur) runs.push(cur);

  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    // Re-attacks of the same pitch must stay separate — otherwise 小星星
    // collapses C C into a single half note.
    if (last && last.midi === r.midi && !r.articulated && r.start - last.end <= mergeGap) {
      const frames = last.frames + r.frames;
      last.end = r.end;
      last.vel += r.vel;
      last.conf += r.conf;
      last.frames = frames;
    } else {
      merged.push({ ...r });
    }
  }

  const notes: NoteEvent[] = [];
  for (const r of merged) {
    const duration = r.end - r.start;
    if (duration < minDur) continue;
    notes.push({
      id: makeNoteId(),
      midi: r.midi,
      start: r.start,
      duration,
      velocity: Math.max(0.15, Math.min(1, (r.vel / r.frames) * 8)),
      confidence: r.conf / r.frames,
    });
  }
  return correctOctaves(notes);
}

export function detectBpm(track: PitchFrame[]): number {
  const onsets: number[] = [];
  let prev = 0;
  for (let i = 2; i < track.length - 2; i++) {
    const flux = Math.max(0, track[i].rms - track[i - 1].rms);
    const rising = track[i].rms > prev * 1.35 && flux > 0.004;
    const pitchChange =
      track[i].midi > 0 && track[i - 1].midi > 0 && track[i].midi !== track[i - 1].midi;
    if ((rising && track[i].conf > 0.3) || (pitchChange && track[i].conf > 0.45)) {
      if (onsets.length === 0 || track[i].t - onsets[onsets.length - 1] > 0.12) {
        onsets.push(track[i].t);
      }
    }
    prev = track[i].rms;
  }
  if (onsets.length < 4) return 100;

  const ioi: number[] = [];
  for (let i = 1; i < onsets.length; i++) ioi.push(onsets[i] - onsets[i - 1]);
  const bins = new Map<number, number>();
  for (const d of ioi) {
    let bpm = 60 / d;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    const key = Math.round(bpm);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let best = 100;
  let bestN = 0;
  for (const [bpm, n] of bins) {
    const neighbors = n + (bins.get(bpm - 1) ?? 0) + (bins.get(bpm + 1) ?? 0);
    const comfort = bpm >= 80 && bpm <= 132 ? 1.25 : 1;
    const score = neighbors * comfort;
    if (score > bestN) {
      bestN = score;
      best = bpm;
    }
  }
  if (best >= 148) {
    const half = Math.round(best / 2);
    const halfScore =
      ((bins.get(half) ?? 0) + (bins.get(half - 1) ?? 0) + (bins.get(half + 1) ?? 0)) * 1.25;
    if (halfScore >= bestN * 0.4) best = half;
  }
  return best;
}

export function buildResult(
  track: PitchFrame[],
  waveform: Float32Array,
  sampleRate: number,
  duration: number,
  opts: SegmentOptions = {},
): AnalysisResult {
  let notes = segmentNotes(track, opts);
  const bpm = opts.bpm ?? detectBpm(track);
  if (opts.quantize !== false) notes = quantizeNotes(notes, bpm);
  return {
    notes,
    chords: [],
    key: detectKey(notes),
    bpm,
    duration,
    sampleRate,
    waveform,
    pitchTrack: track,
  };
}

export async function analyzeMelody(
  buffer: AudioBuffer,
  opts: AnalyzeOptions = {},
  onProgress?: (p: number, label: string) => void,
): Promise<AnalysisResult & { vocalBuffer?: AudioBuffer }> {
  let work = buffer;
  let vocalBuffer: AudioBuffer | undefined;
  if (opts.isolateVocals) {
    vocalBuffer = await isolateVocals(buffer, (p, label) => onProgress?.(p * 0.3, label));
    work = vocalBuffer;
  }
  const { track, waveform, sampleRate, duration } = await extractPitchTrack(
    work,
    opts,
    (p, label) => onProgress?.(opts.isolateVocals ? 0.3 + p * 0.64 : p, label),
  );
  onProgress?.(0.96, "切分音符");
  const result = buildResult(track, waveform, sampleRate, duration, opts);
  result.chords = await detectChords(buffer, {
    bpm: result.bpm,
    key: result.key,
    startSeconds: opts.startSeconds ?? 0,
    duration,
    melody: result.notes,
    onProgress: (p, label) => onProgress?.(0.9 + p * 0.09, label),
  });
  onProgress?.(1, "完成");
  return { ...result, vocalBuffer };
}
