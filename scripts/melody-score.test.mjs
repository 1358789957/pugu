import assert from "node:assert/strict";
import test from "node:test";
import { TWINKLE, DEMO_BPM } from "../src/lib/melody/demo.ts";
import { midiToJianpu, buildLeadSheet, keyJianpuLabel } from "../src/lib/melody/leadsheet.ts";
import { asciiTrackName, notesToMidi, notesToTicks } from "../src/lib/melody/midi.ts";
import { notateScore } from "../src/lib/melody/notation.ts";
import {
  makeNoteId,
  quantizeToGrid,
  resetNoteIds,
  spellNote,
  timeToTick,
} from "../src/lib/melody/notes.ts";
import { snapChordsToGrid } from "../src/lib/melody/chords.ts";

function scoreToNotes(score, bpm, lead = 0.35, shrink = 0.92) {
  resetNoteIds();
  const beat = 60 / bpm;
  let t = lead;
  const notes = [];
  for (const n of score) {
    notes.push({
      id: makeNoteId(),
      midi: n.midi,
      start: t,
      duration: n.beats * beat * shrink,
      velocity: 0.7,
      confidence: 0.88,
    });
    t += n.beats * beat;
  }
  return notes;
}

function jitter(notes, amounts) {
  return notes.map((n, i) => ({
    ...n,
    start: n.start + (amounts[i % amounts.length] ?? 0),
    duration: n.duration * (0.9 + (i % 3) * 0.04),
  }));
}

test("quantize snaps jittered 小星星 onto quarter and half notes", () => {
  const raw = jitter(scoreToNotes(TWINKLE, DEMO_BPM), [0.03, -0.02, 0.018, -0.025, 0.01]);
  const { notes, gridOffset } = quantizeToGrid(raw, DEMO_BPM);
  assert.equal(notes.length, TWINKLE.length);
  const beat = 60 / DEMO_BPM;
  const starts = notes.map((n) => timeToTick(n.start, DEMO_BPM, gridOffset));
  for (let i = 1; i < starts.length; i++) {
    assert.ok(starts[i] >= starts[i - 1], "notes stay in order");
  }
  TWINKLE.forEach((src, i) => {
    const got = notes[i];
    assert.equal(got.midi, src.midi);
    const units = Math.round(got.duration / (beat / 4));
    assert.equal(units, src.beats * 4, `note ${i} duration`);
    assert.equal(((starts[i] % 4) + 4) % 4, 0, `note ${i} lands on a beat`);
  });
  assert.equal(((starts[0] % 16) + 16) % 16, 0, "first note is a downbeat");
});

test("notation writes 小星星 as quarters, halves, bars, no leftover blobs", () => {
  const { notes, gridOffset } = quantizeToGrid(scoreToNotes(TWINKLE, DEMO_BPM), DEMO_BPM);
  const measures = notateScore(notes, DEMO_BPM, gridOffset, { tonic: 0, mode: "major" });
  assert.equal(measures.length, 12);
  const first = measures[0].events.filter((e) => e.kind === "note");
  assert.equal(first.length, 4);
  assert.deepEqual(
    first.map((e) => e.units),
    [4, 4, 4, 4],
  );
  const second = measures[1].events.filter((e) => e.kind === "note");
  assert.deepEqual(
    second.map((e) => e.units),
    [4, 4, 8],
  );
  assert.ok(measures.every((m) => m.events.some((e) => e.kind === "note")));
});

test("notation fills a missing beat with a rest", () => {
  resetNoteIds();
  const beat = 0.5;
  const notes = [
    { id: makeNoteId(), midi: 60, start: 0, duration: beat, velocity: 0.6, confidence: 0.9 },
    { id: makeNoteId(), midi: 64, start: beat * 2, duration: beat, velocity: 0.6, confidence: 0.9 },
  ];
  const { notes: q, gridOffset } = quantizeToGrid(notes, 120);
  const [measure] = notateScore(q, 120, gridOffset, { tonic: 0, mode: "major" });
  const rests = measure.events.filter((e) => e.kind === "rest");
  assert.ok(rests.some((r) => r.units === 4));
});

test("spelling follows the key signature", () => {
  const fsG = spellNote(66, 7, "major");
  assert.equal(fsG.letter, 3);
  assert.equal(fsG.printed, null);
  const fNatG = spellNote(65, 7, "major");
  assert.equal(fNatG.printed, "♮");
  const bbF = spellNote(70, 5, "major");
  assert.equal(bbF.letter, 6);
  assert.equal(bbF.printed, null);
  const fsC = spellNote(66, 0, "major");
  assert.equal(fsC.printed, "♯");
});

test("jianpu is 1=C 固定调: C=1, G=5, never 1=G", () => {
  assert.equal(midiToJianpu(60, 7, 60, false), "1");
  assert.equal(midiToJianpu(62, 7, 60, false), "2");
  assert.equal(midiToJianpu(64, 7, 60, false), "3");
  assert.equal(midiToJianpu(65, 7, 60, false), "4");
  assert.equal(midiToJianpu(67, 7, 60, false), "5");
  assert.equal(midiToJianpu(69, 7, 60, false), "6");
  assert.equal(midiToJianpu(71, 7, 60, false), "7");
  assert.equal(midiToJianpu(72, 7, 60, false), "1'");
  assert.equal(keyJianpuLabel(7, false), "1=C 固定调");
  assert.notEqual(midiToJianpu(67, 7, 60, false), "1");
});

test("lead sheet is four bars per line with barlines", () => {
  const { notes, gridOffset } = quantizeToGrid(scoreToNotes(TWINKLE, DEMO_BPM), DEMO_BPM);
  const result = {
    notes,
    chords: [
      { symbol: "C", root: 0, quality: "maj", start: notes[0].start, duration: 2, confidence: 1, roman: "I" },
    ],
    key: { tonic: 0, mode: "major", name: "C 大调", confidence: 1 },
    bpm: DEMO_BPM,
    duration: 20,
    sampleRate: 16000,
    waveform: new Float32Array(0),
    pitchTrack: [],
    gridOffset,
  };
  const lines = buildLeadSheet(result, [
    { start: notes[0].start, end: notes[6].start + notes[6].duration, text: "一 闪 一 闪 亮 晶 晶" },
  ]);
  assert.ok(lines.length >= 3);
  assert.equal(lines[0].cells.filter((c) => c.bar).length, 4);
  assert.ok(lines[0].cells.some((c) => c.lyric === "一"));
  assert.ok(lines[0].cells.some((c) => c.jianpu === "1"));
});

test("MIDI keeps every analysis note at 1-tick resolution, not a 16th grid", () => {
  const bpm = 117;
  const raw = [
    { id: "a", midi: 67, start: 1.103, duration: 0.337, velocity: 0.7, confidence: 0.9 },
    { id: "b", midi: 69, start: 1.441, duration: 0.198, velocity: 0.6, confidence: 0.88 },
    { id: "c", midi: 71, start: 1.72, duration: 0.412, velocity: 0.8, confidence: 0.91 },
    { id: "d", midi: 71, start: 2.201, duration: 0.255, velocity: 0.7, confidence: 0.86 },
    { id: "e", midi: 69, start: 2.54, duration: 0.61, velocity: 0.65, confidence: 0.84 },
  ];
  const { notes } = quantizeToGrid(raw, bpm);
  assert.equal(notes.length, raw.length);
  assert.ok(notes.every((n) => Number.isFinite(n.rawStart)));
  const ticks = notesToTicks(notes, bpm);
  assert.equal(ticks.length, raw.length);
  assert.equal(ticks[0].tick, 0);
  assert.deepEqual(
    ticks.map((t) => t.midi),
    raw.map((n) => n.midi),
  );
  const onSixteenth = ticks.filter((n) => n.tick % 240 === 0).length;
  assert.ok(onSixteenth <= 1, `onsets should not sit on 16ths, got ${onSixteenth}/${ticks.length}`);
  for (const n of ticks) assert.ok(n.durationTicks >= 1);

  const bytes = notesToMidi(notes, { bpm, title: "昼回のメモリー", key: { tonic: 7, mode: "major" } });
  assert.equal(bytes[8], 0);
  assert.equal(bytes[9], 1);
  assert.equal((bytes[12] << 8) | bytes[13], 960);
  const text = Buffer.from(bytes).toString("latin1");
  assert.match(text, /Melody/);
  assert.doesNotMatch(text, /昼回/);
  const noteOns = [];
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x90 && bytes[i + 2] > 0) noteOns.push(bytes[i + 1]);
  }
  assert.equal(noteOns.length, raw.length);
});

test("ASCII track names strip non-English glyphs", () => {
  assert.equal(asciiTrackName("昼回のメモリー"), "Melody");
  assert.equal(asciiTrackName("hirumawari2"), "hirumawari2");
});

test("chords snap to two-beat cells and merge neighbors", () => {
  const bpm = 120;
  const beat = 0.5;
  const chords = [
    { symbol: "C", root: 0, quality: "maj", start: 0.03, duration: beat * 2, confidence: 0.8, roman: "I" },
    { symbol: "C", root: 0, quality: "maj", start: beat * 2, duration: beat * 2, confidence: 0.8, roman: "I" },
    { symbol: "G", root: 7, quality: "maj", start: beat * 4 + 0.04, duration: beat * 2, confidence: 0.7, roman: "V" },
  ];
  const out = snapChordsToGrid(chords, bpm, 0);
  assert.equal(out.length, 2);
  assert.equal(out[0].symbol, "C");
  assert.ok(out[0].duration >= beat * 3.9);
  assert.equal(out[1].symbol, "G");
});
