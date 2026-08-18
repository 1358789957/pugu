import { hzToMidi } from "./notes";

export type YinOptions = {
  sampleRate: number;
  threshold?: number;
  minHz?: number;
  maxHz?: number;
  /** When false, keep the measured period (no B3→B4 half-tau jump). */
  preferOctaveUp?: boolean;
};

/**
 * YIN pitch estimate on a single window (de Cheveigné & Kawahara).
 * Tau search is limited to the melody band so a 1024-sample frame stays cheap.
 */
export function yinPitch(
  frame: Float32Array,
  opts: YinOptions,
): { hz: number; conf: number } {
  const { sampleRate } = opts;
  const threshold = opts.threshold ?? 0.14;
  const minHz = opts.minHz ?? 110;
  const maxHz = opts.maxHz ?? 1050;
  const n = frame.length;
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(Math.floor(n / 2) - 2, Math.floor(sampleRate / minHz));
  if (tauMax <= tauMin + 2) return { hz: 0, conf: 0 };

  const diff = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    const limit = n - tau;
    for (let i = 0; i < limit; i++) {
      const d = frame[i] - frame[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau] || 0;
    cmnd[tau] = running > 0 && tau >= tauMin ? (diff[tau] * tau) / running : 1;
  }

  let tauEst = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau += 1;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    let bestTau = tauMin;
    let bestVal = cmnd[tauMin];
    for (let tau = tauMin + 1; tau <= tauMax; tau++) {
      if (cmnd[tau] < bestVal) {
        bestVal = cmnd[tau];
        bestTau = tau;
      }
    }
    if (bestVal > 0.45) return { hz: 0, conf: 0 };
    tauEst = bestTau;
  }

  if (opts.preferOctaveUp !== false) {
    const half = Math.round(tauEst / 2);
    if (half >= tauMin && cmnd[half] < Math.min(0.22, cmnd[tauEst] + 0.08)) {
      tauEst = half;
    }
  }

  const x0 = Math.max(tauMin, tauEst - 1);
  const x2 = Math.min(tauMax, tauEst + 1);
  let better = tauEst;
  if (x0 !== tauEst && x2 !== tauEst) {
    const s0 = cmnd[x0];
    const s1 = cmnd[tauEst];
    const s2 = cmnd[x2];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-8) better = tauEst + (s2 - s0) / denom;
  }

  const hz = sampleRate / better;
  if (hz < minHz || hz > maxHz) return { hz: 0, conf: 0 };
  const conf = Math.max(0, Math.min(1, 1 - cmnd[tauEst]));
  return { hz, conf };
}

export function frameRms(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
  return Math.sqrt(s / frame.length);
}

export function downsampleMono(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function mixToMono(buffer: AudioBuffer): Float32Array {
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return ch0;
  const out = new Float32Array(buffer.length);
  const n = buffer.numberOfChannels;
  for (let c = 0; c < n; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / n;
  }
  return out;
}

export function downsamplePeaks(samples: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const step = samples.length / buckets;
  for (let i = 0; i < buckets; i++) {
    const a = Math.floor(i * step);
    const b = Math.min(samples.length, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = a; j < b; j++) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

export function median3(values: number[]): number[] {
  if (values.length < 3) return values.slice();
  const out = values.slice();
  for (let i = 1; i < values.length - 1; i++) {
    const a = values[i - 1];
    const b = values[i];
    const c = values[i + 1];
    out[i] = a > b ? (b > c ? b : a > c ? c : a) : a > c ? a : b > c ? c : b;
  }
  return out;
}

export function smoothMidi(midis: number[], confs: number[]): number[] {
  const out = midis.slice();
  for (let i = 2; i < midis.length - 2; i++) {
    if (confs[i] < 0.35) continue;
    const window = [midis[i - 2], midis[i - 1], midis[i], midis[i + 1], midis[i + 2]].filter(
      (m) => m > 0,
    );
    if (window.length < 3) continue;
    const sorted = window.slice().sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (Math.abs(out[i] - med) >= 10) out[i] = med;
  }
  return out;
}

export function rawMidi(hz: number): number {
  return hz > 0 ? hzToMidi(hz) : 0;
}
