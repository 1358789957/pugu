import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";
import { BasicPitch } from "@spotify/basic-pitch";
import { BASIC_PITCH_OPTS } from "../src/lib/melody/basic-pitch-options.ts";
import { notesFromActivations } from "../src/lib/melody/basic-pitch-decode.ts";
import { pickMelodyNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { midiToJianpu } from "../src/lib/melody/leadsheet.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

class FileIOHandler {
  constructor(dir) {
    this.dir = dir;
  }
  async load() {
    const spec = JSON.parse(readFileSync(join(this.dir, "model.json"), "utf8"));
    const parts = [];
    const weightSpecs = [];
    for (const group of spec.weightsManifest ?? []) {
      weightSpecs.push(...group.weights);
      for (const p of group.paths) parts.push(readFileSync(join(this.dir, p)));
    }
    const weightData = Buffer.concat(parts);
    return {
      modelTopology: spec.modelTopology,
      format: spec.format,
      generatedBy: spec.generatedBy,
      convertedBy: spec.convertedBy,
      weightSpecs,
      weightData: weightData.buffer.slice(
        weightData.byteOffset,
        weightData.byteOffset + weightData.byteLength,
      ),
    };
  }
}

export async function transcribeWavSamples(samples, _opts = BASIC_PITCH_OPTS) {
  await tf.setBackend("cpu");
  await tf.ready();
  const modelDir = join(root, "public/basic-pitch");
  const graph = await tf.loadGraphModel(new FileIOHandler(modelDir));
  const model = new BasicPitch(Promise.resolve(graph));
  const frames = [];
  const onsets = [];
  const contours = [];
  await model.evaluateModel(
    samples,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    () => {},
  );
  const raw = notesFromActivations(frames, onsets, contours);
  const melody = pickMelodyNotes(raw);
  return { raw, melody };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wav = process.argv[2] ?? join(root, "examples/hirumawari/昼回のメモリー-人声.wav");
  const start = Number(process.argv[3] ?? 0);
  const end = Number(process.argv[4] ?? 12);
  const { samples, sampleRate } = readWavMono16(wav);
  console.error(`wav ${sampleRate}Hz ${samples.length / sampleRate}s → ${start}-${end}s`);
  const slice = sliceSeconds(samples, sampleRate, start, end);
  const { raw, melody } = await transcribeWavSamples(slice);
  const rows = melody.map((n) => ({
    t: +n.startTimeSeconds.toFixed(3),
    d: +n.durationSeconds.toFixed(3),
    midi: Math.round(n.pitchMidi),
    j: midiToJianpu(n.pitchMidi, 0, 60, false).replace(/[,']/g, ""),
    jp: midiToJianpu(n.pitchMidi, 0, 60, false),
    amp: +n.amplitude.toFixed(3),
  }));
  console.log(JSON.stringify({ raw: raw.length, melody: rows.length, notes: rows }, null, 2));
  console.log("degrees", rows.map((r) => r.j).join(" "));
}
