import * as tf from "@tensorflow/tfjs";
import { BasicPitch } from "@spotify/basic-pitch";
import { notesFromActivations } from "./basic-pitch-decode";

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

    const notes = notesFromActivations(frames, onsets, contours);

    self.postMessage({ type: "done", notes });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
