import { readFileSync, writeFileSync } from "node:fs";

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

export function writeWavMono16(path, samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i] ?? 0));
    data.writeInt16LE(Math.round(x * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}
