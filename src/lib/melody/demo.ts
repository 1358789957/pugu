/** Public-domain "Twinkle Twinkle Little Star" in C — 小星星. */
export type ScoreNote = { midi: number; beats: number };

export const TWINKLE: ScoreNote[] = [
  { midi: 60, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 67, beats: 2 },
  { midi: 65, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 60, beats: 2 },
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 62, beats: 2 },
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 62, beats: 2 },
  { midi: 60, beats: 1 },
  { midi: 60, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 67, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 67, beats: 2 },
  { midi: 65, beats: 1 },
  { midi: 65, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 64, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 62, beats: 1 },
  { midi: 60, beats: 2 },
];

export const DEMO_BPM = 96;

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Render a clear piano-like melody so the extractor has a ground-truth line. */
export async function renderDemoBuffer(): Promise<AudioBuffer> {
  const bpm = DEMO_BPM;
  const beat = 60 / bpm;
  const lead = 0.35;
  const tail = 0.6;
  let beats = 0;
  for (const n of TWINKLE) beats += n.beats;
  const duration = lead + beats * beat + tail;
  const sr = 22050;
  const ctx = new OfflineAudioContext(1, Math.ceil(duration * sr), sr);

  let t = lead;
  for (const n of TWINKLE) {
    const len = n.beats * beat;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc2.type = "sine";
    const hz = midiToHz(n.midi);
    osc.frequency.value = hz;
    osc2.frequency.value = hz * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    const peak = 0.28;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.min(0.18, len * 0.4));
    gain.gain.setValueAtTime(peak * 0.55, t + Math.max(0.05, len - 0.08));
    gain.gain.exponentialRampToValueAtTime(0.0008, t + len - 0.01);
    osc.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + len);
    osc2.stop(t + len);
    t += len;
  }

  return ctx.startRendering();
}

export const DEMO_FILE_NAME = "示例 · 小星星.wav";
