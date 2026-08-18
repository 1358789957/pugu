import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALIGN_SONGS,
  SYNTH_ALIGN_BPM,
  comparedScale,
  expectedDegrees,
  matchFirstPhrase,
  publishedToScore,
  scorePhrase,
  synthTonicMidi,
  clampToMelodyBand,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { renderScoreSamples } from "../src/lib/melody/render-score.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_CHORUS_LYRIC,
  HIRUMAWARI_CHORUS_START_HYPOTHESIS,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
  HIRUMAWARI_VERSE_DECODE_END,
  HIRUMAWARI_VERSE_DECODE_START,
  HIRUMAWARI_VERSE_HYPOTHESES,
} from "../src/lib/melody/hirumawari-opening.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { refineMelody } from "../src/lib/melody/refine-melody.ts";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAL_WAV = join(root, "examples/hirumawari/昼回のメモリー-人声.wav");

function degreesOf(notes, fromTonic) {
  return {
    notes,
    midis: notes.map((n) => n.midi),
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
    const slice = sliceSeconds(samples, sampleRate, 0, HIRUMAWARI_PHRASE_END + 0.4);
    return transcribeSamples(
      slice,
      sampleRate,
      HIRUMAWARI_AUDIO_TONIC,
      0,
      HIRUMAWARI_PHRASE_START - 0.15,
      HIRUMAWARI_PHRASE_END,
    );
  }
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const t0 = HIRUMAWARI_PHRASE2_START;
  const slice = sliceSeconds(samples, sampleRate, t0, HIRUMAWARI_PHRASE2_END + 0.2);
  return transcribeSamples(slice, sampleRate, HIRUMAWARI_AUDIO_TONIC, t0, HIRUMAWARI_PHRASE2_START, HIRUMAWARI_PHRASE2_END);
}

async function transcribeSynth(song) {
  const tonic = synthTonicMidi(song.publishedMovableDo, song.tonicMidi);
  const score = publishedToScore(song.publishedMovableDo, tonic, song.synthBeats).map((n) => ({
    ...n,
    midi: clampToMelodyBand(n.midi),
  }));
  const { samples, sampleRate } = renderScoreSamples(score, {
    bpm: SYNTH_ALIGN_BPM,
    gap: song.synthGap ?? 0.1,
  });
  return transcribeSamples(samples, sampleRate, song.tonicPc);
}

export async function runAlignSet() {
  const rows = [];
  for (const song of ALIGN_SONGS) {
    const want = expectedDegrees(song);
    const transcribed = song.liveAudio ? await transcribeHirumawari(song.id) : await transcribeSynth(song);
    if (transcribed.skip) {
      rows.push({
        id: song.id,
        song: song.title,
        expected: want.join(" "),
        actual: `(skipped: ${transcribed.skip})`,
        midis: [],
        pass: false,
        skip: transcribed.skip,
      });
      continue;
    }
    const got = transcribed.inC.slice(0, want.length);
    const pass = matchFirstPhrase(transcribed.inC, want);
    const score = scorePhrase(transcribed.inC, want);
    rows.push({
      id: song.id,
      song: song.title,
      expected: want.join(" "),
      actual: got.join(" "),
      actualFull: transcribed.inC.join(" "),
      extra: transcribed.inC.slice(want.length).join(" "),
      published: song.publishedMovableDo.join(" "),
      midis: transcribed.midis.slice(0, want.length),
      pass,
      synth: !song.liveAudio,
      compared: comparedScale(song),
      score,
    });
  }
  return rows;
}

export function formatAlignTable(rows) {
  const lines = [
    "song\texpected\tactual\tresult",
    ...rows.map((r) => {
      const result = r.skip ? "skip" : r.pass ? "pass" : "fail";
      return `${r.song}\t${r.expected}\t${r.actual}\t${result}`;
    }),
  ];
  return lines.join("\n");
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function mean(xs) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function summarizeGroup(rows) {
  const run = rows.filter((r) => !r.skip && r.score);
  const exact = run.filter((r) => r.score.exact).length;
  return {
    n: run.length,
    skipped: rows.length - run.length,
    meanAcc: mean(run.map((r) => r.score.accuracy)),
    exactRate: run.length === 0 ? 0 : exact / run.length,
    exact,
  };
}

/** Compact note-level accuracy table. Phrase 3+ hypotheses are not included. */
export function formatAccuracyReport(rows) {
  const graded = rows.filter((r) => !r.skip && r.score);
  const synth = graded.filter((r) => r.synth);
  const live = graded.filter((r) => !r.synth);
  const all = summarizeGroup(graded);
  const synthSum = summarizeGroup(synth);
  const liveSum = summarizeGroup(live);

  const header = "id\ttitle\tcompared\texpected\tactual\tacc\textra\tmiss\texact";
  const body = graded.map((r) => {
    const s = r.score;
    const acc = `${s.prefix}/${s.expectedLen} (${pct(s.accuracy)})`;
    return [r.id, r.song, r.compared, r.expected, r.actualFull ?? r.actual, acc, s.extra, s.missing, s.exact ? "yes" : "no"].join("\t");
  });

  const overall = [
    "",
    "overall\titems\tmean_acc\texact\texact_rate",
    `all\t${all.n}\t${pct(all.meanAcc)}\t${all.exact}/${all.n}\t${pct(all.exactRate)}`,
    `synth_pop\t${synthSum.n}\t${pct(synthSum.meanAcc)}\t${synthSum.exact}/${synthSum.n}\t${pct(synthSum.exactRate)}`,
    `live_hirumawari\t${liveSum.n}\t${pct(liveSum.meanAcc)}\t${liveSum.exact}/${liveSum.n}\t${pct(liveSum.exactRate)}`,
  ];

  return ["ACCURACY  longest prefix / expected_len; extra = notes after that prefix", header, ...body, ...overall].join(
    "\n",
  );
}

export async function runUngradedHirumawari() {
  if (!existsSync(VOCAL_WAV)) return [];
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  const slice = sliceSeconds(samples, sampleRate, HIRUMAWARI_VERSE_DECODE_START, HIRUMAWARI_VERSE_DECODE_END);
  const verse = await transcribeSamples(
    slice,
    sampleRate,
    HIRUMAWARI_AUDIO_TONIC,
    HIRUMAWARI_VERSE_DECODE_START,
    HIRUMAWARI_VERSE_DECODE_START,
    HIRUMAWARI_CHORUS_START_HYPOTHESIS,
  );
  return HIRUMAWARI_VERSE_HYPOTHESES.map((h) => {
    const notes = (verse.notes ?? []).filter((n) => n.start >= h.start && n.start < h.end);
    const midis = notes.map((n) => n.midi);
    return {
      id: h.id,
      label: h.label,
      start: h.start,
      end: h.end,
      lyricCue: h.lyricCue,
      decoded: cMajorDegrees(midis, HIRUMAWARI_AUDIO_TONIC).join(" "),
      snapshot: h.cMajorFixed.join(" "),
      midis: midis.join(" "),
    };
  });
}

export function formatUngradedHypotheses(rows) {
  const lines = [
    "",
    `UNGRADED  昼回 phrase 3+  no user ground truth  chorus「${HIRUMAWARI_CHORUS_LYRIC}」~${HIRUMAWARI_CHORUS_START_HYPOTHESIS.toFixed(2)}s`,
    "id\twindow\tcue\tdecoded_C=1\tsnapshot_C=1 (not a lock)",
    ...rows.map((r) => `${r.id}\t${r.start.toFixed(2)}–${r.end.toFixed(2)}\t${r.lyricCue}\t${r.decoded}\t${r.snapshot}`),
  ];
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await runAlignSet();
  console.log(formatAlignTable(rows));
  console.log("");
  console.log(formatAccuracyReport(rows));
  for (const r of rows) {
    console.log(`\n${r.song} ${r.skip ? "SKIP" : r.pass ? "PASS" : "FAIL"}`);
    console.log(`  expected ${r.expected}`);
    console.log(`  actual   ${r.actualFull ?? r.actual}`);
    if (r.score) {
      console.log(
        `  score    ${r.score.prefix}/${r.score.expectedLen} extra=${r.score.extra} miss=${r.score.missing} exact=${r.score.exact ? "yes" : "no"}`,
      );
    }
    if (r.published) console.log(`  published ${r.published}`);
    if (r.midis?.length) console.log(`  midi     ${r.midis.join(" ")}`);
  }
  if (process.argv.includes("--report") || process.argv.includes("--ungraded")) {
    const hypo = await runUngradedHirumawari();
    console.log(formatUngradedHypotheses(hypo));
  }
  process.exit(rows.every((r) => r.pass || r.skip) && rows.some((r) => r.pass) ? 0 : 1);
}
