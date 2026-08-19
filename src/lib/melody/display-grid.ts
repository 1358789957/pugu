import {
  beatSeconds,
  findGridOffset,
  quantizeToGrid,
  type NoteEvent,
  type QuantizeResult,
} from "./notes";

export type DisplayGridKind = "16th" | "triplet";

export type DisplayGridResult = QuantizeResult & {
  grid: DisplayGridKind;
};

function meanStartError(notes: NoteEvent[], step: number, offset: number): number {
  if (!notes.length) return 0;
  let err = 0;
  for (const n of notes) {
    const t = n.rawStart ?? n.start;
    const snapped = Math.round((t - offset) / step) * step + offset;
    err += Math.abs(snapped - t);
  }
  return err / notes.length;
}

function quantizeTriplet(notes: NoteEvent[], bpm: number): QuantizeResult {
  const beat = beatSeconds(bpm);
  const step = beat / 3;
  const gridOffset = notes.length ? notes[0]!.start % step : 0;
  const units = [1, 2, 3, 4, 6];
  const placed = notes
    .map((n) => {
      const rawStart = n.rawStart ?? n.start;
      const rawDuration = n.rawDuration ?? n.duration;
      const startTick = Math.round((rawStart - gridOffset) / step);
      const rawU = Math.max(0.51, rawDuration / step);
      let best = 1;
      let bestScore = Infinity;
      for (const u of units) {
        const d = Math.abs(u - rawU);
        if (d < bestScore) {
          bestScore = d;
          best = u;
        }
      }
      return { n, startTick, units: best, rawStart, rawDuration };
    })
    .sort((a, b) => a.startTick - b.startTick);

  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1]!;
    const cur = placed[i]!;
    if (cur.startTick < prev.startTick + prev.units) {
      prev.units = Math.max(1, cur.startTick - prev.startTick);
    }
  }

  return {
    gridOffset,
    notes: placed.map((p) => ({
      ...p.n,
      start: Math.max(0, gridOffset + p.startTick * step),
      duration: p.units * step,
      rawStart: p.rawStart,
      rawDuration: p.rawDuration,
    })),
  };
}

/**
 * Display-only grid. 16th or triplet cells, whichever fits the attacks.
 * Does **not** rewrite rawStart / rawDuration — MIDI stays tick-accurate.
 */
export function assignDisplayGrid(notes: NoteEvent[], bpm: number): DisplayGridResult {
  if (!notes.length || !Number.isFinite(bpm) || bpm < 40) {
    return {
      notes: notes.map((n) => ({
        ...n,
        rawStart: n.rawStart ?? n.start,
        rawDuration: n.rawDuration ?? n.duration,
      })),
      gridOffset: 0,
      grid: "16th",
    };
  }
  const withRaw = notes.map((n) => ({
    ...n,
    rawStart: n.rawStart ?? n.start,
    rawDuration: n.rawDuration ?? n.duration,
  }));
  const six = quantizeToGrid(withRaw, bpm);
  const trip = quantizeTriplet(withRaw, bpm);
  const beat = beatSeconds(bpm);
  const sixErr = meanStartError(withRaw, beat / 4, six.gridOffset);
  const tripErr = meanStartError(withRaw, beat / 3, trip.gridOffset);
  if (tripErr + 1e-4 < sixErr * 0.82) {
    return { ...trip, grid: "triplet" };
  }
  return { ...six, grid: "16th" };
}

export function findDisplayDownbeat(notes: NoteEvent[], bpm: number): number {
  return findGridOffset(notes, bpm);
}
