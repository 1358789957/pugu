import assert from "node:assert/strict";
import test from "node:test";
import {
  dropSqueezedGhosts,
  pickMelodyNotes,
  polishMelody,
  polishMelodyTight,
  toPuguNotes,
} from "../src/lib/melody/basic-pitch-notes.ts";
import { detectBpmFromNotes } from "../src/lib/melody/analyze.ts";

function ev(partial) {
  return {
    startTimeSeconds: 0,
    durationSeconds: 0.4,
    pitchMidi: 67,
    amplitude: 0.6,
    ...partial,
  };
}

test("pickMelodyNotes keeps a monophonic vocal line", () => {
  const melody = [
    ev({ startTimeSeconds: 0.2, pitchMidi: 60, amplitude: 0.55 }),
    ev({ startTimeSeconds: 0.8, pitchMidi: 67, amplitude: 0.62 }),
    ev({ startTimeSeconds: 1.4, pitchMidi: 69, amplitude: 0.5 }),
  ];
  const picked = pickMelodyNotes(melody);
  assert.equal(picked.length, 3);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [60, 67, 69],
  );
});

test("pickMelodyNotes ignores a short same-pitch ghost between two notes", () => {
  // 0.14s is a ghost, not a syllable. Must not steal the later onset (0.88).
  const events = [
    ev({ startTimeSeconds: 0.2, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.55 }),
    ev({ startTimeSeconds: 0.72, durationSeconds: 0.14, pitchMidi: 60, amplitude: 0.3 }),
    ev({ startTimeSeconds: 0.88, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.52 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].startTimeSeconds, 0.2);
  assert.ok(picked[0].durationSeconds <= 0.7);
  assert.equal(picked[1].startTimeSeconds, 0.88);
});

test("pickMelodyNotes drops a short same-pitch stutter even with a low note in between", () => {
  const events = [
    ev({ startTimeSeconds: 2.497, durationSeconds: 0.372, pitchMidi: 71, amplitude: 0.74 }),
    ev({ startTimeSeconds: 2.72, durationSeconds: 0.12, pitchMidi: 60, amplitude: 0.3 }),
    ev({ startTimeSeconds: 2.869, durationSeconds: 0.104, pitchMidi: 71, amplitude: 0.79 }),
    ev({ startTimeSeconds: 3.066, durationSeconds: 0.221, pitchMidi: 72, amplitude: 0.68 }),
  ];
  assert.deepEqual(
    pickMelodyNotes(events).map((n) => n.pitchMidi),
    [71, 72],
  );
});

test("pickMelodyNotes drops a short same-pitch stutter before the next degree", () => {
  // From-0 Basic Pitch on hirumawari: extra B (7) before C (1). Keep one 7.
  const events = [
    ev({ startTimeSeconds: 2.497, durationSeconds: 0.372, pitchMidi: 71, amplitude: 0.74 }),
    ev({ startTimeSeconds: 2.869, durationSeconds: 0.104, pitchMidi: 71, amplitude: 0.79 }),
    ev({ startTimeSeconds: 3.066, durationSeconds: 0.221, pitchMidi: 72, amplitude: 0.68 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => [n.startTimeSeconds, n.pitchMidi]),
    [
      [2.497, 71],
      [3.066, 72],
    ],
  );
});

test("dropSqueezedGhosts drops a short interior ornament and keeps a rest island", () => {
  const squeezed = dropSqueezedGhosts([
    ev({ startTimeSeconds: 13.56, durationSeconds: 0.3, pitchMidi: 71 }),
    ev({ startTimeSeconds: 13.9, durationSeconds: 0.08, pitchMidi: 74 }),
    ev({ startTimeSeconds: 13.99, durationSeconds: 0.27, pitchMidi: 64 }),
  ]);
  assert.deepEqual(
    squeezed.map((n) => n.pitchMidi),
    [71, 64],
  );
  const island = dropSqueezedGhosts([
    ev({ startTimeSeconds: 8.75, durationSeconds: 0.13, pitchMidi: 66 }),
    ev({ startTimeSeconds: 9.51, durationSeconds: 0.08, pitchMidi: 62 }),
    ev({ startTimeSeconds: 9.93, durationSeconds: 0.08, pitchMidi: 67 }),
  ]);
  assert.deepEqual(
    island.map((n) => n.pitchMidi),
    [66, 62, 67],
  );
  const run = dropSqueezedGhosts([
    ev({ startTimeSeconds: 7.84, durationSeconds: 0.17, pitchMidi: 66 }),
    ev({ startTimeSeconds: 8.04, durationSeconds: 0.09, pitchMidi: 67 }),
    ev({ startTimeSeconds: 8.13, durationSeconds: 0.14, pitchMidi: 67 }),
  ]);
  assert.deepEqual(
    run.map((n) => n.pitchMidi),
    [66, 67, 67],
  );
});

test("polishMelodyTight does not eat the 第二句 5 1 hole", () => {
  const hole = [
    ev({ startTimeSeconds: 8.75, durationSeconds: 0.13, pitchMidi: 66 }),
    ev({ startTimeSeconds: 9.51, durationSeconds: 0.08, pitchMidi: 62 }),
    ev({ startTimeSeconds: 9.93, durationSeconds: 0.08, pitchMidi: 67 }),
    ev({ startTimeSeconds: 10.02, durationSeconds: 0.14, pitchMidi: 69 }),
  ];
  assert.deepEqual(
    polishMelody(hole).map((n) => n.pitchMidi),
    [66, 62, 67, 69],
  );
  assert.deepEqual(
    polishMelodyTight(hole).map((n) => n.pitchMidi),
    [66, 62, 67, 69],
  );
});

test("pickMelodyNotes keeps a lone short syllable (G-audio 7 before 1)", () => {
  const events = [
    ev({ startTimeSeconds: 2.303, durationSeconds: 0.174, pitchMidi: 69, amplitude: 0.59 }),
    ev({ startTimeSeconds: 2.907, durationSeconds: 0.081, pitchMidi: 71, amplitude: 0.74 }),
    ev({ startTimeSeconds: 2.988, durationSeconds: 0.28, pitchMidi: 72, amplitude: 0.74 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [69, 71, 72],
  );
});

test("pickMelodyNotes keeps a run of short same-pitch syllables from collapsing to one onset", () => {
  const events = [
    ev({ startTimeSeconds: 8.028, durationSeconds: 0.12, pitchMidi: 67, amplitude: 0.63 }),
    ev({ startTimeSeconds: 8.16, durationSeconds: 0.12, pitchMidi: 67, amplitude: 0.73 }),
    ev({ startTimeSeconds: 8.29, durationSeconds: 0.12, pitchMidi: 67, amplitude: 0.62 }),
    ev({ startTimeSeconds: 8.42, durationSeconds: 0.12, pitchMidi: 67, amplitude: 0.6 }),
    ev({ startTimeSeconds: 8.7, durationSeconds: 0.18, pitchMidi: 66, amplitude: 0.55 }),
  ];
  const picked = pickMelodyNotes(events);
  const run = picked.filter((n) => n.pitchMidi === 67);
  assert.ok(run.length >= 4, `expected a 4+ syllable run, got ${run.length}`);
});

test("pickMelodyNotes merges a chopped hold that is not followed by a rest", () => {
  const events = [
    ev({ startTimeSeconds: 4.368, durationSeconds: 0.139, pitchMidi: 67, amplitude: 0.81 }),
    ev({ startTimeSeconds: 4.507, durationSeconds: 0.116, pitchMidi: 67, amplitude: 0.83 }),
    ev({ startTimeSeconds: 4.623, durationSeconds: 0.116, pitchMidi: 67, amplitude: 0.79 }),
    ev({ startTimeSeconds: 4.739, durationSeconds: 0.151, pitchMidi: 67, amplitude: 0.62 }),
    ev({ startTimeSeconds: 4.879, durationSeconds: 0.2, pitchMidi: 69, amplitude: 0.58 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [67, 69],
  );
});

test("pickMelodyNotes drops flourish re-hits of the run pitch and the next degree", () => {
  const events = [
    ev({ startTimeSeconds: 8.04, durationSeconds: 0.1, pitchMidi: 67, amplitude: 0.7 }),
    ev({ startTimeSeconds: 8.16, durationSeconds: 0.1, pitchMidi: 67, amplitude: 0.7 }),
    ev({ startTimeSeconds: 8.28, durationSeconds: 0.1, pitchMidi: 67, amplitude: 0.7 }),
    ev({ startTimeSeconds: 8.4, durationSeconds: 0.1, pitchMidi: 67, amplitude: 0.7 }),
    ev({ startTimeSeconds: 8.74, durationSeconds: 0.16, pitchMidi: 66, amplitude: 0.6 }),
    ev({ startTimeSeconds: 8.9, durationSeconds: 0.14, pitchMidi: 67, amplitude: 0.75 }),
    ev({ startTimeSeconds: 9.26, durationSeconds: 0.2, pitchMidi: 66, amplitude: 0.55 }),
    ev({ startTimeSeconds: 9.54, durationSeconds: 0.12, pitchMidi: 62, amplitude: 0.45 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [67, 67, 67, 67, 66, 62],
  );
});

test("pickMelodyNotes drops a late same-pitch trail before a third cadence", () => {
  const events = [
    ev({ startTimeSeconds: 9.93, durationSeconds: 0.1, pitchMidi: 67, amplitude: 0.5 }),
    ev({ startTimeSeconds: 10.02, durationSeconds: 0.14, pitchMidi: 69, amplitude: 0.7 }),
    ev({ startTimeSeconds: 10.24, durationSeconds: 0.17, pitchMidi: 67, amplitude: 0.63 }),
    ev({ startTimeSeconds: 10.42, durationSeconds: 0.53, pitchMidi: 69, amplitude: 0.69 }),
    ev({ startTimeSeconds: 10.95, durationSeconds: 0.34, pitchMidi: 67, amplitude: 0.8 }),
    ev({ startTimeSeconds: 11.29, durationSeconds: 0.19, pitchMidi: 67, amplitude: 0.6 }),
    ev({ startTimeSeconds: 11.64, durationSeconds: 0.28, pitchMidi: 71, amplitude: 0.57 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [67, 69, 67, 71],
  );
});

test("pickMelodyNotes keeps X Y Y when the second Y is long", () => {
  const events = [
    ev({ startTimeSeconds: 7.85, durationSeconds: 0.55, pitchMidi: 64, amplitude: 0.8 }),
    ev({ startTimeSeconds: 8.48, durationSeconds: 0.46, pitchMidi: 62, amplitude: 0.81 }),
    ev({ startTimeSeconds: 9.1, durationSeconds: 0.57, pitchMidi: 62, amplitude: 0.87 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [64, 62, 62],
  );
});

test("pickMelodyNotes keeps a lower neighbor between same-pitch quarters", () => {
  const events = [
    ev({ startTimeSeconds: 0.4, durationSeconds: 0.4, pitchMidi: 64 }),
    ev({ startTimeSeconds: 0.9, durationSeconds: 0.4, pitchMidi: 64 }),
    ev({ startTimeSeconds: 1.4, durationSeconds: 0.36, pitchMidi: 60 }),
    ev({ startTimeSeconds: 1.9, durationSeconds: 0.4, pitchMidi: 64 }),
    ev({ startTimeSeconds: 2.4, durationSeconds: 0.4, pitchMidi: 64 }),
    ev({ startTimeSeconds: 2.9, durationSeconds: 0.4, pitchMidi: 60 }),
    ev({ startTimeSeconds: 3.4, durationSeconds: 0.4, pitchMidi: 62 }),
  ];
  assert.deepEqual(
    pickMelodyNotes(events).map((n) => n.pitchMidi),
    [64, 64, 60, 64, 64, 60, 62],
  );
});

test("pickMelodyNotes does not merge same-pitch re-attacks when a rest follows the run", () => {
  const events = [];
  for (let i = 0; i < 5; i++) {
    events.push(ev({ startTimeSeconds: 0.4 + i * 0.35, durationSeconds: 0.32, pitchMidi: 65 }));
  }
  events.push(ev({ startTimeSeconds: 2.28, durationSeconds: 0.4, pitchMidi: 64 }));
  const run = pickMelodyNotes(events).filter((n) => n.pitchMidi === 65);
  assert.equal(run.length, 5);
});

test("pickMelodyNotes drops a sequential octave double under the melody", () => {
  const events = [
    ev({ startTimeSeconds: 1.0, durationSeconds: 0.4, pitchMidi: 71 }),
    ev({ startTimeSeconds: 1.18, durationSeconds: 0.3, pitchMidi: 59 }),
    ev({ startTimeSeconds: 1.5, durationSeconds: 0.4, pitchMidi: 72 }),
  ];
  assert.deepEqual(
    pickMelodyNotes(events).map((n) => n.pitchMidi),
    [71, 72],
  );
});

test("pickMelodyNotes keeps sequential low 1s after a high 2 and a 2-ghost", () => {
  const events = [
    ev({ startTimeSeconds: 1.87, durationSeconds: 0.35, pitchMidi: 73 }),
    ev({ startTimeSeconds: 2.23, durationSeconds: 0.08, pitchMidi: 73 }),
    ev({ startTimeSeconds: 2.39, durationSeconds: 0.34, pitchMidi: 59 }),
    ev({ startTimeSeconds: 2.9, durationSeconds: 0.34, pitchMidi: 59 }),
    ev({ startTimeSeconds: 3.39, durationSeconds: 0.35, pitchMidi: 73 }),
  ];
  assert.deepEqual(
    pickMelodyNotes(events).map((n) => n.pitchMidi),
    [73, 59, 59, 73],
  );
});

test("pickMelodyNotes keeps 0.5s same-pitch quarters and merges a chopped hold", () => {
  const quarters = [];
  for (let i = 0; i < 5; i++) {
    quarters.push(ev({ startTimeSeconds: 0.35 + i * 0.5, durationSeconds: 0.4, pitchMidi: 72, amplitude: 0.6 }));
  }
  assert.equal(pickMelodyNotes(quarters).length, 5);

  const chopped = [
    ev({ startTimeSeconds: 0.35, durationSeconds: 0.32, pitchMidi: 72, amplitude: 0.6 }),
    ev({ startTimeSeconds: 0.69, durationSeconds: 0.16, pitchMidi: 72, amplitude: 0.45 }),
    ev({ startTimeSeconds: 0.85, durationSeconds: 0.4, pitchMidi: 74, amplitude: 0.58 }),
  ];
  assert.deepEqual(
    pickMelodyNotes(chopped).map((n) => n.pitchMidi),
    [72, 74],
  );
});

test("pickMelodyNotes keeps lyric X Y X when all three are quarter-length", () => {
  const events = [
    ev({ startTimeSeconds: 0.35, durationSeconds: 0.52, pitchMidi: 70, amplitude: 0.6 }),
    ev({ startTimeSeconds: 0.85, durationSeconds: 0.48, pitchMidi: 69, amplitude: 0.6 }),
    ev({ startTimeSeconds: 1.35, durationSeconds: 0.52, pitchMidi: 70, amplitude: 0.6 }),
    ev({ startTimeSeconds: 1.85, durationSeconds: 0.5, pitchMidi: 70, amplitude: 0.6 }),
    ev({ startTimeSeconds: 2.35, durationSeconds: 0.48, pitchMidi: 69, amplitude: 0.6 }),
    ev({ startTimeSeconds: 2.85, durationSeconds: 0.52, pitchMidi: 70, amplitude: 0.6 }),
  ];
  assert.deepEqual(
    pickMelodyNotes(events).map((n) => n.pitchMidi),
    [70, 69, 70, 70, 69, 70],
  );
});

test("pickMelodyNotes drops a short passing tone and a long neighbor-tone return", () => {
  const events = [
    ev({ startTimeSeconds: 0.0, durationSeconds: 0.2, pitchMidi: 69, amplitude: 0.6 }),
    ev({ startTimeSeconds: 0.25, durationSeconds: 0.15, pitchMidi: 67, amplitude: 0.55 }),
    ev({ startTimeSeconds: 0.5, durationSeconds: 0.5, pitchMidi: 69, amplitude: 0.7 }),
    ev({ startTimeSeconds: 1.1, durationSeconds: 0.25, pitchMidi: 67, amplitude: 0.7 }),
    ev({ startTimeSeconds: 1.45, durationSeconds: 0.12, pitchMidi: 69, amplitude: 0.5 }),
    ev({ startTimeSeconds: 1.65, durationSeconds: 0.2, pitchMidi: 71, amplitude: 0.6 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [69, 67, 67, 71],
  );
});

test("pickMelodyNotes keeps the C-major 2 2 pair (two Ds / G-audio two As)", () => {
  // Notes 11–12 of 12323432712271. In G they are two As ~0.52s apart, ~0.19s each.
  const events = [
    ev({ startTimeSeconds: 4.893, durationSeconds: 0.186, pitchMidi: 69, amplitude: 0.45 }),
    ev({ startTimeSeconds: 5.417, durationSeconds: 0.186, pitchMidi: 69, amplitude: 0.42 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].startTimeSeconds, 4.893);
  assert.equal(picked[1].startTimeSeconds, 5.417);
});

test("pickMelodyNotes keeps same-pitch re-attacks", () => {
  const events = [
    ev({ startTimeSeconds: 0.2, durationSeconds: 0.7, pitchMidi: 60, amplitude: 0.55 }),
    ev({ startTimeSeconds: 0.82, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.52 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.equal(picked.length, 2);
  assert.ok(picked[0].durationSeconds <= 0.65);
  assert.equal(picked[1].startTimeSeconds, 0.82);
});

test("pickMelodyNotes drops an overlapping octave double", () => {
  const events = [
    ev({ startTimeSeconds: 1.0, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.45 }),
    ev({ startTimeSeconds: 1.02, durationSeconds: 0.48, pitchMidi: 72, amplitude: 0.4 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [60],
  );
});

test("pickMelodyNotes drops overlapping accompaniment", () => {
  const events = [
    ev({ startTimeSeconds: 1.0, durationSeconds: 0.8, pitchMidi: 72, amplitude: 0.7 }),
    ev({ startTimeSeconds: 1.05, durationSeconds: 0.7, pitchMidi: 48, amplitude: 0.35 }),
    ev({ startTimeSeconds: 1.1, durationSeconds: 0.3, pitchMidi: 36, amplitude: 0.9 }),
    ev({ startTimeSeconds: 2.0, durationSeconds: 0.4, pitchMidi: 74, amplitude: 0.65 }),
  ];
  const picked = pickMelodyNotes(events);
  assert.deepEqual(
    picked.map((n) => n.pitchMidi),
    [72, 74],
  );
});

test("toPuguNotes writes raw times for MIDI and ids for the rest of the app", () => {
  const notes = toPuguNotes([
    ev({ startTimeSeconds: 1.103, durationSeconds: 0.337, pitchMidi: 67.2, amplitude: 0.4 }),
  ]);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].midi, 67);
  assert.equal(notes[0].start, 1.103);
  assert.equal(notes[0].rawStart, 1.103);
  assert.equal(notes[0].rawDuration, 0.337);
  assert.ok(notes[0].id);
  assert.ok(notes[0].confidence >= 0.42);
});

test("detectBpmFromNotes recovers 96 BPM from 小星星-like onsets", () => {
  const beat = 60 / 96;
  const notes = [];
  let t = 0.35;
  for (let i = 0; i < 14; i++) {
    const dur = i % 7 === 6 ? beat * 2 : beat;
    notes.push({
      id: `n${i}`,
      midi: 60,
      start: t,
      duration: dur * 0.9,
      velocity: 0.7,
      confidence: 0.8,
      rawStart: t,
      rawDuration: dur * 0.9,
    });
    t += dur;
  }
  assert.equal(detectBpmFromNotes(notes), 96);
});
