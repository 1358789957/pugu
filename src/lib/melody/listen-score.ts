import {
  makeNoteId,
  resetNoteIds,
  type ListenPhraseInfo,
  type NoteEvent,
  type PitchFrame,
} from "./notes";
import { contourToPitchFrames, type ContourFrame, buildPitchContour } from "./pitch-contour";
import { assignDisplayGrid } from "./display-grid";
import {
  detectVocalPhrasesFromFrames,
  onsetsFromContour,
  pairLyricLines,
  type PhraseOnset,
  type PhraseWindow,
} from "./phrase-onsets";
import { fillUncertainPitches, guessSection } from "./pitch-fill";

export type ListenPhrase = ListenPhraseInfo;

export type ListenScoreOptions = {
  samples: Float32Array;
  sampleRate: number;
  /** Lyric-line windows. Extra detections stay inside their line. */
  phrases?: PhraseWindow[];
  lyrics?: { start?: number; end?: number; text: string }[];
  bpm?: number;
  /** When true, `lyrics` times are the cut. Default: energy cut, then pair text. */
  useLyricWindows?: boolean;
};

export type ListenScoreResult = {
  notes: NoteEvent[];
  phrases: ListenPhrase[];
  pitchTrack: PitchFrame[];
  rawPitchTrack: PitchFrame[];
  contour: ContourFrame[];
  bpm: number;
};

function bpmFromOnsets(onsets: PhraseOnset[]): number {
  if (onsets.length < 4) return 100;
  const ioi: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i]!.t - onsets[i - 1]!.t;
    if (d > 0.12 && d < 2.4) ioi.push(d);
  }
  if (ioi.length < 3) return 100;
  const bins = new Map<number, number>();
  for (const d of ioi) {
    let bpm = 60 / d;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    const key = Math.round(bpm);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let best = 100;
  let bestN = 0;
  for (const [bpm, n] of bins) {
    const neighbors = n + (bins.get(bpm - 1) ?? 0) + (bins.get(bpm + 1) ?? 0);
    const comfort = bpm >= 80 && bpm <= 132 ? 1.25 : 1;
    const score = neighbors * comfort;
    if (score > bestN) {
      bestN = score;
      best = bpm;
    }
  }
  return best;
}

function windowsFromLyrics(lyrics: { start?: number; end?: number; text: string }[]): PhraseWindow[] {
  return lyrics
    .filter((l) => Number.isFinite(l.start) && Number.isFinite(l.end) && (l.end as number) > (l.start as number))
    .map((l) => ({ start: l.start as number, end: l.end as number, text: l.text }));
}

function onsetToNote(o: PhraseOnset, phraseIndex: number): NoteEvent {
  return {
    id: makeNoteId(),
    midi: o.midiHint || 60,
    start: o.t,
    duration: o.duration,
    velocity: Math.max(0.18, Math.min(1, o.rms * 6)),
    confidence: o.conf,
    rawStart: o.t,
    rawDuration: o.duration,
    phraseIndex,
  };
}

/**
 * Real-audio listen-to-score, in lock order:
 *   1. Cut by lyric line / vocal phrase (phrase-local).
 *   2. Get each phrase's NOTE COUNT from vocal onsets / f0 re-attacks.
 *   3. Place durations on a display grid (16th / triplet). Color later in UI.
 *   4. Only then fill uncertain pitches (motive, smoothness, section).
 *
 * MIDI export must keep rawStart / rawDuration. This function never snaps those.
 */
export function listenToScore(opts: ListenScoreOptions): ListenScoreResult {
  const { samples, sampleRate } = opts;
  const contour = buildPitchContour(samples, sampleRate, 0, 0.01);
  const lyricWindows = opts.lyrics ? windowsFromLyrics(opts.lyrics) : [];
  let windows: PhraseWindow[];
  if (opts.phrases?.length) {
    windows = opts.phrases;
  } else if (opts.useLyricWindows && lyricWindows.length) {
    windows = lyricWindows;
  } else {
    windows = pairLyricLines(detectVocalPhrasesFromFrames(contour), opts.lyrics ?? []);
  }
  if (!windows.length) {
    windows = [{ start: 0, end: samples.length / sampleRate }];
  }

  resetNoteIds();
  const phraseOnsets: PhraseOnset[][] = [];
  const allOnsets: PhraseOnset[] = [];

  // 1–2. Phrase-local count. Extras cannot migrate into a later window.
  for (const w of windows) {
    const counted = onsetsFromContour(contour, w);
    allOnsets.push(...counted.onsets);
    phraseOnsets.push(counted.onsets);
  }

  const bpm = opts.bpm ?? bpmFromOnsets(allOnsets);
  const phrases: ListenPhrase[] = [];
  const slotted: NoteEvent[] = [];

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    const onsets = phraseOnsets[i] ?? [];
    const rawNotes = onsets.map((o) => onsetToNote(o, i));
    // 3. Display grid only — raw times stay on the note.
    const gridded = assignDisplayGrid(rawNotes, bpm);
    phrases.push({
      start: w.start,
      end: w.end,
      text: w.text,
      noteCount: gridded.notes.length,
      section: guessSection(i, windows.length, w.text),
      grid: gridded.grid,
    });
    slotted.push(...gridded.notes);
  }

  // 4. Pitch fill after count + grid.
  const filled = fillUncertainPitches(
    slotted,
    contour,
    phrases.map((p) => ({ start: p.start, end: p.end, section: p.section })),
  );

  return {
    notes: filled,
    phrases,
    pitchTrack: contourToPitchFrames(contour),
    rawPitchTrack: contourToPitchFrames(contour.filter((f) => !f.filled)),
    contour,
    bpm,
  };
}
