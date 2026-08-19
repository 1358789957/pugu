import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assignDisplayGrid } from "../src/lib/melody/display-grid.ts";
import { degreeFill } from "../src/lib/melody/degree-colors.ts";
import { cMajorDegrees } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_OPENING_C,
  HIRUMAWARI_PHRASE2_C,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE3_EAR_C,
  HIRUMAWARI_PHRASE3_HYPOTHESIS,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
} from "../src/lib/melody/hirumawari-opening.ts";
import { listenToScore } from "../src/lib/melody/listen-score.ts";
import { notesToTicks } from "../src/lib/melody/midi.ts";
import { fillUncertainPitches, markListenPitches } from "../src/lib/melody/pitch-fill.ts";
import { countPhraseOnsets, onsetsFromContour } from "../src/lib/melody/phrase-onsets.ts";
import { readWavMono16 } from "./wav-pcm.mjs";

function contourHold(t0, t1, midi, extra = {}) {
  const frames = [];
  for (let t = t0; t < t1; t += 0.01) {
    frames.push({
      t,
      hz: 440,
      periodSec: 0,
      periodSamples: 0,
      midi,
      conf: extra.conf ?? 0.7,
      rms: extra.rms ?? 0.15,
      voiced: extra.voiced ?? true,
      filled: false,
    });
  }
  return frames;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAL_WAV = join(root, "examples/hirumawari/昼回のメモリー-人声.wav");

function tonePulses({ n, sr = 22050, hz = 440, on = 0.16, gap = 0.1, lead = 0.2, startHz }) {
  const step = on + gap;
  const dur = lead + n * step + 0.25;
  const samples = new Float32Array(Math.floor(dur * sr));
  for (let i = 0; i < n; i++) {
    const f = startHz ? startHz * 2 ** (i / 12) : hz;
    const t0 = lead + i * step;
    const nOn = Math.floor(on * sr);
    const i0 = Math.floor(t0 * sr);
    for (let s = 0; s < nOn && i0 + s < samples.length; s++) {
      const t = s / sr;
      const env = t < 0.008 ? t / 0.008 : t > on - 0.02 ? Math.max(0, (on - t) / 0.02) : 1;
      samples[i0 + s] = Math.sin(2 * Math.PI * f * t) * 0.38 * env;
    }
  }
  return { samples, sampleRate: sr, lead, step };
}

test("countPhraseOnsets returns one onset per isolated-vocal pulse", () => {
  const { samples, sampleRate, lead, step } = tonePulses({ n: 8, hz: 523.25 });
  const got = countPhraseOnsets(samples, sampleRate, { start: lead - 0.05, end: lead + 8 * step });
  assert.equal(got.count, 8, `got ${got.count} onsets at ${got.onsets.map((o) => o.t.toFixed(2)).join(" ")}`);
});

test("same-pitch re-attacks stay separate (1 1 1 1 1 style)", () => {
  const { samples, sampleRate, lead, step } = tonePulses({ n: 5, hz: 523.25, on: 0.14, gap: 0.1 });
  const got = countPhraseOnsets(samples, sampleRate, { start: lead - 0.04, end: lead + 5 * step });
  assert.equal(got.count, 5, `same-pitch count ${got.count}`);
});

test("phrase-local windows: extras in phrase 1 do not shift phrase 2", () => {
  const sr = 22050;
  const a = tonePulses({ n: 5, sr, hz: 392, lead: 0.2 });
  const b = tonePulses({ n: 4, sr, hz: 494, lead: 0.2 });
  const gap = Math.floor(0.8 * sr);
  const samples = new Float32Array(a.samples.length + gap + b.samples.length);
  samples.set(a.samples, 0);
  samples.set(b.samples, a.samples.length + gap);
  const t2 = (a.samples.length + gap) / sr;
  const p1 = countPhraseOnsets(samples, sr, { start: 0.1, end: t2 - 0.2 });
  const p2 = countPhraseOnsets(samples, sr, { start: t2, end: samples.length / sr });
  assert.equal(p1.count, 5, `phrase 1 count ${p1.count}`);
  assert.equal(p2.count, 4, `phrase 2 count ${p2.count} — extras must not migrate`);
  assert.ok(p1.onsets.every((o) => o.t < t2 - 0.15));
  assert.ok(p2.onsets.every((o) => o.t >= t2 - 0.02));
});

test("昼回 dry-vocal phrase windows return N close to 14 and 13", (t) => {
  if (!existsSync(VOCAL_WAV)) {
    t.skip("examples/hirumawari vocal wav is not in this checkout");
    return;
  }
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const first = countPhraseOnsets(samples, sampleRate, {
    start: HIRUMAWARI_PHRASE_START,
    end: HIRUMAWARI_PHRASE_END,
  });
  const second = countPhraseOnsets(samples, sampleRate, {
    start: HIRUMAWARI_PHRASE2_START,
    end: HIRUMAWARI_PHRASE2_END,
  });
  console.log(`第一句 onsets ${first.count} want ${HIRUMAWARI_OPENING_C.length}  (${HIRUMAWARI_OPENING_C.join("")})`);
  console.log(`第二句 onsets ${second.count} want ${HIRUMAWARI_PHRASE2_C.length}  (${HIRUMAWARI_PHRASE2_C.join("")})`);
  assert.ok(
    Math.abs(first.count - HIRUMAWARI_OPENING_C.length) <= 1,
    `第一句 onset count ${first.count} not close to ${HIRUMAWARI_OPENING_C.length}`,
  );
  assert.ok(
    Math.abs(second.count - HIRUMAWARI_PHRASE2_C.length) <= 1,
    `第二句 onset count ${second.count} not close to ${HIRUMAWARI_PHRASE2_C.length}`,
  );
});

test("display grid may snap; rawStart stays the actual onset", () => {
  const notes = [
    { id: "a", midi: 67, start: 1.103, duration: 0.337, velocity: 0.7, confidence: 0.9 },
    { id: "b", midi: 69, start: 1.441, duration: 0.198, velocity: 0.6, confidence: 0.88 },
    { id: "c", midi: 71, start: 1.72, duration: 0.412, velocity: 0.8, confidence: 0.91 },
  ];
  const { notes: grid } = assignDisplayGrid(notes, 117);
  assert.equal(grid.length, 3);
  assert.equal(grid[0].rawStart, 1.103);
  assert.equal(grid[1].rawStart, 1.441);
  assert.notEqual(grid[0].start, grid[0].rawStart);
});

test("MIDI ticks stay on raw onsets after display grid", () => {
  const { samples, sampleRate, lead, step } = tonePulses({ n: 6, hz: 440, on: 0.17, gap: 0.11 });
  const scored = listenToScore({
    samples,
    sampleRate,
    phrases: [{ start: lead - 0.04, end: lead + 6 * step }],
    bpm: 100,
  });
  assert.ok(scored.notes.length >= 5);
  assert.ok(scored.notes.every((n) => Number.isFinite(n.rawStart)));
  const ticks = notesToTicks(scored.notes, scored.bpm);
  assert.equal(ticks.length, scored.notes.length);
  const onSixteenth = ticks.filter((n) => n.tick % 240 === 0).length;
  assert.ok(onSixteenth <= 2, `export must not hard-snap to 16ths, got ${onSixteenth}/${ticks.length}`);
});

test("B3/B4 octave flicker is one onset, not chopped ghosts", () => {
  const frames = [];
  for (let t = 0.2; t < 0.4; t += 0.01) {
    frames.push(...contourHold(t, t + 0.01, t % 0.02 < 0.01 ? 71 : 59));
  }
  const got = onsetsFromContour(frames, { start: 0.18, end: 0.45 });
  assert.equal(got.count, 1, `flicker count ${got.count}`);
  assert.equal(got.onsets[0].midiHint, 71, `prefer in-band B4, got ${got.onsets[0].midiHint}`);
});

test("a loud short pulse in a real gap is counted", () => {
  const frames = [
    ...contourHold(0.2, 0.34, 67),
    ...contourHold(0.34, 0.37, 0, { voiced: false, rms: 0.04, conf: 0 }),
    ...contourHold(0.37, 0.42, 69, { rms: 0.18 }),
    ...contourHold(0.42, 0.62, 0, { voiced: false, rms: 0.03, conf: 0 }),
    ...contourHold(0.62, 0.78, 69),
  ];
  const got = onsetsFromContour(frames, { start: 0.18, end: 0.82 });
  assert.equal(got.count, 3, `gap-pulse count ${got.count} at ${got.onsets.map((o) => o.t.toFixed(2)).join(" ")}`);
});

test("pitch fill keeps accidentals — no diatonic whitelist", () => {
  const notes = [
    { id: "a", midi: 64, start: 0, duration: 0.2, velocity: 0.7, confidence: 0.9, rawStart: 0, rawDuration: 0.2 },
    {
      id: "b",
      midi: 60,
      start: 0.22,
      duration: 0.2,
      velocity: 0.4,
      confidence: 0.2,
      rawStart: 0.22,
      rawDuration: 0.2,
    },
    { id: "c", midi: 67, start: 0.44, duration: 0.2, velocity: 0.7, confidence: 0.9, rawStart: 0.44, rawDuration: 0.2 },
  ];
  const frames = [];
  for (let t = 0.22; t < 0.42; t += 0.01) {
    frames.push({ t, hz: 370, periodSec: 1 / 370, periodSamples: 0, midi: 66.2, conf: 0.7, rms: 0.05, voiced: true, filled: false });
  }
  const filled = fillUncertainPitches(notes, frames, [{ start: 0, end: 1, section: "verse" }]);
  assert.equal(filled[1].midi, 66, `F# must survive, got ${filled[1].midi}`);
});

test("markListenPitches flags a hole without rewriting neighbors", () => {
  const notes = [
    { id: "a", midi: 67, start: 0, duration: 0.2, velocity: 0.7, confidence: 0.9, rawStart: 0, rawDuration: 0.2 },
    { id: "b", midi: 60, start: 0.22, duration: 0.2, velocity: 0.4, confidence: 0.2, rawStart: 0.22, rawDuration: 0.2 },
    { id: "c", midi: 66, start: 0.44, duration: 0.15, velocity: 0.7, confidence: 0.79, rawStart: 0.44, rawDuration: 0.15 },
  ];
  const frames = [];
  for (let t = 0.44; t < 0.59; t += 0.01) {
    frames.push({ t, hz: 370, periodSec: 1 / 370, periodSamples: 0, midi: 66.2, conf: 0.71, rms: 0.13, voiced: true, filled: false });
  }
  const marked = markListenPitches(notes, frames);
  assert.equal(marked[1].uncertain, true);
  assert.equal(marked[2].uncertain, false);
  assert.equal(marked[2].midi, 66);
});

test("pitch fill does not rewrite a stable folded accidental or 1", () => {
  const fs = [];
  for (let t = 0.2; t < 0.35; t += 0.01) {
    fs.push({ t, hz: 185, periodSec: 1 / 185, periodSamples: 0, midi: 53.9, conf: 0.71, rms: 0.13, voiced: true, filled: false });
  }
  const kept = fillUncertainPitches(
    [
      { id: "a", midi: 67, start: 0, duration: 0.18, velocity: 0.7, confidence: 0.8, rawStart: 0, rawDuration: 0.18 },
      { id: "b", midi: 66, start: 0.2, duration: 0.15, velocity: 0.7, confidence: 0.79, rawStart: 0.2, rawDuration: 0.15 },
      { id: "c", midi: 67, start: 0.4, duration: 0.18, velocity: 0.7, confidence: 0.8, rawStart: 0.4, rawDuration: 0.18 },
    ],
    fs,
    [{ start: 0, end: 1, section: "verse" }],
  );
  assert.equal(kept[1].midi, 66, `stable F# must stay, got ${kept[1].midi}`);
});

test("C=1 degree colors distinguish 1 from #4", () => {
  assert.notEqual(degreeFill(60), degreeFill(66));
  assert.notEqual(degreeFill(60), degreeFill(61));
});

test("昼回 第三句 listen count is close to 14; stem is not the ear string", (t) => {
  if (!existsSync(VOCAL_WAV)) {
    t.skip("examples/hirumawari vocal wav is not in this checkout");
    return;
  }
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const w = { start: HIRUMAWARI_PHRASE3_HYPOTHESIS.start, end: HIRUMAWARI_PHRASE3_HYPOTHESIS.end };
  const counted = countPhraseOnsets(samples, sampleRate, w);
  const scored = listenToScore({ samples, sampleRate, phrases: [w], bpm: 117 });
  const got = cMajorDegrees(
    scored.notes.map((n) => n.midi),
    HIRUMAWARI_AUDIO_TONIC,
  );
  const ear = HIRUMAWARI_PHRASE3_EAR_C.join("");
  console.log(`第三句 onsets ${counted.count} listen ${scored.notes.length} want ${HIRUMAWARI_PHRASE3_EAR_C.length}`);
  console.log(`第三句 listen ${got.join("")}`);
  console.log(`第三句 ear    ${ear}`);
  assert.ok(
    Math.abs(counted.count - HIRUMAWARI_PHRASE3_EAR_C.length) <= 1,
    `第三句 onset count ${counted.count} not close to 14`,
  );
  assert.ok(
    Math.abs(scored.notes.length - HIRUMAWARI_PHRASE3_EAR_C.length) <= 1,
    `第三句 listen count ${scored.notes.length} not close to 14`,
  );
  const around723 = scored.notes.find((n) => Math.abs((n.rawStart ?? n.start) - 15.23) < 0.08);
  assert.ok(around723, "expected the 15.23 7");
  assert.equal(cMajorDegrees([around723.midi], HIRUMAWARI_AUDIO_TONIC)[0], "7", "do not absorb the 7");
  // Ear remains SoT. Do not lock decode to 12323632712231.
  if (got.join("") !== ear) {
    console.log("stem listen ≠ ear — mix reference stays 神's string, not a unit-test lock");
  }
});
