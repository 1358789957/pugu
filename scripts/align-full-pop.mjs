import { existsSync, writeFileSync } from "node:fs";
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
  scorePhraseSet,
  synthTonicMidi,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { renderScoreSamples } from "../src/lib/melody/render-score.ts";
import { cMajorDegrees, jianpuDegree } from "../src/lib/melody/leadsheet.ts";
import { pickMelodyNotes, toPuguNotes } from "../src/lib/melody/basic-pitch-notes.ts";
import { refineMelody } from "../src/lib/melody/refine-melody.ts";
import { transcribeWavSamples } from "./run-basic-pitch-wav.mjs";
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

/** Silence around each vocal line so phrase k cannot leak into k+1. */
const PHRASE_LEAD = 0.4;
const PHRASE_TAIL = 0.7;

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

async function transcribePublishedPhrase(published, tonicMidi, tonicPc, gap = 0.1) {
  const tonic = synthTonicMidi(published, tonicMidi);
  const score = publishedToScore(published, tonic).map((n) => ({
    ...n,
    midi: clampToMelodyBand(n.midi),
  }));
  const { samples, sampleRate } = renderScoreSamples(score, {
    bpm: SYNTH_ALIGN_BPM,
    gap,
    lead: PHRASE_LEAD,
    tail: PHRASE_TAIL,
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
  const header = "id\ttitle\tspan\tn_phrases\tmean_acc\tphrase_exact\tmicro\textra\tmiss";
  const body = rows.map((r) => {
    const s = r.score;
    return [
      r.id,
      r.title,
      `${r.span} n=${s.expectedLen}`,
      s.nPhrases,
      pct(s.meanAcc),
      `${s.exactPhrases}/${s.nPhrases} (${pct(s.phraseExactRate)})`,
      `${s.matched}/${s.expectedLen} (${pct(s.microAcc)})`,
      s.extra,
      s.missing,
    ].join("\t");
  });
  const songMean = mean(rows.map((r) => r.score.meanAcc));
  const microM = rows.reduce((a, r) => a + r.score.matched, 0);
  const microE = rows.reduce((a, r) => a + r.score.expectedLen, 0);
  const exactP = rows.reduce((a, r) => a + r.score.exactPhrases, 0);
  const nP = rows.reduce((a, r) => a + r.score.nPhrases, 0);
  const extra = rows.reduce((a, r) => a + r.score.extra, 0);
  const miss = rows.reduce((a, r) => a + r.score.missing, 0);
  const overall = [
    "",
    `overall\tsongs=${rows.length}\tmean_of_songs=${pct(songMean)}\tmicro=${microM}/${microE} (${pct(microE ? microM / microE : 0)})\tphrase_exact=${exactP}/${nP} (${pct(nP ? exactP / nP : 0)})\textra=${extra}\tmiss=${miss}`,
  ];
  return [
    "FULL POP  phrase-by-phrase LCS / n_expected. One vocal line = one decode. A miss in phrase k does not shift k+1.",
    header,
    ...body,
    ...overall,
  ].join("\n");
}

export function formatWorstPhrases(rows, limit = 12) {
  const flat = [];
  for (const r of rows) {
    for (const p of r.phrases) {
      flat.push({
        id: r.id,
        title: r.title,
        lyric: p.lyric,
        want: p.expected,
        got: p.actual,
        score: p.score,
      });
    }
  }
  flat.sort((a, b) => {
    const da = a.score.accuracy - b.score.accuracy;
    if (da !== 0) return da;
    return b.score.extra + b.score.missing - (a.score.extra + a.score.missing);
  });
  const worst = flat.filter((p) => !p.score.exact).slice(0, limit);
  if (!worst.length) return "\nWORST PHRASES  none (all exact)";
  const lines = worst.map((p) => {
    const s = p.score;
    return `${p.id}\t${p.lyric}\t${s.matched}/${s.expectedLen} (${pct(s.accuracy)}) extra=${s.extra} miss=${s.missing}\n  want ${p.want}\n  got  ${p.got}`;
  });
  return ["", `WORST PHRASES  ${worst.length} of ${flat.filter((p) => !p.score.exact).length} non-exact`, ...lines].join(
    "\n",
  );
}

export async function runFullPopSet(onRow) {
  const phraseById = new Map(ALIGN_SONGS.filter((s) => !s.liveAudio).map((s) => [s.id, s]));
  const rows = [];
  for (const full of POP_FULL_FIXTURES) {
    const meta = phraseById.get(full.id);
    if (!meta) throw new Error(`missing first-line fixture for ${full.id}`);
    const t0 = Date.now();
    const phraseRows = [];
    let synthSec = 0;
    for (const ph of full.phrases) {
      const published = [...ph.publishedMovableDo];
      const want = expectedSynthDegrees(published, meta.tonicMidi, meta.tonicPc);
      const { transcribed, secs } = await transcribePublishedPhrase(published, meta.tonicMidi, meta.tonicPc);
      synthSec += secs;
      const score = scoreAlignment(transcribed.inC, want);
      phraseRows.push({
        lyric: ph.lyric,
        expected: want.join(" "),
        actual: transcribed.inC.join(" "),
        score,
      });
    }
    const set = scorePhraseSet(
      phraseRows.map((p) => p.actual.split(" ").filter(Boolean)),
      phraseRows.map((p) => p.expected.split(" ").filter(Boolean)),
    );
    const row = {
      id: full.id,
      title: meta.title,
      span: full.span,
      throughLyric: full.throughLyric,
      nFullVocalOnce: full.nFullVocalOnce,
      publishedKey: full.publishedKey,
      synthSec,
      phrases: phraseRows,
      score: set,
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
      `${row.id} ${row.span} phrases=${s.nPhrases} mean=${pct(s.meanAcc)} exact=${s.exactPhrases}/${s.nPhrases} micro=${s.matched}/${s.expectedLen} extra=${s.extra} miss=${s.missing} ${row.elapsedMs}ms`,
    );
    writeFileSync(outPath, JSON.stringify({ pop: rows }, null, 2));
  });
  const live = await runHirumawariLivePoints();
  writeFileSync(outPath, JSON.stringify({ pop, live }, null, 2));
  console.log(formatFullPopTable(pop));
  console.log(formatWorstPhrases(pop));
  console.log(formatLiveSideGroup(live));
}
