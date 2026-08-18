import { readFileSync } from "node:fs";

/** Read a PCM16 WAV and return mono float32. */
export function readWavMono16(path) {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error(`not riff: ${path}`);
  let off = 12;
  let channels = 1;
  let sampleRate = 22050;
  let data;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const start = off + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(start + 2);
      sampleRate = buf.readUInt32LE(start + 4);
    } else if (id === "data") {
      data = buf.subarray(start, start + size);
      break;
    }
    off = start + size + (size % 2);
  }
  if (!data) throw new Error(`no data chunk: ${path}`);
  const frames = data.length / 2 / channels;
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += data.readInt16LE((i * channels + c) * 2);
    out[i] = s / channels / 32768;
  }
  return { samples: out, sampleRate, channels };
}

export function sliceSeconds(samples, sampleRate, start, end) {
  const a = Math.max(0, Math.floor(start * sampleRate));
  const b = Math.min(samples.length, Math.floor(end * sampleRate));
  return samples.subarray(a, Math.max(a + 1, b));
}
