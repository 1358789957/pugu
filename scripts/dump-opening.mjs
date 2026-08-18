import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASIC_PITCH_OPTS } from "../src/lib/melody/basic-pitch-options.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_OPENING_C,
  HIRUMAWARI_PHRASE2_C,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
} from "../src/lib/melody/hirumawari-opening.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const wav = join(dirname(fileURLToPath(import.meta.url)), "..", "examples/hirumawari/昼回のメモリー-人声.wav");
const { samples, sampleRate } = readWavMono16(wav);

async function dump(t0, t1, f0, f1, want, label) {
  const { raw } = await transcribeWavSamples(sliceSeconds(samples, sampleRate, t0, t1), BASIC_PITCH_OPTS);
  const notes = toPuguNotes(pickMelodyNotes(raw)).map((n) => ({ ...n, start: n.start + t0 }));
  const rows = notes.filter((n) => n.start >= f0 && n.start < f1);
  const inC = cMajorDegrees(
    rows.map((n) => n.midi),
    HIRUMAWARI_AUDIO_TONIC,
  );
  const inG = rows.map((n) => jianpuDegree(n.midi));
  console.log(`\n${label}`);
  console.log("→C  ", inC.join(" "));
  console.log("want", want.join(" "));
  console.log("G   ", inG.join(" "));
}

await dump(0, HIRUMAWARI_PHRASE_END + 0.4, HIRUMAWARI_PHRASE_START - 0.15, HIRUMAWARI_PHRASE_END, HIRUMAWARI_OPENING_C, "第一句");
await dump(
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE2_END + 0.2,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_C,
  "第二句",
);
