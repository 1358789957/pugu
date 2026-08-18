import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_OPENING_C,
  HIRUMAWARI_OPENING_G8,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
} from "../src/lib/melody/hirumawari-opening.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAL_WAV = join(root, "examples/hirumawari/昼回のメモリー-人声.wav");

test("固定调: C major 14 and G major 8 are the same line, not interchangeable", () => {
  // Locked: C-major check is 12323432712271 only. 56767176 is G-audio 固定调.
  const cMidi = [60, 62, 64, 62, 64, 65, 64, 62, 59, 60, 62, 62, 59, 60];
  assert.deepEqual(cMajorDegrees(cMidi, 0), [...HIRUMAWARI_OPENING_C]);

  const gMidi8 = [67, 69, 71, 69, 71, 72, 71, 69];
  assert.deepEqual(
    gMidi8.map((m) => jianpuDegree(m)),
    [...HIRUMAWARI_OPENING_G8],
  );
  assert.deepEqual(cMajorDegrees(gMidi8, HIRUMAWARI_AUDIO_TONIC), HIRUMAWARI_OPENING_C.slice(0, 8));

  const gMidi14 = [67, 69, 71, 69, 71, 72, 71, 69, 66, 67, 69, 69, 66, 67];
  assert.deepEqual(cMajorDegrees(gMidi14, 7), [...HIRUMAWARI_OPENING_C]);
  assert.notDeepEqual(
    gMidi14.map((m) => jianpuDegree(m)),
    [...HIRUMAWARI_OPENING_C],
  );
});

test("hirumawari dry-vocal opening, transposed to C, is 12323432712271", async (t) => {
  if (!existsSync(VOCAL_WAV)) {
    t.skip("examples/hirumawari vocal wav is not in this checkout");
    return;
  }
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const slice = sliceSeconds(samples, sampleRate, 0, HIRUMAWARI_PHRASE_END + 0.4);
  const { raw } = await transcribeWavSamples(slice);
  const notes = toPuguNotes(pickMelodyNotes(raw)).filter(
    (n) => n.start >= HIRUMAWARI_PHRASE_START - 0.15 && n.start < HIRUMAWARI_PHRASE_END,
  );
  const inC = cMajorDegrees(
    notes.map((n) => n.midi),
    HIRUMAWARI_AUDIO_TONIC,
  );
  const phrase = inC.slice(0, HIRUMAWARI_OPENING_C.length);
  assert.deepEqual(
    phrase,
    [...HIRUMAWARI_OPENING_C],
    `C-major 固定调 first phrase\n  got  ${phrase.join(" ")}\n  want ${HIRUMAWARI_OPENING_C.join(" ")}\n  G-audio 固定调 ${notes
      .map((n) => jianpuDegree(n.midi))
      .join(" ")}`,
  );
});
