import assert from "node:assert/strict";
import test from "node:test";
import { hzToMidi } from "../src/lib/melody/notes.ts";
import {
  continueWavelength,
  mergeContourIntoNotes,
  notesFromFilledContour,
  periodRatio,
} from "../src/lib/melody/pitch-contour.ts";
import { fillMelodyGaps } from "../src/lib/melody/refine-melody.ts";

const SR = 22050;
const D4 = 293.66;
const FS4 = 369.99;
const G4 = 392.0;
const B3 = 246.94;

function frame(t, hz, extra = {}) {
  const voiced = hz > 0 && extra.voiced !== false;
  return {
    t,
    hz: voiced ? hz : 0,
    periodSec: voiced ? 1 / hz : 0,
    periodSamples: voiced ? SR / hz : 0,
    midi: voiced ? hzToMidi(hz) : 0,
    conf: voiced ? (extra.conf ?? 0.8) : 0,
    rms: 0.02,
    voiced,
    filled: false,
    ...extra,
    hz: voiced ? hz : 0,
    midi: voiced ? hzToMidi(hz) : 0,
  };
}

function contourFrom(spec) {
  return spec.map(([t, hz, extra]) => frame(t, hz, extra));
}

test("periodRatio is 1 for same wavelength and ~2 for an octave", () => {
  assert.equal(periodRatio(1 / D4, 1 / D4), 1);
  assert.ok(Math.abs(periodRatio(1 / B3, 1 / (B3 * 2)) - 2) < 0.02);
});

test("continueWavelength interpolates a short dropout of the same period", () => {
  const raw = contourFrom([
    [0.0, D4],
    [0.01, D4],
    [0.02, 0, { voiced: false }],
    [0.03, 0, { voiced: false }],
    [0.04, D4],
    [0.05, D4],
  ]);
  const filled = continueWavelength(raw, SR);
  const hole = filled.filter((f) => f.t >= 0.02 && f.t <= 0.03);
  assert.ok(hole.every((f) => f.filled && f.hz > 0));
  assert.ok(hole.every((f) => Math.abs(f.periodSec - 1 / D4) / (1 / D4) < 0.05));
  assert.ok(hole.every((f) => Math.round(f.midi) === 62));
});

test("continueWavelength leaves a long rest as a break", () => {
  const raw = [];
  for (let t = 0; t <= 0.6; t += 0.01) {
    const hz = t < 0.08 || t > 0.5 ? D4 : 0;
    raw.push(frame(t, hz, { voiced: hz > 0 }));
  }
  const filled = continueWavelength(raw, SR);
  const mid = filled.filter((f) => f.t > 0.22 && f.t < 0.38);
  assert.ok(mid.every((f) => !f.filled && !f.voiced && f.hz === 0));
});

test("continueWavelength does not interpolate F#4 onto B3 (different wavelength)", () => {
  const raw = contourFrom([
    [0.0, FS4],
    [0.01, FS4],
    [0.02, 0, { voiced: false }],
    [0.03, 0, { voiced: false }],
    [0.04, B3],
    [0.05, B3],
  ]);
  const filled = continueWavelength(raw, SR);
  const hole = filled.filter((f) => f.t >= 0.02 && f.t <= 0.03);
  assert.ok(
    hole.every((f) => f.hz === 0 || Math.round(f.midi) === 66),
    "unvoiced frames may hold F#4, never blend toward B3",
  );
  assert.ok(hole.every((f) => Math.round(f.midi) !== 59 && Math.round(f.midi) !== 71));
  assert.ok(filled.filter((f) => f.voiced && Math.round(f.midi) === 59).length >= 2);
  assert.equal(
    filled.filter((f) => Math.round(f.midi) === 71).length,
    0,
    "must not octave-boost B3 to 71",
  );
});

test("continueWavelength grows a short D4 island into nearby unvoiced frames", () => {
  const raw = [];
  for (let t = 0; t <= 0.2; t += 0.01) {
    const hz = t >= 0.09 && t <= 0.11 ? D4 : 0;
    raw.push(frame(t, hz, { voiced: hz > 0, conf: 0.64 }));
  }
  const filled = continueWavelength(raw, SR);
  const grown = filled.filter((f) => f.hz > 0);
  assert.ok(grown.length >= 5);
  assert.ok(grown.every((f) => Math.round(f.midi) === 62));
  assert.ok(grown.some((f) => f.filled));
});

test("notesFromFilledContour segments stable degree runs from period", () => {
  const raw = [];
  for (let t = 0; t <= 0.12; t += 0.01) raw.push(frame(t, t < 0.06 ? FS4 : G4));
  const notes = notesFromFilledContour(raw);
  assert.deepEqual(
    notes.map((n) => n.pitchMidi),
    [66, 67],
  );
});

test("mergeContourIntoNotes inserts D4 from the island, not B3 or 60+pc", () => {
  const notes = [
    { startTimeSeconds: 0.0, durationSeconds: 0.2, pitchMidi: 66, amplitude: 0.6 },
    { startTimeSeconds: 1.2, durationSeconds: 0.2, pitchMidi: 67, amplitude: 0.6 },
  ];
  const raw = [];
  for (let t = 0; t <= 1.4; t += 0.01) {
    let hz = 0;
    if (t < 0.18) hz = FS4;
    else if (t >= 0.54 && t <= 0.57) hz = D4;
    else if (t >= 0.62 && t <= 0.95) hz = B3;
    else if (t >= 1.18) hz = G4;
    raw.push(frame(t, hz, { voiced: hz > 0, conf: hz === D4 ? 0.63 : 0.85 }));
  }
  const filled = continueWavelength(raw, SR);
  const merged = mergeContourIntoNotes(notes, filled);
  const midis = merged.map((n) => n.pitchMidi);
  assert.ok(midis.includes(62), `expected D4 (62) from wavelength island, got ${midis.join(" ")}`);
  assert.ok(!midis.includes(59), "B3 must not become a melody note");
  assert.ok(!midis.includes(71), "must not 60+pc octave-boost B3 into 71");
});

test("mergeContourIntoNotes does not put a passing tone into a rest", () => {
  const notes = [
    { startTimeSeconds: 0.0, durationSeconds: 0.2, pitchMidi: 67, amplitude: 0.6 },
    { startTimeSeconds: 1.4, durationSeconds: 0.2, pitchMidi: 71, amplitude: 0.6 },
  ];
  const raw = [];
  for (let t = 0; t <= 1.6; t += 0.01) {
    let hz = 0;
    if (t < 0.18) hz = G4;
    else if (t >= 0.7 && t <= 0.92) hz = 440;
    else if (t >= 1.38) hz = 493.88;
    raw.push(frame(t, hz, { voiced: hz > 0 }));
  }
  const merged = mergeContourIntoNotes(notes, continueWavelength(raw, SR));
  assert.deepEqual(
    merged.map((n) => n.pitchMidi),
    [67, 71],
  );
});

test("mergeContourIntoNotes skips a pitch-class glide hugging the next note", () => {
  const notes = [
    { startTimeSeconds: 0.0, durationSeconds: 0.2, pitchMidi: 66, amplitude: 0.6 },
    { startTimeSeconds: 1.2, durationSeconds: 0.2, pitchMidi: 67, amplitude: 0.6 },
  ];
  const raw = [];
  for (let t = 0; t <= 1.4; t += 0.01) {
    let hz = 0;
    if (t < 0.18) hz = FS4;
    else if (t >= 1.12 && t < 1.18) hz = 261.63;
    else if (t >= 1.18) hz = G4;
    raw.push(frame(t, hz, { voiced: hz > 0 }));
  }
  const merged = mergeContourIntoNotes(notes, continueWavelength(raw, SR));
  assert.deepEqual(
    merged.map((n) => n.pitchMidi),
    [66, 67],
  );
});

test("fillMelodyGaps is a no-op (no discrete MIDI vote)", () => {
  const notes = [
    { startTimeSeconds: 0.0, durationSeconds: 0.2, pitchMidi: 66, amplitude: 0.6 },
    { startTimeSeconds: 1.2, durationSeconds: 0.2, pitchMidi: 67, amplitude: 0.6 },
  ];
  const out = fillMelodyGaps(notes, new Float32Array(22050), 22050, 0);
  assert.deepEqual(
    out.map((n) => n.pitchMidi),
    [66, 67],
  );
});
