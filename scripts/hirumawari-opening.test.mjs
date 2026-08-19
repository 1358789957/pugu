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
  HIRUMAWARI_PHRASE2_C,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_G,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
  HIRUMAWARI_CHORUS_LYRIC,
  HIRUMAWARI_CHORUS_START_HYPOTHESIS,
  HIRUMAWARI_PHRASE3_EAR_C,
  HIRUMAWARI_PHRASE3_HYPOTHESIS,
  HIRUMAWARI_VERSE_HYPOTHESES,
} from "../src/lib/melody/hirumawari-opening.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { refineMelody } from "../src/lib/melody/refine-melody.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAL_WAV = join(root, "examples/hirumawari/昼回のメモリー-人声.wav");

function phraseInC(notes, start, end) {
  const slice = notes.filter((n) => n.start >= start && n.start < end);
  return {
    notes: slice,
    inC: cMajorDegrees(
      slice.map((n) => n.midi),
      HIRUMAWARI_AUDIO_TONIC,
    ),
    inG: slice.map((n) => jianpuDegree(n.midi)),
  };
}

test("固定调: C-major 第一句 / 第二句 are not G-audio numbering", () => {
  const c1 = [60, 62, 64, 62, 64, 65, 64, 62, 59, 60, 62, 62, 59, 60];
  assert.deepEqual(cMajorDegrees(c1, 0), [...HIRUMAWARI_OPENING_C]);

  const g1_8 = [67, 69, 71, 69, 71, 72, 71, 69];
  assert.deepEqual(
    g1_8.map((m) => jianpuDegree(m)),
    [...HIRUMAWARI_OPENING_G8],
  );
  assert.deepEqual(cMajorDegrees(g1_8, HIRUMAWARI_AUDIO_TONIC), HIRUMAWARI_OPENING_C.slice(0, 8));

  const g1 = [67, 69, 71, 69, 71, 72, 71, 69, 66, 67, 69, 69, 66, 67];
  assert.deepEqual(cMajorDegrees(g1, 7), [...HIRUMAWARI_OPENING_C]);
  assert.notDeepEqual(
    g1.map((m) => jianpuDegree(m)),
    [...HIRUMAWARI_OPENING_C],
  );

  // 第二句: A B C C C C C B G C D C E. G-audio is +7, 固定调 3 #4 5 5 5 5 5… ≠ C string.
  const c2 = [69, 71, 72, 72, 72, 72, 72, 71, 67, 72, 74, 72, 76];
  assert.deepEqual(cMajorDegrees(c2, 0), [...HIRUMAWARI_PHRASE2_C]);
  const g2 = [64, 66, 67, 67, 67, 67, 67, 66, 62, 67, 69, 67, 71];
  assert.deepEqual(cMajorDegrees(g2, 7), [...HIRUMAWARI_PHRASE2_C]);
  assert.deepEqual(
    g2.map((m) => jianpuDegree(m)),
    [...HIRUMAWARI_PHRASE2_G],
  );
  assert.notDeepEqual(
    g2.map((m) => jianpuDegree(m)),
    [...HIRUMAWARI_PHRASE2_C],
  );
});

async function transcribePhrase(t0, t1, f0, f1) {
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const slice = sliceSeconds(samples, sampleRate, t0, t1);
  const { raw } = await transcribeWavSamples(slice);
  const refined = refineMelody(pickMelodyNotes(raw), slice, sampleRate, 0);
  const notes = toPuguNotes(refined).map((n) => ({ ...n, start: n.start + t0 }));
  return phraseInC(notes, f0, f1);
}

test("hirumawari dry-vocal 第一句, transposed to C, is 12323432712271", async (t) => {
  if (!existsSync(VOCAL_WAV)) {
    t.skip("examples/hirumawari vocal wav is not in this checkout");
    return;
  }
  const first = await transcribePhrase(0, HIRUMAWARI_PHRASE_END + 0.4, HIRUMAWARI_PHRASE_START - 0.15, HIRUMAWARI_PHRASE_END);
  const firstC = first.inC.slice(0, HIRUMAWARI_OPENING_C.length);
  console.log(`第一句 got  ${firstC.join(" ")}`);
  console.log(`第一句 want ${HIRUMAWARI_OPENING_C.join(" ")}`);
  assert.deepEqual(
    firstC,
    [...HIRUMAWARI_OPENING_C],
    `C-major 固定调 第一句\n  got  ${firstC.join(" ")}\n  want ${HIRUMAWARI_OPENING_C.join(" ")}\n  G-audio ${first.inG.join(" ")}`,
  );
});

test("hirumawari dry-vocal 第二句, transposed to C, is 6711111751213", async (t) => {
  if (!existsSync(VOCAL_WAV)) {
    t.skip("examples/hirumawari vocal wav is not in this checkout");
    return;
  }
  const second = await transcribePhrase(
    HIRUMAWARI_PHRASE2_START,
    HIRUMAWARI_PHRASE2_END + 0.2,
    HIRUMAWARI_PHRASE2_START,
    HIRUMAWARI_PHRASE2_END,
  );
  const secondC = second.inC.slice(0, HIRUMAWARI_PHRASE2_C.length);
  console.log(`第二句 got  ${secondC.join(" ")}`);
  console.log(`第二句 want ${HIRUMAWARI_PHRASE2_C.join(" ")}`);
  console.log(`第二句 G-audio 固定调 ${second.inG.join(" ")}`);
  assert.deepEqual(
    secondC,
    [...HIRUMAWARI_PHRASE2_C],
    `C-major 固定调 第二句\n  got  ${secondC.join(" ")}\n  want ${HIRUMAWARI_PHRASE2_C.join(" ")}\n  G-audio ${second.inG.join(" ")}`,
  );
});

test("第三句 reference is 神's listen 12323632712231, not isolated-stem YIN", () => {
  assert.equal(HIRUMAWARI_PHRASE3_EAR_C.join(""), "12323632712231");
  assert.equal(HIRUMAWARI_PHRASE3_EAR_C.length, 14);
  assert.deepEqual(
    cMajorDegrees([...HIRUMAWARI_PHRASE3_HYPOTHESIS.concertMidi], HIRUMAWARI_AUDIO_TONIC),
    [...HIRUMAWARI_PHRASE3_EAR_C],
  );
});

test("phrase 3–5 hypotheses sit after 第二句 and before the chorus lyric", () => {
  assert.equal(HIRUMAWARI_CHORUS_LYRIC, "いつかまた同じ雨に");
  assert.equal(HIRUMAWARI_VERSE_HYPOTHESES.length, 3);
  assert.deepEqual(
    HIRUMAWARI_VERSE_HYPOTHESES.map((h) => h.lyricCue),
    ["並んでた言えない", "まま解けてく言葉", "手と手の間触れる距離"],
  );
  let prev = HIRUMAWARI_PHRASE2_END;
  for (const h of HIRUMAWARI_VERSE_HYPOTHESES) {
    assert.ok(h.start >= prev - 0.15, `${h.id} must start after 第二句`);
    assert.ok(h.end <= HIRUMAWARI_CHORUS_START_HYPOTHESIS, `${h.id} must end before chorus`);
    assert.equal(h.cMajorFixed.length, h.concertMidi.length);
    prev = h.start;
  }
  assert.ok(!HIRUMAWARI_VERSE_HYPOTHESES.some((h) => h.lyricCue.includes(HIRUMAWARI_CHORUS_LYRIC)));
});
