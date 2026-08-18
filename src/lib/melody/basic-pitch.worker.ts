import * as tf from "@tensorflow/tfjs";
import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";
import { BASIC_PITCH_OPTS } from "./basic-pitch-options";

type InMsg = {
  audio: Float32Array;
  modelUrl: string;
};

async function readyBackend() {
  for (const name of ["webgl", "cpu"] as const) {
    try {
      if (await tf.setBackend(name)) {
        await tf.ready();
        return;
      }
    } catch {
      // try the next backend
    }
  }
  await tf.ready();
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  try {
    const { audio, modelUrl } = ev.data;
    await readyBackend();

    const model = new BasicPitch(modelUrl);
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    await model.evaluateModel(
      audio,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (pct) => {
        self.postMessage({ type: "progress", pct });
      },
    );

    const notes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(
          frames,
          onsets,
          BASIC_PITCH_OPTS.onsetThresh,
          BASIC_PITCH_OPTS.frameThresh,
          BASIC_PITCH_OPTS.minNoteLen,
          BASIC_PITCH_OPTS.inferOnsets,
          BASIC_PITCH_OPTS.maxFreq,
          BASIC_PITCH_OPTS.minFreq,
          BASIC_PITCH_OPTS.melodiaTrick,
        ),
      ),
    );

    self.postMessage({ type: "done", notes });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
