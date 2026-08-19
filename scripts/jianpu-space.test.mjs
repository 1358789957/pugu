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
  scorePhraseSet,
  stripOctaveMarks,
} from "../src/lib/melody/pop-phrase-fixtures.ts";
import { POP_FULL_FIXTURES, fullPopById } from "../src/lib/melody/pop-full-fixtures.ts";
import {
  normalizeLyricKey,
  parseJianpuText,
  parsePublishedKey,
  tokenizeJianpuDegrees,
} from "../src/lib/melody/jianpu-space.ts";
import { NEW_POP_IDS } from "../src/lib/melody/pop-new-fixtures.ts";

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

test("POP_FULL_FIXTURES is the 11 pop songs plus the new batch; 昼回 is not in this set", () => {
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
      ...NEW_POP_IDS,
    ],
  );
  assert.ok(POP_FULL_FIXTURES.every((s) => s.publishedFullMovableDo.length >= 70));
  assert.ok(POP_FULL_FIXTURES.every((s) => s.phrases.length >= 8));
  assert.ok(
    POP_FULL_FIXTURES.every(
      (s) => s.phrases.flatMap((p) => [...p.publishedMovableDo]).join(" ") === s.publishedFullMovableDo.join(" "),
    ),
  );
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

  for (const id of NEW_POP_IDS) {
    const full = fullPopById(id);
    assert.ok(full, id);
    assert.ok(full.phrases.length >= 8, id);
    assert.equal(full.phrases[0].publishedMovableDo.length > 0, true, id);
  }
});

test("parsePublishedKey reads /key letter, accidental, octave", () => {
  assert.deepEqual(parsePublishedKey("/key(E3)"), { tonicName: "E", tonicPc: 4, tonicMidi: 52 });
  assert.deepEqual(parsePublishedKey("/key(F3)"), { tonicName: "F", tonicPc: 5, tonicMidi: 53 });
  assert.deepEqual(parsePublishedKey("/key(F#3)"), { tonicName: "F#", tonicPc: 6, tonicMidi: 54 });
  assert.deepEqual(parsePublishedKey("/key(Ab3)"), { tonicName: "Ab", tonicPc: 8, tonicMidi: 56 });
  assert.deepEqual(parsePublishedKey("/key(C4)"), { tonicName: "C", tonicPc: 0, tonicMidi: 60 });
  assert.equal(parseJianpuText("/key(F3).\nbpm82\n3_5_\nL:會不會").key, "/key(F3)");
});

test("scorePhraseSet is local: an extra in phrase 0 does not shift phrase 1", () => {
  const expected = [
    ["1", "2", "3", "4"],
    ["5", "6", "7", "1"],
  ];
  const actual = [
    ["1", "2", "x", "3", "4"],
    ["5", "6", "7", "1"],
  ];
  const set = scorePhraseSet(actual, expected);
  assert.equal(set.nPhrases, 2);
  assert.equal(set.phrases[0].exact, false);
  assert.equal(set.phrases[0].extra, 1);
  assert.equal(set.phrases[0].missing, 0);
  assert.equal(set.phrases[1].exact, true);
  assert.equal(set.phrases[1].accuracy, 1);
  assert.equal(set.exactPhrases, 1);
  assert.equal(set.matched, 8);
  assert.equal(set.expectedLen, 8);
  const concat = scoreAlignment(actual.flat(), expected.flat());
  assert.equal(concat.exact, false);
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
