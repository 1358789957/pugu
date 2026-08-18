import type { NoteEvent } from "./notes";
import type { BasicPitchNote } from "./basic-pitch-options";
import { BASIC_PITCH_RATE } from "./basic-pitch-options";
import { pickMelodyNotes, toPuguNotes } from "./basic-pitch-notes";
import { refineMelody } from "./refine-melody";

export { pickMelodyNotes, toPuguNotes };

export async function resampleMono22050(buffer: AudioBuffer): Promise<Float32Array> {
  const length = Math.max(1, Math.round(buffer.duration * BASIC_PITCH_RATE));
  const offline = new OfflineAudioContext(1, length, BASIC_PITCH_RATE);
  const mono = offline.createBuffer(1, buffer.length, buffer.sampleRate);
  const dest = mono.getChannelData(0);
  const nCh = buffer.numberOfChannels;
  for (let c = 0; c < nCh; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) dest[i] += ch[i] / nCh;
  }
  const src = offline.createBufferSource();
  src.buffer = mono;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

function modelUrl(): string {
  return new URL("/basic-pitch/model.json", window.location.href).href;
}

function runInWorker(
  audio: Float32Array,
  onProgress?: (pct: number) => void,
): Promise<BasicPitchNote[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./basic-pitch.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Basic Pitch 超时"));
    }, 180_000);
    worker.onmessage = (
      ev: MessageEvent<{ type: string; pct?: number; notes?: BasicPitchNote[]; message?: string }>,
    ) => {
      if (ev.data.type === "progress") {
        onProgress?.(ev.data.pct ?? 0);
        return;
      }
      window.clearTimeout(timer);
      worker.terminate();
      if (ev.data.type === "error") {
        reject(new Error(ev.data.message ?? "Basic Pitch 失败"));
        return;
      }
      resolve(ev.data.notes ?? []);
    };
    worker.onerror = (err) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error(err.message || "Basic Pitch Worker 失败"));
    };
    worker.postMessage({ audio, modelUrl: modelUrl() }, [audio.buffer]);
  });
}

async function runOnMain(
  audio: Float32Array,
  onProgress?: (pct: number) => void,
): Promise<BasicPitchNote[]> {
  const tf = await import("@tensorflow/tfjs");
  const { BasicPitch } = await import("@spotify/basic-pitch");
  const { notesFromActivations } = await import("./basic-pitch-decode");
  try {
    await tf.setBackend("webgl");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  const model = new BasicPitch(modelUrl());
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  await model.evaluateModel(
    audio,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (pct) => onProgress?.(pct),
  );
  return notesFromActivations(frames, onsets, contours);
}

export async function transcribeMelody(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void,
): Promise<NoteEvent[]> {
  const audio = await resampleMono22050(buffer);
  let raw: BasicPitchNote[];
  try {
    raw = await runInWorker(audio.slice(), onProgress);
  } catch {
    raw = await runOnMain(audio, onProgress);
  }
  return toPuguNotes(refineMelody(pickMelodyNotes(raw), audio, BASIC_PITCH_RATE));
}
