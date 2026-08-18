import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";
import {
  BASIC_PITCH_OPTS,
  type BasicPitchDecodeOpts,
  type BasicPitchNote,
} from "./basic-pitch-options";

export function notesFromActivations(
  frames: number[][],
  onsets: number[][],
  contours: number[][],
): BasicPitchNote[] {
  const primary = decodePass(frames, onsets, BASIC_PITCH_OPTS);
  return noteFramesToTime(addPitchBendsToNoteEvents(contours, primary));
}

function decodePass(frames: number[][], onsets: number[][], opts: BasicPitchDecodeOpts) {
  return outputToNotesPoly(
    frames,
    onsets,
    opts.onsetThresh,
    opts.frameThresh,
    opts.minNoteLen,
    opts.inferOnsets,
    opts.maxFreq,
    opts.minFreq,
    opts.melodiaTrick,
    opts.energyTolerance,
  );
}
