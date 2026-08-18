import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASIC_PITCH_OPTS } from "../src/lib/melody/basic-pitch-options.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { refineMelody } from "../src/lib/melody/refine-melody.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_CHORUS_LYRIC,
  HIRUMAWARI_CHORUS_START_HYPOTHESIS,
  HIRUMAWARI_OPENING_C,
  HIRUMAWARI_PHRASE2_C,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
  HIRUMAWARI_VERSE_DECODE_END,
  HIRUMAWARI_VERSE_DECODE_START,
  HIRUMAWARI_VERSE_HYPOTHESES,
} from "../src/lib/melody/hirumawari-opening.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const wav = join(dirname(fileURLToPath(import.meta.url)), "..", "examples/hirumawari/昼回のメモリー-人声.wav");
const { samples, sampleRate } = readWavMono16(wav);

export async function transcribeHirumawariWindow(t0, t1, f0, f1) {
  const slice = sliceSeconds(samples, sampleRate, t0, t1);
  const { raw } = await transcribeWavSamples(slice, BASIC_PITCH_OPTS);
  const refined = refineMelody(pickMelodyNotes(raw), slice, sampleRate, 0);
  const notes = toPuguNotes(refined)
    .map((n) => ({ ...n, start: n.start + t0 }))
    .filter((n) => n.start >= f0 && n.start < f1);
  const midis = notes.map((n) => n.midi);
  return {
    notes,
    midis,
    inC: cMajorDegrees(midis, HIRUMAWARI_AUDIO_TONIC),
    inG: midis.map((m) => jianpuDegree(m)),
  };
}

function printLocked(label, got, want, midis, inG) {
  const same = got.join(" ") === want.join(" ");
  console.log(`\n${label}  LOCK`);
  console.log("→C   ", got.join(" "));
  console.log("want ", want.join(" "));
  console.log("MIDI ", midis.join(" "));
  console.log("G    ", inG.join(" "));
  console.log(same ? "ok    matches lock" : "diff  does not match lock");
}

function printHypothesis(h, got) {
  const t0 = got.notes[0]?.start;
  const last = got.notes[got.notes.length - 1];
  const t1 = last ? last.start + last.duration : undefined;
  console.log(`\n${h.label}  HYPOTHESIS  keep ${h.start.toFixed(2)}–${h.end.toFixed(2)}s`);
  console.log("cue   ", h.lyricCue, "  (lyric file only; not pitch truth)");
  console.log("n     ", got.inC.length, t0 != null && t1 != null ? `  notes ${t0.toFixed(2)}–${t1.toFixed(2)}` : "");
  console.log("→C    ", got.inC.join(" "));
  console.log("snap  ", h.cMajorFixed.join(" "), "  (last snapshot, not a lock)");
  console.log("MIDI  ", got.midis.join(" "));
  console.log("G     ", got.inG.join(" "));
  for (const n of got.notes) {
    const i = got.notes.indexOf(n);
    console.log(`  ${n.start.toFixed(2)} ${n.duration.toFixed(2)}s  ${got.inC[i]}  midi ${n.midi}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const first = await transcribeHirumawariWindow(0, HIRUMAWARI_PHRASE_END + 0.4, HIRUMAWARI_PHRASE_START - 0.15, HIRUMAWARI_PHRASE_END);
  printLocked("第一句 1.45–6.40", first.inC, [...HIRUMAWARI_OPENING_C], first.midis, first.inG);

  const second = await transcribeHirumawariWindow(
    HIRUMAWARI_PHRASE2_START,
    HIRUMAWARI_PHRASE2_END + 0.2,
    HIRUMAWARI_PHRASE2_START,
    HIRUMAWARI_PHRASE2_END,
  );
  printLocked("第二句 7.55–12.00", second.inC, [...HIRUMAWARI_PHRASE2_C], second.midis, second.inG);

  console.log("\n--- after 第二句, before chorus ---");
  console.log(`path   tuner contour + wavelength-continue + BP merge; squeezed ghosts dropped`);
  console.log(`window ${HIRUMAWARI_VERSE_DECODE_START.toFixed(2)}–${HIRUMAWARI_VERSE_DECODE_END.toFixed(2)}  (one decode)`);
  console.log(`chorus ${HIRUMAWARI_CHORUS_LYRIC}  ~${HIRUMAWARI_CHORUS_START_HYPOTHESIS.toFixed(2)}s (hypothesis)`);

  const verse = await transcribeHirumawariWindow(
    HIRUMAWARI_VERSE_DECODE_START,
    HIRUMAWARI_VERSE_DECODE_END,
    HIRUMAWARI_VERSE_DECODE_START,
    HIRUMAWARI_CHORUS_START_HYPOTHESIS,
  );
  for (const h of HIRUMAWARI_VERSE_HYPOTHESES) {
    const notes = verse.notes.filter((n) => n.start >= h.start && n.start < h.end);
    const midis = notes.map((n) => n.midi);
    printHypothesis(h, {
      notes,
      midis,
      inC: cMajorDegrees(midis, HIRUMAWARI_AUDIO_TONIC),
      inG: midis.map((m) => jianpuDegree(m)),
    });
  }
}
