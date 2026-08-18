import assert from "node:assert/strict";
import test from "node:test";
import { cMajorDegrees } from "../src/lib/melody/leadsheet.ts";
import {
  ALIGN_SONGS,
  HAPPY_BIRTHDAY_C,
  HAPPY_BIRTHDAY_SCORE,
  ODE_TO_JOY_C,
  ODE_TO_JOY_SCORE,
  TWINKLE_ALIGN_C,
  TWINKLE_ALIGN_SCORE,
  TWO_TIGERS_C,
  TWO_TIGERS_SCORE,
} from "../src/lib/melody/align-scores.ts";
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "../src/lib/melody/hirumawari-opening.ts";
import { renderScoreSamples } from "../src/lib/melody/render-score.ts";
import { formatAlignTable, runAlignSet } from "./align-scores.mjs";

test("align fixtures are C=1 固定调 of their scores; 昼回 fixtures unchanged", () => {
  assert.deepEqual(
    cMajorDegrees(
      TWINKLE_ALIGN_SCORE.map((n) => n.midi),
      0,
    ),
    [...TWINKLE_ALIGN_C],
  );
  assert.deepEqual(
    cMajorDegrees(
      ODE_TO_JOY_SCORE.map((n) => n.midi),
      0,
    ),
    [...ODE_TO_JOY_C],
  );
  assert.deepEqual(
    cMajorDegrees(
      HAPPY_BIRTHDAY_SCORE.map((n) => n.midi),
      0,
    ),
    [...HAPPY_BIRTHDAY_C],
  );
  assert.deepEqual(
    cMajorDegrees(
      TWO_TIGERS_SCORE.map((n) => n.midi),
      0,
    ),
    [...TWO_TIGERS_C],
  );
  assert.deepEqual([...HIRUMAWARI_OPENING_C], ["1", "2", "3", "2", "3", "4", "3", "2", "7", "1", "2", "2", "7", "1"]);
  assert.deepEqual([...HIRUMAWARI_PHRASE2_C], ["6", "7", "1", "1", "1", "1", "1", "7", "5", "1", "2", "1", "3"]);
  assert.equal(ALIGN_SONGS.length, 6);
});

test("renderScoreSamples writes a dry triangle line like the 小星星 demo", () => {
  const { samples, sampleRate } = renderScoreSamples(TWINKLE_ALIGN_SCORE, { bpm: 96 });
  assert.equal(sampleRate, 22050);
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  assert.ok(peak > 0.1 && peak <= 1);
  assert.ok(samples.length / sampleRate > 8);
});

test("align-scores: synth C + 昼回 dry vocal 固定调 match fixtures", async () => {
  const rows = await runAlignSet();
  console.log(formatAlignTable(rows));
  for (const r of rows) {
    if (r.skip) continue;
    assert.ok(r.pass, `${r.song}\n  got  ${r.actual}\n  want ${r.expected}`);
  }
  assert.ok(
    rows.some((r) => r.id === "hirumawari-2" && (r.pass || r.skip)),
    "昼回 第二句 must stay in the align set",
  );
});
