import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASIC_PITCH_OPTS } from "../src/lib/melody/basic-pitch-options.ts";
import { pickMelodyNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_OPENING_C,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
} from "../src/lib/melody/hirumawari-opening.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const wav = join(dirname(fileURLToPath(import.meta.url)), "..", "examples/hirumawari/昼回のメモリー-人声.wav");
const { samples, sampleRate } = readWavMono16(wav);
// Same window as the C-major fixture test (from 0, like the app).
const slice = sliceSeconds(samples, sampleRate, 0, HIRUMAWARI_PHRASE_END + 0.4);
const { raw } = await transcribeWavSamples(slice, BASIC_PITCH_OPTS);

function deg(midi) {
  return jianpuDegree(midi);
}

const rows = raw
  .map((n) => ({
    t: +n.startTimeSeconds.toFixed(3),
    d: +n.durationSeconds.toFixed(3),
    midi: Math.round(n.pitchMidi),
    deg: deg(n.pitchMidi),
    amp: +n.amplitude.toFixed(3),
  }))
  .filter((n) => n.t < 8.5)
  .sort((a, b) => a.t - b.t);

console.log("RAW", rows.length);
for (const r of rows) {
  if (r.amp < 0.12) continue;
  console.log(`${r.t.toFixed(3)}  ${String(r.midi).padStart(3)}  ${r.deg.padEnd(3)}  d=${r.d.toFixed(3)}  a=${r.amp}`);
}
const picked = pickMelodyNotes(raw).map((n) => ({
  t: +n.startTimeSeconds.toFixed(3),
  midi: Math.round(n.pitchMidi),
  deg: deg(n.pitchMidi),
  d: +n.durationSeconds.toFixed(3),
})).filter((n) => n.t >= HIRUMAWARI_PHRASE_START - 0.15 && n.t < HIRUMAWARI_PHRASE_END);
const fixed = picked.map((p) => p.deg);
const inC = cMajorDegrees(
  picked.map((p) => p.midi),
  HIRUMAWARI_AUDIO_TONIC,
);
console.log("\nPICKED 固定调", fixed.join(" "));
console.log("PICKED →C   ", inC.join(" "));
console.log("C fixture   ", HIRUMAWARI_OPENING_C.join(" "));
console.log(picked);
