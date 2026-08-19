import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyEarDegrees,
  degreeTokenToMidi,
  parseDegreeTokens,
} from "../src/lib/melody/ear-degrees.ts";
import { cMajorDegrees } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_PHRASE3_EAR_C,
  HIRUMAWARI_PHRASE3_HYPOTHESIS,
} from "../src/lib/melody/hirumawari-opening.ts";
import { listenToScore } from "../src/lib/melody/listen-score.ts";
import { readWavMono16 } from "./wav-pcm.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAL_WAV = join(root, "examples/hirumawari/昼回のメモリー-人声.wav");

test("parseDegreeTokens reads compact ear strings and accidentals", () => {
  assert.deepEqual(parseDegreeTokens("12323632712231"), [...HIRUMAWARI_PHRASE3_EAR_C]);
  assert.deepEqual(parseDegreeTokens("1 2 #4 3"), ["1", "2", "#4", "3"]);
  assert.deepEqual(parseDegreeTokens("５６７"), ["5", "6", "7"]);
});

test("tonic-1 听写 of 6 near B4 becomes E4, not E5", () => {
  assert.equal(degreeTokenToMidi("6", 7, 71, { lo: 67, hi: 71 }), 64);
  assert.equal(degreeTokenToMidi("1", 7, 67), 67);
  assert.equal(degreeTokenToMidi("7", 7, 71), 66);
});

test("applyEarDegrees writes pitches and keeps raw ticks", () => {
  const notes = HIRUMAWARI_PHRASE3_HYPOTHESIS.concertMidi.map((midi, i) => ({
    id: `n${i}`,
    midi: 60,
    start: 12.55 + i * 0.2,
    duration: 0.16,
    velocity: 0.5,
    confidence: 0.5,
    rawStart: 12.55 + i * 0.12,
    rawDuration: 0.11,
    phraseIndex: 0,
    uncertain: true,
  }));
  const raw = notes.map((n) => n.rawStart);
  const out = applyEarDegrees({
    notes,
    phraseIndex: 0,
    text: "12323632712231",
    fromTonic: 7,
  });
  assert.equal(out.applied, 14);
  assert.deepEqual(
    cMajorDegrees(
      out.notes.map((n) => n.midi),
      HIRUMAWARI_AUDIO_TONIC,
    ),
    [...HIRUMAWARI_PHRASE3_EAR_C],
  );
  assert.deepEqual(
    out.notes.map((n) => n.midi),
    [...HIRUMAWARI_PHRASE3_HYPOTHESIS.concertMidi],
  );
  assert.deepEqual(
    out.notes.map((n) => n.rawStart),
    raw,
  );
  assert.ok(out.notes.every((n) => n.pitchLocked && n.uncertain === false));
});

test("a shorter ear string leaves leftover slots", () => {
  const notes = [0, 1, 2, 3].map((i) => ({
    id: `n${i}`,
    midi: 67,
    start: i * 0.2,
    duration: 0.16,
    velocity: 0.5,
    confidence: 0.8,
    rawStart: i * 0.2,
    rawDuration: 0.16,
    phraseIndex: 0,
  }));
  const out = applyEarDegrees({ notes, phraseIndex: 0, text: "12", fromTonic: 7 });
  assert.equal(out.applied, 2);
  assert.equal(out.slots, 4);
  assert.equal(out.notes[2].midi, 67);
  assert.equal(out.notes[0].pitchLocked, true);
});

test("昼回 第三句: count from audio, pitches from 神's string — not the decoder", (t) => {
  if (!existsSync(VOCAL_WAV)) {
    t.skip("examples/hirumawari vocal wav is not in this checkout");
    return;
  }
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const w = { start: HIRUMAWARI_PHRASE3_HYPOTHESIS.start, end: HIRUMAWARI_PHRASE3_HYPOTHESIS.end };
  const scored = listenToScore({ samples, sampleRate, phrases: [w], bpm: 117 });
  assert.ok(Math.abs(scored.notes.length - 14) <= 1);
  const machine = cMajorDegrees(
    scored.notes.map((n) => n.midi),
    HIRUMAWARI_AUDIO_TONIC,
  ).join("");
  const out = applyEarDegrees({
    notes: scored.notes,
    phraseIndex: 0,
    text: HIRUMAWARI_PHRASE3_EAR_C.join(""),
    fromTonic: HIRUMAWARI_AUDIO_TONIC,
    phrase: w,
  });
  assert.equal(out.applied, Math.min(14, scored.notes.length));
  const got = cMajorDegrees(
    out.notes.map((n) => n.midi),
    HIRUMAWARI_AUDIO_TONIC,
  );
  assert.equal(got.join(""), HIRUMAWARI_PHRASE3_EAR_C.slice(0, out.applied).join(""));
  assert.notEqual(machine, HIRUMAWARI_PHRASE3_EAR_C.join(""), "decoder must not already be the ear lock");
  assert.ok(out.notes.every((n, i) => n.rawStart === scored.notes[i].rawStart));
});
