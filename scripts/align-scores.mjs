import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALIGN_SONGS } from "../src/lib/melody/align-scores.ts";
import { renderScoreSamples } from "../src/lib/melody/render-score.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
} from "../src/lib/melody/hirumawari-opening.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { refineMelody } from "../src/lib/melody/refine-melody.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAL_WAV = join(root, "examples/hirumawari/昼回のメモリー-人声.wav");

function degreesOf(notes, fromTonic) {
  return {
    inC: cMajorDegrees(
      notes.map((n) => n.midi),
      fromTonic,
    ),
    inG: notes.map((n) => jianpuDegree(n.midi)),
  };
}

async function transcribeSamples(samples, sampleRate, fromTonic, tShift = 0, f0 = 0, f1 = Infinity) {
  const { raw } = await transcribeWavSamples(samples);
  const refined = refineMelody(pickMelodyNotes(raw), samples, sampleRate, 0);
  const notes = toPuguNotes(refined)
    .map((n) => ({ ...n, start: n.start + tShift }))
    .filter((n) => n.start >= f0 && n.start < f1);
  return degreesOf(notes, fromTonic);
}

async function transcribeHirumawari(which) {
  if (!existsSync(VOCAL_WAV)) return { skip: "examples/hirumawari vocal wav is not in this checkout" };
  if (which === "hirumawari-1") {
    const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
    const t0 = 0;
    const t1 = HIRUMAWARI_PHRASE_END + 0.4;
    const slice = sliceSeconds(samples, sampleRate, t0, t1);
    return transcribeSamples(
      slice,
      sampleRate,
      HIRUMAWARI_AUDIO_TONIC,
      t0,
      HIRUMAWARI_PHRASE_START - 0.15,
      HIRUMAWARI_PHRASE_END,
    );
  }
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const t0 = HIRUMAWARI_PHRASE2_START;
  const t1 = HIRUMAWARI_PHRASE2_END + 0.2;
  const slice = sliceSeconds(samples, sampleRate, t0, t1);
  return transcribeSamples(slice, sampleRate, HIRUMAWARI_AUDIO_TONIC, t0, HIRUMAWARI_PHRASE2_START, HIRUMAWARI_PHRASE2_END);
}

export async function transcribeAlignSong(song) {
  if (song.source === "hirumawari-vocal") return transcribeHirumawari(song.id);
  if (!song.score) throw new Error(`${song.id} has no score to synthesize`);
  const { samples, sampleRate } = renderScoreSamples(song.score, { bpm: song.bpm });
  return transcribeSamples(samples, sampleRate, song.fromTonic);
}

export function compareDegrees(actual, expected) {
  const want = [...expected];
  const got = actual.slice(0, want.length);
  const pass = got.length === want.length && got.every((d, i) => d === want[i]);
  return { got, want, pass };
}

export async function runAlignSet() {
  const rows = [];
  for (const song of ALIGN_SONGS) {
    const transcribed = await transcribeAlignSong(song);
    if (transcribed.skip) {
      rows.push({
        id: song.id,
        song: song.name,
        expected: [...song.degrees].join(" "),
        actual: `(skipped: ${transcribed.skip})`,
        pass: false,
        skip: transcribed.skip,
      });
      continue;
    }
    const { got, want, pass } = compareDegrees(transcribed.inC, song.degrees);
    rows.push({
      id: song.id,
      song: song.name,
      expected: want.join(" "),
      actual: got.join(" "),
      extra: transcribed.inC.slice(want.length).join(" "),
      gAudio: transcribed.inG.join(" "),
      pass,
    });
  }
  return rows;
}

export function formatAlignTable(rows) {
  const lines = [
    "song\texpected\tactual\tresult",
    ...rows.map((r) => `${r.song}\t${r.expected}\t${r.actual}\t${r.skip ? "skip" : r.pass ? "pass" : "fail"}`),
  ];
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await runAlignSet();
  console.log(formatAlignTable(rows));
  for (const r of rows) {
    console.log(`\n${r.song} ${r.skip ? "SKIP" : r.pass ? "PASS" : "FAIL"}`);
    console.log(`  expected ${r.expected}`);
    console.log(`  actual   ${r.actual}`);
    if (r.extra) console.log(`  extra    ${r.extra}`);
  }
  process.exit(rows.every((r) => r.pass || r.skip) && rows.some((r) => r.pass) ? 0 : 1);
}
