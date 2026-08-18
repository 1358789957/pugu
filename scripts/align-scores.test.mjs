import assert from "node:assert/strict";
import test from "node:test";
import {
  GAOBAI_QIQU_C,
  GAOBAI_QIQU_PUBLISHED,
  POP_PHRASE_FIXTURES,
  YEKONG_C,
  YEKONG_PUBLISHED,
  matchFirstPhrase,
  movableMajorToCFixed,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "../src/lib/melody/hirumawari-opening.ts";
import { formatAlignTable, runAlignSet } from "./align-scores.mjs";

test("pop fixtures are first-line 首调 + C=1 固定调; no nursery-rhyme rulers", () => {
  assert.deepEqual([...GAOBAI_QIQU_PUBLISHED], ["1", "1", "7", "1", "7", "1", "7", "1", "2"]);
  assert.deepEqual(GAOBAI_QIQU_C, ["7", "7", "#6", "7", "#6", "7", "#6", "7", "#1"]);
  assert.deepEqual(movableMajorToCFixed(GAOBAI_QIQU_PUBLISHED, 11), GAOBAI_QIQU_C);

  assert.deepEqual([...YEKONG_PUBLISHED], ["3", "2", "3", "2", "3", "5", "5", "1", "2", "1"]);
  assert.deepEqual(YEKONG_C, ["#2", "#1", "#2", "#1", "#2", "#4", "#4", "7", "#1", "7"]);
  assert.deepEqual(movableMajorToCFixed(YEKONG_PUBLISHED, 11), YEKONG_C);

  assert.deepEqual([...HIRUMAWARI_OPENING_C], ["1", "2", "3", "2", "3", "4", "3", "2", "7", "1", "2", "2", "7", "1"]);
  assert.deepEqual([...HIRUMAWARI_PHRASE2_C], ["6", "7", "1", "1", "1", "1", "1", "7", "5", "1", "2", "1", "3"]);

  const titles = POP_PHRASE_FIXTURES.map((s) => s.title);
  assert.ok(titles.some((t) => t.includes("告白气球")));
  assert.ok(titles.some((t) => t.includes("夜空中最亮的星")));
  assert.ok(titles.some((t) => t.includes("昼回")));
  assert.ok(!titles.some((t) => /小星星|欢乐颂|生日快乐|两只老虎/.test(t)));
  assert.ok(matchFirstPhrase(["7", "7", "#6", "7", "#6", "7", "#6", "7", "#1", "x"], GAOBAI_QIQU_C));
});

test("align-scores: 昼回 dry vocal 固定调 match fixtures", async () => {
  const rows = await runAlignSet();
  console.log(formatAlignTable(rows));
  for (const r of rows) {
    if (r.skip || r.fixtureOnly) continue;
    assert.ok(r.pass, `${r.song}\n  got  ${r.actual}\n  want ${r.expected}\n  midi ${r.midis?.join(" ")}`);
  }
  const p1 = rows.find((r) => r.id === "hirumawari-1");
  const p2 = rows.find((r) => r.id === "hirumawari-2");
  assert.ok(p1 && (p1.pass || p1.skip), "昼回 第一句 must stay in the pop align set");
  assert.ok(p2 && (p2.pass || p2.skip), "昼回 第二句 must stay in the pop align set");
  if (p1 && !p1.skip) {
    console.log(`昼回 第一句 midi ${p1.midis.join(" ")}`);
  }
  if (p2 && !p2.skip) {
    console.log(`昼回 第二句 midi ${p2.midis.join(" ")}`);
  }
});
