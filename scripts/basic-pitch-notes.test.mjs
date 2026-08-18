import assert from "node:assert/strict";
import test from "node:test";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
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
