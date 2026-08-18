import { downsampleMono } from "./pitch";
import { fft, hann } from "./fft";

const WORK_RATE = 22050;
const FFT = 2048;
const HOP = 512;
const BINS = FFT / 2 + 1;

export type IsolateProgress = (p: number, label: string) => void;

/**
 * Lightweight vocal isolate for melody extraction.
 * Stereo: keep the mid (centered) image, drop sides.
 * Then HPSS + a vocal-band prior so drums/bass don't steal the pitch tracker.
 */
export async function isolateVocals(
  buffer: AudioBuffer,
  onProgress?: IsolateProgress,
): Promise<AudioBuffer> {
  onProgress?.(0.02, "分离人声");
  const srIn = buffer.sampleRate;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const midSrc = new Float32Array(left.length);
  const sideSrc = new Float32Array(left.length);
  let stereoEnergy = 0;
  for (let i = 0; i < left.length; i++) {
    midSrc[i] = 0.5 * (left[i] + right[i]);
    sideSrc[i] = 0.5 * (left[i] - right[i]);
    stereoEnergy += sideSrc[i] * sideSrc[i];
  }
  const stereo = buffer.numberOfChannels > 1 && stereoEnergy / left.length > 1e-6;

  const mid = downsampleMono(midSrc, srIn, WORK_RATE);
  const side = stereo ? downsampleMono(sideSrc, srIn, WORK_RATE) : null;
  const out = new Float32Array(mid.length);
  const win = hann(FFT);
  const frames = Math.max(1, Math.floor((mid.length - FFT) / HOP) + 1);
  const timeWin = 9;
  const freqWin = 7;

  const mag = new Float32Array(frames * BINS);
  const phase = new Float32Array(frames * BINS);
  const sideMag = stereo ? new Float32Array(frames * BINS) : null;

  const re = new Float32Array(FFT);
  const im = new Float32Array(FFT);
  let lastYield = performance.now();

  for (let f = 0; f < frames; f++) {
    fillFrame(mid, f * HOP, win, re, im);
    fft(re, im, false);
    const base = f * BINS;
    for (let k = 0; k < BINS; k++) {
      mag[base + k] = Math.hypot(re[k], im[k]);
      phase[base + k] = Math.atan2(im[k], re[k]);
    }
    if (side && sideMag) {
      fillFrame(side, f * HOP, win, re, im);
      fft(re, im, false);
      for (let k = 0; k < BINS; k++) sideMag[base + k] = Math.hypot(re[k], im[k]);
    }
    if (f % 24 === 0) {
      onProgress?.(0.04 + (f / frames) * 0.42, "分离人声");
      const now = performance.now();
      if (now - lastYield > 20) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = now;
      }
    }
  }

  const harm = new Float32Array(frames * BINS);
  const perc = new Float32Array(frames * BINS);
  const tHalf = (timeWin - 1) >> 1;
  const fHalf = (freqWin - 1) >> 1;

  for (let f = 0; f < frames; f++) {
    const f0 = Math.max(0, f - tHalf);
    const f1 = Math.min(frames - 1, f + tHalf);
    const tCount = f1 - f0 + 1;
    const base = f * BINS;
    for (let k = 0; k < BINS; k++) {
      let s = 0;
      for (let j = f0; j <= f1; j++) s += mag[j * BINS + k];
      harm[base + k] = s / tCount;
    }
    if (f % 32 === 0) {
      onProgress?.(0.46 + (f / frames) * 0.16, "分离人声");
      const now = performance.now();
      if (now - lastYield > 20) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = now;
      }
    }
  }

  for (let f = 0; f < frames; f++) {
    const base = f * BINS;
    for (let k = 0; k < BINS; k++) {
      const k0 = Math.max(0, k - fHalf);
      const k1 = Math.min(BINS - 1, k + fHalf);
      let s = 0;
      for (let j = k0; j <= k1; j++) s += mag[base + j];
      perc[base + k] = s / (k1 - k0 + 1);
    }
  }

  onProgress?.(0.68, "提纯人声频段");
  const prior = vocalPrior(WORK_RATE);
  for (let f = 0; f < frames; f++) {
    const base = f * BINS;
    for (let k = 0; k < BINS; k++) {
      const h = harm[base + k];
      const p = perc[base + k];
      const harmonic = (h * h) / (h * h + p * p + 1e-8);
      let center = 1;
      if (sideMag) {
        const m = mag[base + k];
        const s = sideMag[base + k];
        const c = m / (m + s + 1e-8);
        center = c * c;
      }
      const mask = 0.38 + 0.62 * Math.min(1, harmonic * 0.75 + 0.25) * center * prior[k];
      mag[base + k] *= mask;
    }
  }

  const ola = new Float32Array(mid.length + FFT);
  const winSum = new Float32Array(mid.length + FFT);
  for (let f = 0; f < frames; f++) {
    const base = f * BINS;
    re.fill(0);
    im.fill(0);
    for (let k = 0; k < BINS; k++) {
      const a = mag[base + k];
      const ph = phase[base + k];
      re[k] = a * Math.cos(ph);
      im[k] = a * Math.sin(ph);
      if (k > 0 && k < FFT - k) {
        re[FFT - k] = re[k];
        im[FFT - k] = -im[k];
      }
    }
    fft(re, im, true);
    const off = f * HOP;
    for (let i = 0; i < FFT; i++) {
      ola[off + i] += re[i] * win[i];
      winSum[off + i] += win[i] * win[i];
    }
    if (f % 32 === 0) {
      onProgress?.(0.72 + (f / frames) * 0.22, "合成干声");
      const now = performance.now();
      if (now - lastYield > 20) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = now;
      }
    }
  }

  const wet = stereo ? 0.82 : 0.48;
  for (let i = 0; i < out.length; i++) {
    const isolated = winSum[i] > 1e-6 ? ola[i] / winSum[i] : 0;
    out[i] = isolated * wet + mid[i] * (1 - wet);
  }

  let peak = 1e-6;
  let sumSq = 0;
  for (let i = 0; i < out.length; i++) {
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
    sumSq += out[i] * out[i];
  }
  const rms = Math.sqrt(sumSq / out.length);
  const target = Math.min(0.22, Math.max(0.08, rms * 2.4));
  const gain = Math.min(8, target / Math.max(rms, 1e-6));
  const clip = 0.96 / peak;
  const scale = Math.min(gain, clip);
  for (let i = 0; i < out.length; i++) out[i] *= scale;

  const isolated = new AudioBuffer({
    length: out.length,
    numberOfChannels: 1,
    sampleRate: WORK_RATE,
  });
  isolated.copyToChannel(out, 0);
  onProgress?.(0.96, "人声已分开");
  return isolated;
}

function fillFrame(
  src: Float32Array,
  offset: number,
  win: Float32Array,
  re: Float32Array,
  im: Float32Array,
) {
  re.fill(0);
  im.fill(0);
  const n = Math.min(FFT, src.length - offset);
  for (let i = 0; i < n; i++) re[i] = src[offset + i] * win[i];
}

function vocalPrior(sr: number): Float32Array {
  const prior = new Float32Array(BINS);
  for (let k = 0; k < BINS; k++) {
    const hz = (k * sr) / FFT;
    if (hz < 90) prior[k] = 0.05;
    else if (hz < 160) prior[k] = 0.28;
    else if (hz < 280) prior[k] = 0.75;
    else if (hz < 3800) prior[k] = 1;
    else if (hz < 6200) prior[k] = 0.42;
    else prior[k] = 0.1;
  }
  return prior;
}
