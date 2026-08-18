import assert from "node:assert/strict";
import test from "node:test";
import {
  ALIGN_SONGS,
  BUNENG_SHUO_DE_MIMI_PUBLISHED,
  DAOXIANG_PUBLISHED,
  GAOBAI_QIQU_C,
  GAOBAI_QIQU_PUBLISHED,
  GUYONGZHE_C,
  GUYONGZHE_PUBLISHED,
  HOULAI_PUBLISHED,
  JIANGNAN_PUBLISHED,
  QIFENGLE_PUBLISHED,
  QINGHUACI_PUBLISHED,
  TIMIAN_PUBLISHED,
  XIAOQINGGE_PUBLISHED,
  YEKONG_C,
  YEKONG_PUBLISHED,
  expectedDegrees,
  matchFirstPhrase,
  movableMajorToCFixed,
  publishedToScore,
  scorePhrase,
  stripOctaveMarks,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { HIRUMAWARI_OPENING_C, HIRUMAWARI_PHRASE2_C } from "../src/lib/melody/hirumawari-opening.ts";
import { formatAlignTable, runAlignSet } from "./align-scores.mjs";

test("ALIGN_SONGS is pop-only; published 首调 is source of truth", () => {
  const ids = ALIGN_SONGS.map((s) => s.id);
  assert.deepEqual(ids, [
    "gaobai-qiqu",
    "yekong-zui-liang",
    "qinghuaci",
    "daoxiang",
    "qifengle",
    "jiangnan",
    "houlai",
    "timian",
    "buneng-shuo-de-mimi",
    "guyongzhe",
    "xiaoqingge",
    "hirumawari-1",
    "hirumawari-2",
  ]);
  assert.ok(!ALIGN_SONGS.some((s) => /小星星|欢乐颂|生日快乐|两只老虎|twinkle|ode|birthday|tiger/i.test(s.title)));

  assert.deepEqual([...GAOBAI_QIQU_PUBLISHED], ["1", "1", "7,", "1", "7,", "1", "7,", "1", "2"]);
  assert.deepEqual(GAOBAI_QIQU_C, ["7", "7", "#6", "7", "#6", "7", "#6", "7", "#1"]);
  assert.deepEqual([...YEKONG_PUBLISHED], ["3", "2", "3", "2", "3", "5", "5", "1", "2", "1"]);
  assert.deepEqual(YEKONG_C, ["#2", "#1", "#2", "#1", "#2", "#4", "#4", "7", "#1", "7"]);
  assert.deepEqual([...QINGHUACI_PUBLISHED], ["2", "1", "6,", "1", "1", "6,", "1", "1", "6,", "1", "6,", "5,"]);
  assert.deepEqual([...DAOXIANG_PUBLISHED], ["1", "1", "6,", "1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1"]);
  assert.deepEqual([...QIFENGLE_PUBLISHED], ["2", "1", "2", "1", "2", "3", "5", "3"]);
  assert.deepEqual([...JIANGNAN_PUBLISHED], ["6,", "7,", "1", "5", "3", "1", "6,", "7,", "7,", "7,", "1", "7,", "5,", "6,"]);
  assert.deepEqual([...HOULAI_PUBLISHED], ["1", "7,", "1", "3,", "4,", "5,"]);
  assert.deepEqual([...TIMIAN_PUBLISHED], ["5,", "3", "3", "2", "3", "3", "2", "3", "3", "2", "3", "7,"]);
  assert.deepEqual([...BUNENG_SHUO_DE_MIMI_PUBLISHED], ["5,", "4", "4", "4", "4", "4", "3", "3"]);
  assert.deepEqual([...GUYONGZHE_PUBLISHED], ["3", "1", "2", "1", "3"]);
  assert.deepEqual(GUYONGZHE_C, ["#2", "7", "#1", "7", "#2"]);
  assert.deepEqual([...XIAOQINGGE_PUBLISHED], ["1", "7,", "1", "7,", "1", "7,", "5,", "3,", "5,", "7,", "6"]);

  const qinghua = ALIGN_SONGS.find((s) => s.id === "qinghuaci");
  const dao = ALIGN_SONGS.find((s) => s.id === "daoxiang");
  const qi = ALIGN_SONGS.find((s) => s.id === "qifengle");
  const jiang = ALIGN_SONGS.find((s) => s.id === "jiangnan");
  const hou = ALIGN_SONGS.find((s) => s.id === "houlai");
  const ti = ALIGN_SONGS.find((s) => s.id === "timian");
  const mi = ALIGN_SONGS.find((s) => s.id === "buneng-shuo-de-mimi");
  const xiao = ALIGN_SONGS.find((s) => s.id === "xiaoqingge");
  assert.equal(qinghua.cMajorFixed, null);
  assert.equal(dao.cMajorFixed, null);
  assert.equal(qi.cMajorFixed, null);
  assert.equal(jiang.cMajorFixed, null);
  assert.equal(hou.cMajorFixed, null);
  assert.equal(ti.cMajorFixed, null);
  assert.equal(mi.cMajorFixed, null);
  assert.equal(xiao.cMajorFixed, null);
  assert.deepEqual(ALIGN_SONGS.find((s) => s.id === "guyongzhe")?.cMajorFixed, GUYONGZHE_C);
  assert.deepEqual(expectedDegrees(jiang), stripOctaveMarks(JIANGNAN_PUBLISHED));
  assert.deepEqual(expectedDegrees(qinghua), stripOctaveMarks(QINGHUACI_PUBLISHED));
  assert.deepEqual(publishedToScore(QIFENGLE_PUBLISHED, 54).map((n) => n.midi), [56, 54, 56, 54, 56, 58, 61, 58]);

  assert.deepEqual([...HIRUMAWARI_OPENING_C], ["1", "2", "3", "2", "3", "4", "3", "2", "7", "1", "2", "2", "7", "1"]);
  assert.deepEqual([...HIRUMAWARI_PHRASE2_C], ["6", "7", "1", "1", "1", "1", "1", "7", "5", "1", "2", "1", "3"]);
  assert.deepEqual(movableMajorToCFixed(GAOBAI_QIQU_PUBLISHED, 11), GAOBAI_QIQU_C);
  assert.ok(matchFirstPhrase(["2", "1", "6", "1"], ["2", "1", "6"]));
});

test("scorePhrase is longest-prefix / expected_len with extra and missing", () => {
  assert.deepEqual(scorePhrase(["1", "7", "1", "3", "4", "5"], ["1", "7", "1", "3", "4", "5"]), {
    prefix: 6,
    expectedLen: 6,
    actualLen: 6,
    accuracy: 1,
    extra: 0,
    missing: 0,
    exact: true,
  });
  assert.deepEqual(scorePhrase(["1", "7", "1", "3", "4", "5", "2"], ["1", "7", "1", "3", "4", "5"]), {
    prefix: 6,
    expectedLen: 6,
    actualLen: 7,
    accuracy: 1,
    extra: 1,
    missing: 0,
    exact: true,
  });
  assert.deepEqual(scorePhrase(["1", "7", "1", "4", "5"], ["1", "7", "1", "3", "4", "5"]), {
    prefix: 3,
    expectedLen: 6,
    actualLen: 5,
    accuracy: 0.5,
    extra: 2,
    missing: 3,
    exact: false,
  });
  assert.deepEqual(scorePhrase(["1", "7"], ["1", "7", "1", "3", "4", "5"]), {
    prefix: 2,
    expectedLen: 6,
    actualLen: 2,
    accuracy: 2 / 6,
    extra: 0,
    missing: 4,
    exact: false,
  });
  assert.equal(matchFirstPhrase(["1", "7", "1", "3", "4", "5", "2"], ["1", "7", "1", "3", "4", "5"]), true);
  assert.equal(scorePhrase(["1", "7", "1", "3", "4", "5", "2"], ["1", "7", "1", "3", "4", "5"]).exact, true);
});

test("align-scores: pop synth 首调 + 昼回 dry vocal 固定调", async () => {
  const rows = await runAlignSet();
  console.log(formatAlignTable(rows));
  for (const r of rows) {
    if (r.skip) continue;
    assert.ok(r.pass, `${r.song}\n  got  ${r.actual}\n  want ${r.expected}\n  midi ${r.midis?.join(" ")}`);
  }
  const p1 = rows.find((r) => r.id === "hirumawari-1");
  const p2 = rows.find((r) => r.id === "hirumawari-2");
  assert.ok(p1 && (p1.pass || p1.skip), "昼回 第一句 must stay green");
  assert.ok(p2 && (p2.pass || p2.skip), "昼回 第二句 must stay green");
  if (p1 && !p1.skip) console.log(`昼回 第一句 midi ${p1.midis.join(" ")}`);
  if (p2 && !p2.skip) console.log(`昼回 第二句 midi ${p2.midis.join(" ")}`);
});
