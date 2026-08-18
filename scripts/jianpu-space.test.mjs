import assert from "node:assert/strict";
import test from "node:test";
import {
  BUNENG_SHUO_DE_MIMI_PUBLISHED,
  DAOXIANG_PUBLISHED,
  GAOBAI_QIQU_PUBLISHED,
  GUYONGZHE_PUBLISHED,
  HOULAI_PUBLISHED,
  JIANGNAN_PUBLISHED,
  QIFENGLE_PUBLISHED,
  QINGHUACI_PUBLISHED,
  TIMIAN_PUBLISHED,
  XIAOQINGGE_PUBLISHED,
  YEKONG_PUBLISHED,
  accidentalSemitones,
  expectedSynthDegrees,
  publishedToScore,
  scoreAlignment,
  stripOctaveMarks,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { POP_FULL_FIXTURES, fullPopById } from "../src/lib/melody/pop-full-fixtures.ts";
import {
  normalizeLyricKey,
  parseJianpuText,
  tokenizeJianpuDegrees,
} from "../src/lib/melody/jianpu-space.ts";

const GAOBAI_EXCERPT = `/key(B3)
ｂｐｍ90.1
0_5,_1_7,_5,_1,_|-5,_2,_-_3,3,_|
L:"(前奏)"**** ****
0=1=1=7,=1_.7,=1=7,=1_0_2_|
L:塞納河畔 左岸的咖啡
-=7,=7,=6,=7,_.6,=7,=6,=7,_0_1_|
L:我手一杯 品嚐你的美
0=1=1=7,=1_.7,=1=7,=1_0_2_|
L:塞納河畔 左岸的咖啡
352-|157,.1=7,=|
L:"(間奏)"* ***
1-00|
L:"(尾奏)"
`;

test("tokenizeJianpuDegrees skips rests, holds, dots; keeps octaves and accidentals", () => {
  assert.deepEqual(tokenizeJianpuDegrees("0=1=1=7,=1_.7,=1=7,=1_0_2_"), [
    "1",
    "1",
    "7,",
    "1",
    "7,",
    "1",
    "7,",
    "1",
    "2",
  ]);
  assert.deepEqual(tokenizeJianpuDegrees("4,_ #5,_ n5,_ b6,"), ["4,", "#5,", "n5,", "b6,"]);
  assert.deepEqual(tokenizeJianpuDegrees("352-"), ["3", "5", "2"]);
});

test("parseJianpuText skips 前奏/间奏/尾奏 and does not triple-count lyric repeats", () => {
  const parsed = parseJianpuText(GAOBAI_EXCERPT);
  assert.equal(parsed.key, "/key(B3)");
  assert.equal(parsed.bpm, 90.1);
  assert.deepEqual(
    parsed.lines.map((l) => l.lyric),
    ["塞納河畔 左岸的咖啡", "我手一杯 品嚐你的美"],
  );
  assert.deepEqual(parsed.degrees.slice(0, 9), [...GAOBAI_QIQU_PUBLISHED]);
});

test("normalizeLyricKey strips (+1key) so a modulated chorus is not a second copy", () => {
  assert.equal(normalizeLyricKey('(+1key)天"青色等煙雨 而我在等妳'), normalizeLyricKey("天青色等煙雨 而我在等妳"));
});

test("POP_FULL_FIXTURES is the 11 pop songs; 昼回 is not in this set", () => {
  assert.deepEqual(
    POP_FULL_FIXTURES.map((s) => s.id),
    [
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
    ],
  );
  assert.ok(POP_FULL_FIXTURES.every((s) => s.publishedFullMovableDo.length >= 80));
  assert.ok(!POP_FULL_FIXTURES.some((s) => /小星星|欢乐颂|生日快乐|两只老虎/i.test(s.id)));
  assert.equal(fullPopById("hirumawari-1"), undefined);
});

test("first-line fixtures are prefixes of the full unique vocal (documented exceptions)", () => {
  const prefixOf = (full, first) => first.every((d, i) => full[i] === d);
  const octavePrefix = (full, first) =>
    stripOctaveMarks(first).every((d, i) => stripOctaveMarks(full)[i] === d);

  assert.ok(prefixOf(fullPopById("gaobai-qiqu").publishedFullMovableDo, GAOBAI_QIQU_PUBLISHED));
  assert.ok(prefixOf(fullPopById("qinghuaci").publishedFullMovableDo, QINGHUACI_PUBLISHED));
  assert.ok(prefixOf(fullPopById("daoxiang").publishedFullMovableDo, DAOXIANG_PUBLISHED));
  assert.ok(prefixOf(fullPopById("qifengle").publishedFullMovableDo, QIFENGLE_PUBLISHED));
  assert.ok(prefixOf(fullPopById("jiangnan").publishedFullMovableDo, JIANGNAN_PUBLISHED));
  assert.ok(prefixOf(fullPopById("timian").publishedFullMovableDo, TIMIAN_PUBLISHED));
  assert.ok(prefixOf(fullPopById("buneng-shuo-de-mimi").publishedFullMovableDo, BUNENG_SHUO_DE_MIMI_PUBLISHED));
  assert.ok(prefixOf(fullPopById("guyongzhe").publishedFullMovableDo, GUYONGZHE_PUBLISHED));
  assert.ok(octavePrefix(fullPopById("xiaoqingge").publishedFullMovableDo, XIAOQINGGE_PUBLISHED));

  // Page has an extra pickup 5, after 5 5 that the first-line fixture omitted.
  const yekong = fullPopById("yekong-zui-liang").publishedFullMovableDo;
  assert.deepEqual([...yekong.slice(0, 8)], ["3", "2", "3", "2", "3", "5", "5", "5,"]);
  assert.ok(!prefixOf(yekong, YEKONG_PUBLISHED));

  // Page prints chorus 后来 first; first-line fixture is verse 栀子花, later in the unique line.
  const houlai = [...fullPopById("houlai").publishedFullMovableDo];
  assert.ok(!prefixOf(houlai, HOULAI_PUBLISHED));
  const verseAt = houlai.findIndex((_, i) => HOULAI_PUBLISHED.every((d, j) => houlai[i + j] === d));
  assert.ok(verseAt > 0, "栀子花 line must appear after the printed chorus");
});

test("scoreAlignment is LCS / expected with extra and missing", () => {
  assert.deepEqual(scoreAlignment(["1", "7", "1", "3", "4", "5"], ["1", "7", "1", "3", "4", "5"]), {
    matched: 6,
    expectedLen: 6,
    actualLen: 6,
    accuracy: 1,
    extra: 0,
    missing: 0,
    exact: true,
    prefix: 6,
  });
  assert.deepEqual(scoreAlignment(["1", "7", "x", "1", "3", "4", "5"], ["1", "7", "1", "3", "4", "5"]), {
    matched: 6,
    expectedLen: 6,
    actualLen: 7,
    accuracy: 1,
    extra: 1,
    missing: 0,
    exact: false,
    prefix: 2,
  });
  assert.deepEqual(scoreAlignment(["1", "7", "1"], ["1", "7", "1", "3", "4", "5"]), {
    matched: 3,
    expectedLen: 6,
    actualLen: 3,
    accuracy: 0.5,
    extra: 0,
    missing: 3,
    exact: false,
    prefix: 3,
  });
});

test("publishedToScore applies # / b / n; expectedSynthDegrees matches jianpuDegree sharps", () => {
  assert.equal(accidentalSemitones("#5,"), 1);
  assert.equal(accidentalSemitones("n5,"), 0);
  assert.equal(accidentalSemitones("b6,"), -1);
  const midis = publishedToScore(["5,", "#5,", "n5,"], 63).map((n) => n.midi);
  assert.deepEqual(midis, [58, 59, 58]);
  const deg = expectedSynthDegrees(["5,", "b6,"], 62, 2);
  assert.ok(deg.length === 2);
  assert.notEqual(deg[0], deg[1]);
});
