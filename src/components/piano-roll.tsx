import { useEffect, useRef, useState } from "react";
import { degreeFill, degreeFillAlpha } from "@/lib/melody/degree-colors";
import { jianpuDegree } from "@/lib/melody/leadsheet";
import {
  beatSeconds,
  resolveGridOffset,
  midiName,
  prefersFlats,
  type AnalysisResult,
  type NoteEvent,
} from "@/lib/melody/notes";
import { cn } from "@/lib/utils";

const KEY_W = 48;
const ROW_H = 16;
const RULER_H = 22;
const CHORD_H = 26;
const ABS_LOW = 24;
const ABS_HIGH = 96;
const DEFAULT_LOW = 48;
const DEFAULT_HIGH = 84;

function noteRange(notes: NoteEvent[]): { low: number; high: number } {
  if (!notes.length) return { low: DEFAULT_LOW, high: DEFAULT_HIGH };
  let min = 127;
  let max = 0;
  for (const n of notes) {
    if (n.midi < min) min = n.midi;
    if (n.midi > max) max = n.midi;
  }
  min = Math.max(ABS_LOW, min - 4);
  max = Math.min(ABS_HIGH, max + 4);
  if (max - min < 24) {
    const mid = Math.round((min + max) / 2);
    min = Math.max(ABS_LOW, mid - 12);
    max = Math.min(ABS_HIGH, min + 24);
  }
  return { low: min, high: max };
}

function token(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function PianoRoll({
  result,
  currentTime,
  selectedId,
  onSelect,
  onSeek,
  onChangeNote,
  onPreview,
  className,
}: {
  result: AnalysisResult;
  currentTime: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSeek?: (t: number) => void;
  onChangeNote?: (id: string, patch: Partial<NoteEvent>) => void;
  onPreview?: (midi: number) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ id: string; startY: number; startMidi: number } | null>(null);
  const { low: LOW, high: HIGH } = noteRange(result.notes);
  const duration = Math.max(result.duration, 0.01);
  const beat = beatSeconds(result.bpm);
  const origin = resolveGridOffset(result);
  const pxPerSec = Math.max(56, Math.min(180, 820 / Math.max(4, duration))) * zoom;
  const flats = prefersFlats(result.key.tonic, result.key.mode);
  const hasChords = Boolean(result.chords?.length);
  const head = RULER_H + (hasChords ? CHORD_H : 0);
  const rows = HIGH - LOW + 1;
  const height = head + rows * ROW_H;
  const width = KEY_W + duration * pxPerSec + 48;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = token("--color-surface", "#151311");
    const elevated = token("--color-elevated", "#1d1a16");
    const border = token("--color-border", "#2a2620");
    const accent = token("--color-accent", "#e8d8c4");
    const muted = token("--color-muted", "#9b9288");
    const fg = token("--color-fg", "#f3ece3");
    const subtle = token("--color-subtle", "#6f6860");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = elevated;
    ctx.fillRect(0, 0, width, head);

    for (let midi = HIGH; midi >= LOW; midi--) {
      const y = head + (HIGH - midi) * ROW_H;
      const pc = midi % 12;
      const black = [1, 3, 6, 8, 10].includes(pc);
      ctx.fillStyle = black ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.015)";
      ctx.fillRect(KEY_W, y, width - KEY_W, ROW_H);
      if (pc === 0) {
        ctx.fillStyle = border;
        ctx.fillRect(KEY_W, y + ROW_H - 1, width - KEY_W, 1);
      }
    }

    const pxPerBeat = beat * pxPerSec;
    const show16 = pxPerBeat >= 36;
    const firstBeatIndex = -Math.ceil(origin / beat) - 1;
    const lastBeatIndex = Math.ceil((duration - origin) / beat) + 1;

    for (let i = firstBeatIndex; i <= lastBeatIndex; i++) {
      const t = origin + i * beat;
      if (t < -beat || t > duration + beat) continue;
      const x = KEY_W + t * pxPerSec;
      const inBar = ((i % 4) + 4) % 4;
      const isBar = inBar === 0;
      if (show16 && !isBar) {
        ctx.strokeStyle = "rgba(232,216,196,0.04)";
        ctx.lineWidth = 1;
        for (let s = 1; s < 4; s++) {
          const sx = KEY_W + (t + (s * beat) / 4) * pxPerSec;
          ctx.beginPath();
          ctx.moveTo(sx, head);
          ctx.lineTo(sx, height);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = isBar ? "rgba(232,216,196,0.2)" : "rgba(232,216,196,0.07)";
      ctx.lineWidth = isBar ? 1.2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, head);
      ctx.lineTo(x, height);
      ctx.stroke();
      if (isBar && x >= KEY_W - 2) {
        const barNum = Math.floor(i / 4) + 1;
        if (barNum >= 1) {
          ctx.fillStyle = muted;
          ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
          ctx.textBaseline = "middle";
          ctx.fillText(String(barNum), x + 4, RULER_H / 2);
        }
      }
    }

    ctx.fillStyle = elevated;
    ctx.fillRect(0, 0, KEY_W - 1, RULER_H);
    ctx.fillStyle = muted;
    ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(result.bpm)), 8, RULER_H / 2);

    if (hasChords) {
      ctx.fillStyle = elevated;
      ctx.fillRect(0, RULER_H, width, CHORD_H);
      ctx.fillStyle = border;
      ctx.fillRect(0, RULER_H, width, 1);
      ctx.font = "11px 'Noto Sans SC', sans-serif";
      ctx.textBaseline = "middle";
      for (const c of result.chords) {
        const x = KEY_W + c.start * pxPerSec;
        const w = Math.max(18, c.duration * pxPerSec - 2);
        const active = currentTime >= c.start && currentTime < c.start + c.duration;
        ctx.fillStyle = active ? "rgba(232,216,196,0.16)" : "rgba(232,216,196,0.05)";
        roundRect(ctx, x, RULER_H + 3, w, CHORD_H - 6, 4);
        ctx.fill();
        ctx.fillStyle = active ? fg : muted;
        ctx.fillText(c.symbol, x + 6, RULER_H + CHORD_H / 2);
      }
      ctx.fillStyle = muted;
      ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
      ctx.fillText("和弦", 8, RULER_H + CHORD_H / 2);
    }

    if (result.listenPhrases?.length) {
      ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
      ctx.textBaseline = "top";
      for (let i = 0; i < result.listenPhrases.length; i++) {
        const p = result.listenPhrases[i]!;
        const x = KEY_W + p.start * pxPerSec;
        const w = Math.max(12, (p.end - p.start) * pxPerSec);
        ctx.fillStyle = i % 2 === 0 ? "rgba(232,216,196,0.04)" : "rgba(232,216,196,0.02)";
        ctx.fillRect(x, head, w, height - head);
        ctx.fillStyle = muted;
        ctx.fillText(`第${i + 1}句 ${p.noteCount}`, x + 4, head + 4);
      }
    }

    for (const n of result.notes) {
      if (n.midi < LOW || n.midi > HIGH) continue;
      const y = head + (HIGH - n.midi) * ROW_H + 2;
      const x = KEY_W + n.start * pxPerSec;
      const w = Math.max(6, n.duration * pxPerSec - 2);
      const selected = n.id === selectedId;
      ctx.fillStyle = selected ? accent : degreeFillAlpha(n.midi, 0.42 + n.velocity * 0.4);
      roundRect(ctx, x, y, w, ROW_H - 4, 3);
      ctx.fill();
      if (w >= 16) {
        ctx.fillStyle = selected ? fg : degreeFill(n.midi);
        ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(jianpuDegree(n.midi), x + 4, y + (ROW_H - 4) / 2);
      }
      if (selected) {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    const playX = KEY_W + currentTime * pxPerSec;
    ctx.fillStyle = accent;
    ctx.fillRect(playX, 0, 1.5, height);

    for (let midi = HIGH; midi >= LOW; midi--) {
      const y = head + (HIGH - midi) * ROW_H;
      const pc = midi % 12;
      const black = [1, 3, 6, 8, 10].includes(pc);
      ctx.fillStyle = black ? token("--color-ink", "#1c1712") : token("--color-paper", "#f4eadc");
      ctx.fillRect(0, y, KEY_W - 1, ROW_H);
      ctx.fillStyle = black ? "rgba(232,216,196,0.18)" : "rgba(28,23,18,0.08)";
      ctx.fillRect(0, y + ROW_H - 1, KEY_W - 1, 1);
      if (pc === 0) {
        ctx.fillStyle = black ? muted : subtle;
        ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(midiName(midi, flats), 6, y + ROW_H / 2);
      }
    }

    ctx.fillStyle = border;
    ctx.fillRect(KEY_W - 1, 0, 1, height);
    ctx.fillRect(0, head - 1, width, 1);
  }, [result, currentTime, selectedId, width, height, pxPerSec, flats, beat, origin, hasChords, head]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || dragRef.current) return;
    const playX = KEY_W + currentTime * pxPerSec;
    const view = wrap.clientWidth;
    const sl = wrap.scrollLeft;
    if (playX > sl + view - 80 || playX < sl + KEY_W) {
      wrap.scrollLeft = Math.max(0, playX - view * 0.35);
    }
  }, [currentTime, pxPerSec]);

  function localPos(ev: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function noteAt(x: number, y: number) {
    if (y < head) return undefined;
    const t = (x - KEY_W) / pxPerSec;
    const midi = HIGH - Math.floor((y - head) / ROW_H);
    return [...result.notes]
      .reverse()
      .find((n) => n.midi === midi && t >= n.start && t <= n.start + n.duration);
  }

  function onPointerDown(ev: React.PointerEvent<HTMLCanvasElement>) {
    const pos = localPos(ev);
    if (!pos) return;
    if (pos.y < head) {
      onSeek?.(Math.max(0, Math.min(duration, (pos.x - KEY_W) / pxPerSec)));
      return;
    }
    if (pos.x < KEY_W) {
      const midi = HIGH - Math.floor((pos.y - head) / ROW_H);
      onPreview?.(midi);
      onSelect(null);
      return;
    }
    const hit = noteAt(pos.x, pos.y);
    if (hit) {
      onSelect(hit.id);
      dragRef.current = { id: hit.id, startY: pos.y, startMidi: hit.midi };
      ev.currentTarget.setPointerCapture(ev.pointerId);
      return;
    }
    onSelect(null);
    onSeek?.(Math.max(0, Math.min(duration, (pos.x - KEY_W) / pxPerSec)));
  }

  function onPointerMove(ev: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = localPos(ev);
    if (!pos) return;
    const delta = Math.round((drag.startY - pos.y) / ROW_H);
    const midi = Math.max(LOW, Math.min(HIGH, drag.startMidi + delta));
    onChangeNote?.(drag.id, { midi });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div
      ref={wrapRef}
      className={cn("overflow-auto rounded-lg border border-border bg-surface", className)}
      onWheel={(e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setZoom((z) => Math.max(0.6, Math.min(3, z + (e.deltaY > 0 ? -0.12 : 0.12))));
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="block cursor-crosshair touch-none"
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
