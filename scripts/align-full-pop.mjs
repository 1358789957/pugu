import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POP_FULL_FIXTURES } from "../src/lib/melody/pop-full-fixtures.ts";
import {
  ALIGN_SONGS,
  SYNTH_ALIGN_BPM,
  clampToMelodyBand,
  expectedSynthDegrees,
  publishedToScore,
  scoreAlignment,
  synthTonicMidi,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { renderScoreSamples } from "../src/lib/melody/render-score.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { refineMelody } from "../src/lib/melody/refine-melody.ts";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";
import { existsSync } from "node:fs";
import { readWavMono16, sliceSeconds } from "./wav-pcm.mjs";
import {
  HIRUMAWARI_AUDIO_TONIC,
  HIRUMAWARI_PHRASE2_END,
  HIRUMAWARI_PHRASE2_START,
  HIRUMAWARI_PHRASE_END,
  HIRUMAWARI_PHRASE_START,
} from "../src/lib/melody/hirumawari-opening.ts";

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

async function transcribeSamples(samples, sampleRate, fromTonic) {
  const { raw } = await transcribeWavSamples(samples);
  const refined = refineMelody(pickMelodyNotes(raw), samples, sampleRate, 0);
  const notes = toPuguNotes(refined);
  return degreesOf(notes, fromTonic);
}

async function transcribePublished(published, tonicMidi, tonicPc, gap = 0.1) {
  const tonic = synthTonicMidi(published, tonicMidi);
  const score = publishedToScore(published, tonic).map((n) => ({
    ...n,
    midi: clampToMelodyBand(n.midi),
  }));
  const { samples, sampleRate } = renderScoreSamples(score, {
    bpm: SYNTH_ALIGN_BPM,
    gap,
  });
  const secs = samples.length / sampleRate;
  return { transcribed: await transcribeSamples(samples, sampleRate, tonicPc), secs, nSynth: score.length };
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function mean(xs) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function formatFullPopTable(rows) {
  const header = "id\ttitle\tspan\tn_expected\tn_matched\tacc\textra\tmiss\texact";
  const body = rows.map((r) => {
    const s = r.score;
    return [
      r.id,
      r.title,
      `${r.span} n=${s.expectedLen}`,
      s.expectedLen,
      s.matched,
      pct(s.accuracy),
      s.extra,
      s.missing,
      s.exact ? "yes" : "no",
    ].join("\t");
  });
  const accs = rows.map((r) => r.score.accuracy);
  const exact = rows.filter((r) => r.score.exact).length;
  const overall = [
    "",
    `full_song_pop\t${rows.length}\tmean_acc=${pct(mean(accs))}\texact=${exact}/${rows.length}\texact_rate=${pct(rows.length ? exact / rows.length : 0)}`,
  ];
  return [
    "FULL POP  LCS(actual, expected) / n_expected; extra = actual − matched; miss = expected − matched",
    header,
    ...body,
    ...overall,
  ].join("\n");
}

export async function runFullPopSet(onRow) {
  const phraseById = new Map(ALIGN_SONGS.filter((s) => !s.liveAudio).map((s) => [s.id, s]));
  const rows = [];
  for (const full of POP_FULL_FIXTURES) {
    const phrase = phraseById.get(full.id);
    if (!phrase) throw new Error(`missing first-line fixture for ${full.id}`);
    const published = full.publishedFullMovableDo;
    const want = expectedSynthDegrees(published, phrase.tonicMidi, phrase.tonicPc);
    const t0 = Date.now();
    const { transcribed, secs, nSynth } = await transcribePublished(published, phrase.tonicMidi, phrase.tonicPc);
    const score = scoreAlignment(transcribed.inC, want);
    const row = {
      id: full.id,
      title: phrase.title,
      span: full.span,
      throughLyric: full.throughLyric,
      nFullVocalOnce: full.nFullVocalOnce,
      publishedKey: full.publishedKey,
      synthSec: secs,
      nSynth,
      expected: want.join(" "),
      actual: transcribed.inC.join(" "),
      score,
      elapsedMs: Date.now() - t0,
    };
    rows.push(row);
    onRow?.(row);
  }
  return rows;
}

async function transcribeHirumawariLive(which) {
  const { samples, sampleRate } = readWavMono16(VOCAL_WAV);
  if (which === "hirumawari-1") {
    const slice = sliceSeconds(samples, sampleRate, 0, HIRUMAWARI_PHRASE_END + 0.4);
    const { raw } = await transcribeWavSamples(slice);
    const refined = refineMelody(pickMelodyNotes(raw), slice, sampleRate, 0);
    const notes = toPuguNotes(refined).filter(
      (n) => n.start >= HIRUMAWARI_PHRASE_START - 0.15 && n.start < HIRUMAWARI_PHRASE_END,
    );
    return degreesOf(notes, HIRUMAWARI_AUDIO_TONIC);
  }
  const t0 = HIRUMAWARI_PHRASE2_START;
  const slice = sliceSeconds(samples, sampleRate, t0, HIRUMAWARI_PHRASE2_END + 0.2);
  const { raw } = await transcribeWavSamples(slice);
  const refined = refineMelody(pickMelodyNotes(raw), slice, sampleRate, 0);
  const notes = toPuguNotes(refined)
    .map((n) => ({ ...n, start: n.start + t0 }))
    .filter((n) => n.start >= HIRUMAWARI_PHRASE2_START && n.start < HIRUMAWARI_PHRASE2_END);
  return degreesOf(notes, HIRUMAWARI_AUDIO_TONIC);
}

async function runHirumawariLivePoints() {
  if (!existsSync(VOCAL_WAV)) return { skip: "examples/hirumawari vocal wav is not in this checkout", rows: [] };
  const live = ALIGN_SONGS.filter((s) => s.liveAudio);
  const rows = [];
  for (const song of live) {
    const transcribed = await transcribeHirumawariLive(song.id);
    const want = [...song.publishedMovableDo];
    rows.push({
      id: song.id,
      title: song.title,
      expected: want.join(" "),
      actual: transcribed.inC.join(" "),
      score: scoreAlignment(transcribed.inC, want),
    });
  }
  return { rows };
}

export function formatLiveSideGroup(result) {
  if (result.skip) return `\nLIVE 昼回 1+2  skipped (${result.skip})  not the gold standard`;
  const lines = result.rows.map((r) => {
    const s = r.score;
    return `${r.id}\t${r.title}\t${s.matched}/${s.expectedLen} (${pct(s.accuracy)})\texact=${s.exact ? "yes" : "no"}`;
  });
  return [
    "",
    "LIVE 昼回 1+2  one live-audio point, not the gold standard. Phrase 3–5 ungraded, not listed.",
    "id\ttitle\tacc\texact",
    ...lines,
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outPath = process.argv.includes("--json")
    ? process.argv[process.argv.indexOf("--json") + 1]
    : "/tmp/align-full-pop.last.json";
  const rows = [];
  const pop = await runFullPopSet((row) => {
    rows.push(row);
    const s = row.score;
    console.error(
      `${row.id} ${row.span} n=${s.expectedLen} matched=${s.matched} acc=${pct(s.accuracy)} extra=${s.extra} miss=${s.missing} exact=${s.exact ? "yes" : "no"} synth=${row.synthSec.toFixed(1)}s ${row.elapsedMs}ms`,
    );
    writeFileSync(outPath, JSON.stringify({ pop: rows }, null, 2));
  });
  const live = await runHirumawariLivePoints();
  writeFileSync(outPath, JSON.stringify({ pop, live }, null, 2));
  console.log(formatFullPopTable(pop));
  console.log(formatLiveSideGroup(live));
  for (const r of pop) {
    console.log(`\n${r.title}  ${r.span}  through ${r.throughLyric}`);
    console.log(`  expected n=${r.score.expectedLen}`);
    console.log(`  actual   n=${r.score.actualLen}`);
    console.log(
      `  LCS      ${r.score.matched}/${r.score.expectedLen} extra=${r.score.extra} miss=${r.score.missing} prefix=${r.score.prefix}`,
    );
  }
}
