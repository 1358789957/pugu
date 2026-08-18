import { keySignatureCount, type ChordEvent, type DetectedKey, type NoteEvent } from "./notes";
import { voicingFor } from "./chords";

export const MIDI_PPQ = 480;

function vlq(value: number): number[] {
  const bytes: number[] = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function u16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function u32(n: number): number[] {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

type MidiEvent = { tick: number; bytes: number[]; rank: number };

function encodeTrack(events: MidiEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.rank - b.rank);
  const body: number[] = [];
  let prev = 0;
  for (const ev of sorted) {
    body.push(...vlq(Math.max(0, ev.tick - prev)));
    body.push(...ev.bytes);
    prev = ev.tick;
  }
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body];
}

function meta(type: number, data: number[]): number[] {
  return [0xff, type, data.length, ...data];
}

function textMeta(type: number, text: string): number[] {
  const data = Array.from(new TextEncoder().encode(text));
  return [0xff, type, ...vlq(data.length), ...data];
}

/** GarageBand iOS is happiest with 7-bit ASCII track / marker names. */
export function asciiTrackName(text: string, fallback = "Melody"): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 32);
}

export function asciiChordSymbol(symbol: string): string {
  return asciiTrackName(symbol.replace(/♯/g, "#").replace(/♭/g, "b"), "N.C.");
}

export type MidiNote = {
  midi: number;
  tick: number;
  durationTicks: number;
  velocity: number;
};

export function noteExportTime(n: NoteEvent): { start: number; duration: number } {
  const start = Number.isFinite(n.rawStart) ? (n.rawStart as number) : n.start;
  const duration = Number.isFinite(n.rawDuration) ? (n.rawDuration as number) : n.duration;
  return { start, duration: Math.max(1e-4, duration) };
}

export function secondsToTicks(seconds: number, bpm: number, ppq = MIDI_PPQ): number {
  const safeBpm = Math.max(40, Math.min(220, bpm || 100));
  return Math.round(seconds * (safeBpm / 60) * ppq);
}

/**
 * Seconds → ticks at 1-tick resolution (the analysis time, not the engraved 16th grid).
 * The first onset is tick 0 so GarageBand opens on the melody instead of a pickup gap.
 */
export function notesToTicks(notes: NoteEvent[], bpm: number, ppq = MIDI_PPQ): MidiNote[] {
  if (!notes.length) return [];
  const first = Math.min(...notes.map((n) => noteExportTime(n).start));
  return notes.map((n) => {
    const { start, duration } = noteExportTime(n);
    return {
      midi: Math.max(0, Math.min(127, Math.round(n.midi))),
      tick: Math.max(0, secondsToTicks(start - first, bpm, ppq)),
      durationTicks: Math.max(1, secondsToTicks(duration, bpm, ppq)),
      velocity: n.velocity,
    };
  });
}

export type MidiWriteMeta = {
  bpm: number;
  title?: string;
  key?: Pick<DetectedKey, "tonic" | "mode">;
  chords?: ChordEvent[];
};

/**
 * Type-1 MIDI for GarageBand: conductor (tempo / 4/4 / key) + piano melody + optional chord pad.
 * Melody onsets are tick-accurate; chords stay on a beat grid.
 */
export function notesToMidi(notes: NoteEvent[], metaInfo: MidiWriteMeta | number): Uint8Array {
  const info: MidiWriteMeta = typeof metaInfo === "number" ? { bpm: metaInfo } : metaInfo;
  const bpm = Math.max(40, Math.min(220, info.bpm || 100));
  const ppq = MIDI_PPQ;
  const usec = Math.round(60_000_000 / bpm);
  const sf = keySignatureCount(info.key?.tonic ?? 0, info.key?.mode ?? "major") & 0xff;
  const mi = info.key?.mode === "minor" ? 1 : 0;
  const title = asciiTrackName(info.title || "Melody");

  const tempoTrack: MidiEvent[] = [
    { tick: 0, rank: 0, bytes: meta(0x51, [(usec >> 16) & 0xff, (usec >> 8) & 0xff, usec & 0xff]) },
    { tick: 0, rank: 1, bytes: meta(0x58, [0x04, 0x02, 0x18, 0x08]) },
    { tick: 0, rank: 2, bytes: meta(0x59, [sf, mi]) },
    { tick: 0, rank: 9, bytes: meta(0x2f, []) },
  ];

  const melody: MidiEvent[] = [
    { tick: 0, rank: 0, bytes: textMeta(0x03, title) },
    { tick: 0, rank: 1, bytes: [0xc0, 0x00] },
  ];

  const timed = notesToTicks(notes, bpm, ppq);
  for (const n of timed) {
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 110 + 12)));
    melody.push({ tick: n.tick, rank: 5, bytes: [0x90, n.midi, vel] });
    melody.push({ tick: n.tick + n.durationTicks, rank: 4, bytes: [0x80, n.midi, 0x00] });
  }

  const lastTick = melody.reduce((m, ev) => Math.max(m, ev.tick), 0);
  melody.push({ tick: lastTick, rank: 9, bytes: meta(0x2f, []) });

  const tracks = [encodeTrack(tempoTrack), encodeTrack(melody)];

  if (info.chords?.length) {
    const firstNote = notes.length ? Math.min(...notes.map((n) => noteExportTime(n).start)) : 0;
    const beat = 60 / bpm;
    const chordTrack: MidiEvent[] = [
      { tick: 0, rank: 0, bytes: textMeta(0x03, "Chords") },
      { tick: 0, rank: 1, bytes: [0xc1, 48] },
    ];
    for (const c of info.chords) {
      const startBeat = Math.max(0, Math.round((c.start - firstNote) / beat));
      const durBeat = Math.max(1, Math.round(c.duration / beat));
      const tick = startBeat * ppq;
      const dur = durBeat * ppq;
      chordTrack.push({ tick, rank: 2, bytes: textMeta(0x06, asciiChordSymbol(c.symbol)) });
      for (const m of voicingFor(c.root, c.quality)) {
        chordTrack.push({ tick, rank: 5, bytes: [0x91, m, 0x46] });
        chordTrack.push({ tick: tick + dur, rank: 4, bytes: [0x81, m, 0x00] });
      }
    }
    const lastC = chordTrack.reduce((m, ev) => Math.max(m, ev.tick), 0);
    chordTrack.push({ tick: lastC, rank: 9, bytes: meta(0x2f, []) });
    tracks.push(encodeTrack(chordTrack));
  }

  const bytes = [
    0x4d,
    0x54,
    0x68,
    0x64,
    ...u32(6),
    ...u16(1),
    ...u16(tracks.length),
    ...u16(ppq),
    ...tracks.flat(),
  ];
  return new Uint8Array(bytes);
}

export function midiBlob(notes: NoteEvent[], metaInfo: MidiWriteMeta | number): Blob {
  const bytes = notesToMidi(notes, metaInfo);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "audio/midi" });
}

export function notesToJson(
  notes: NoteEvent[],
  metaInfo: { title: string; key: string; bpm: number; chords?: ChordEvent[] },
) {
  const ticks = notesToTicks(notes, metaInfo.bpm);
  return JSON.stringify(
    {
      title: metaInfo.title,
      key: metaInfo.key,
      bpm: metaInfo.bpm,
      ppq: MIDI_PPQ,
      progression: (metaInfo.chords ?? []).map((c) => c.symbol).join(" – "),
      chords: (metaInfo.chords ?? []).map((c) => ({
        symbol: c.symbol,
        roman: c.roman,
        start: Number(c.start.toFixed(3)),
        duration: Number(c.duration.toFixed(3)),
      })),
      notes: notes.map((n, i) => {
        const raw = noteExportTime(n);
        return {
          pitch: n.midi,
          start: Number(n.start.toFixed(4)),
          duration: Number(n.duration.toFixed(4)),
          rawStart: Number(raw.start.toFixed(4)),
          rawDuration: Number(raw.duration.toFixed(4)),
          velocity: Number(n.velocity.toFixed(3)),
          tick: ticks[i]?.tick ?? 0,
          durationTicks: ticks[i]?.durationTicks ?? 0,
        };
      }),
    },
    null,
    2,
  );
}
