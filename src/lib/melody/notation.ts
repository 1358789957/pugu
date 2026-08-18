import {
  beatSeconds,
  resolveGridOffset,
  secondsPerSixteenth,
  spellNote,
  tickToTime,
  timeToTick,
  type AnalysisResult,
  type ChordEvent,
  type NoteEvent,
} from "./notes";

export type NotationKind = "note" | "rest";

export type NotationEvent = {
  kind: NotationKind;
  midi: number;
  id?: string;
  start: number;
  duration: number;
  units: number;
  posInMeasure: number;
  measureIndex: number;
  dotted: boolean;
  hollow: boolean;
  flags: 0 | 1 | 2;
  tieFromPrev: boolean;
  tieToNext: boolean;
  beamGroup: number | null;
  printed: "♯" | "♭" | "♮" | null;
  staffMidi: number;
};

export type NotationMeasure = {
  index: number;
  start: number;
  events: NotationEvent[];
};

const STANDARD_UNITS = [16, 12, 8, 6, 4, 3, 2, 1];

function largestFit(limit: number): number {
  for (const u of STANDARD_UNITS) {
    if (u <= limit) return u;
  }
  return 1;
}

function glyphFor(units: number): { dotted: boolean; hollow: boolean; flags: 0 | 1 | 2 } {
  switch (units) {
    case 16:
      return { dotted: false, hollow: true, flags: 0 };
    case 12:
      return { dotted: true, hollow: true, flags: 0 };
    case 8:
      return { dotted: false, hollow: true, flags: 0 };
    case 6:
      return { dotted: true, hollow: false, flags: 0 };
    case 4:
      return { dotted: false, hollow: false, flags: 0 };
    case 3:
      return { dotted: true, hollow: false, flags: 1 };
    case 2:
      return { dotted: false, hollow: false, flags: 1 };
    default:
      return { dotted: false, hollow: false, flags: 2 };
  }
}

function decompose(pos: number, units: number, isRest: boolean): { pos: number; units: number }[] {
  const out: { pos: number; units: number }[] = [];
  let p = pos;
  let left = units;
  while (left > 0) {
    const beatPos = ((p % 4) + 4) % 4;
    const barPos = ((p % 16) + 16) % 16;
    const toBar = 16 - barPos;
    const toBeat = 4 - beatPos;
    const limit = beatPos === 0 ? Math.min(left, toBar) : Math.min(left, toBeat);
    const take = largestFit(Math.max(1, limit));
    out.push({ pos: p, units: take });
    p += take;
    left -= take;
    if (isRest && take < 1) break;
  }
  return out;
}

type RawSeg = {
  kind: NotationKind;
  midi: number;
  id?: string;
  startTick: number;
  endTick: number;
  tieFromPrev: boolean;
  tieToNext: boolean;
};

function fillMeasure(occupied: RawSeg[], m0: number): RawSeg[] {
  const clipped = occupied
    .map((s) => ({
      ...s,
      startTick: Math.max(s.startTick, m0),
      endTick: Math.min(s.endTick, m0 + 16),
      tieFromPrev: s.tieFromPrev || s.startTick < m0,
      tieToNext: s.tieToNext || s.endTick > m0 + 16,
    }))
    .filter((s) => s.endTick > s.startTick)
    .sort((a, b) => a.startTick - b.startTick);

  const filled: RawSeg[] = [];
  let cursor = m0;
  for (const s of clipped) {
    if (s.startTick > cursor) {
      filled.push({
        kind: "rest",
        midi: 0,
        startTick: cursor,
        endTick: s.startTick,
        tieFromPrev: false,
        tieToNext: false,
      });
    }
    filled.push(s);
    cursor = Math.max(cursor, s.endTick);
  }
  if (cursor < m0 + 16) {
    filled.push({
      kind: "rest",
      midi: 0,
      startTick: cursor,
      endTick: m0 + 16,
      tieFromPrev: false,
      tieToNext: false,
    });
  }
  return filled;
}

function assignBeams(events: NotationEvent[]) {
  let groupId = 1;
  let run: number[] = [];
  let runBeat = -1;

  const flush = () => {
    if (run.length >= 2) {
      for (const i of run) events[i].beamGroup = groupId;
      groupId += 1;
    }
    run = [];
    runBeat = -1;
  };

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const beat = Math.floor(e.posInMeasure / 4);
    const beamable = e.kind === "note" && !e.dotted && (e.units === 1 || e.units === 2) && !e.tieFromPrev;
    if (!beamable || beat !== runBeat) {
      flush();
      if (beamable) {
        run = [i];
        runBeat = beat;
      }
      continue;
    }
    run.push(i);
  }
  flush();
}

function applyMeasureAccidentals(
  events: NotationEvent[],
  tonic: number,
  mode: "major" | "minor",
) {
  const seen = new Map<number, number>();
  for (const e of events) {
    if (e.kind !== "note") continue;
    const sp = spellNote(e.midi, tonic, mode);
    e.staffMidi = sp.staffMidi;
    const prev = seen.get(sp.letter);
    if (prev === undefined) {
      e.printed = sp.printed;
    } else if (prev === sp.alter) {
      e.printed = null;
    } else {
      e.printed = sp.alter === 0 ? "♮" : sp.alter > 0 ? "♯" : "♭";
    }
    seen.set(sp.letter, sp.alter);
  }
}

export function notateScore(
  notes: NoteEvent[],
  bpm: number,
  gridOffset = 0,
  key?: { tonic: number; mode: "major" | "minor" },
): NotationMeasure[] {
  if (!notes.length || !Number.isFinite(bpm) || bpm < 40) return [];
  const sixteenth = secondsPerSixteenth(bpm);
  const segs: RawSeg[] = notes.map((n) => {
    const startTick = timeToTick(n.start, bpm, gridOffset);
    const endTick = Math.max(startTick + 1, timeToTick(n.start + n.duration, bpm, gridOffset));
    return {
      kind: "note" as const,
      midi: n.midi,
      id: n.id,
      startTick,
      endTick,
      tieFromPrev: false,
      tieToNext: false,
    };
  });

  const minTick = Math.min(...segs.map((s) => s.startTick));
  const maxTick = Math.max(...segs.map((s) => s.endTick));
  const firstBar = Math.floor(minTick / 16) * 16;
  const lastBar = Math.ceil(maxTick / 16) * 16;
  const tonic = key?.tonic ?? 0;
  const mode = key?.mode ?? "major";
  const measures: NotationMeasure[] = [];

  for (let m0 = firstBar; m0 < lastBar; m0 += 16) {
    const covering = segs.filter((s) => s.startTick < m0 + 16 && s.endTick > m0);
    if (!covering.length) continue;
    const timeline = fillMeasure(covering, m0);
    const events: NotationEvent[] = [];
    for (const seg of timeline) {
      const pieces = decompose(seg.startTick, seg.endTick - seg.startTick, seg.kind === "rest");
      pieces.forEach((piece, pi) => {
        const glyph = glyphFor(piece.units);
        const tiedForward =
          seg.kind === "note" && (seg.tieToNext || pi < pieces.length - 1);
        const tiedBack = seg.kind === "note" && (seg.tieFromPrev || pi > 0);
        const sp = seg.kind === "note" ? spellNote(seg.midi, tonic, mode) : null;
        events.push({
          kind: seg.kind,
          midi: seg.midi,
          id: seg.id,
          start: tickToTime(piece.pos, bpm, gridOffset),
          duration: piece.units * sixteenth,
          units: piece.units,
          posInMeasure: ((piece.pos % 16) + 16) % 16,
          measureIndex: Math.floor(m0 / 16),
          dotted: glyph.dotted,
          hollow: glyph.hollow,
          flags: glyph.flags,
          tieFromPrev: tiedBack,
          tieToNext: tiedForward,
          beamGroup: null,
          printed: sp?.printed ?? null,
          staffMidi: sp?.staffMidi ?? 71,
        });
      });
    }
    assignBeams(events);
    applyMeasureAccidentals(events, tonic, mode);
    measures.push({
      index: Math.floor(m0 / 16),
      start: tickToTime(m0, bpm, gridOffset),
      events,
    });
  }
  return measures;
}

export function notateAnalysis(result: AnalysisResult): NotationMeasure[] {
  return notateScore(
    result.notes,
    result.bpm,
    resolveGridOffset(result),
    result.key,
  );
}

export function measureDuration(bpm: number): number {
  return beatSeconds(bpm) * 4;
}

export function barIndex(t: number, bpm: number, gridOffset: number): number {
  return Math.floor((timeToTick(t, bpm, gridOffset) + 1e-6) / 16);
}

export function chordAtTime(chords: ChordEvent[], t: number): ChordEvent | null {
  let hit: ChordEvent | null = null;
  for (const c of chords) {
    if (t + 1e-3 >= c.start && t < c.start + c.duration + 1e-3) hit = c;
  }
  return hit;
}

export function chordsInSpan(chords: ChordEvent[], start: number, end: number): ChordEvent[] {
  return chords.filter((c) => c.start < end - 1e-3 && c.start + c.duration > start + 1e-3);
}
