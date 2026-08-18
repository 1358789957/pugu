import { useEffect, useRef } from "react";
import type { AnalysisResult, PitchFrame } from "@/lib/melody/notes";
import { NOTE_NAMES_SHARP } from "@/lib/melody/notes";
import { cn } from "@/lib/utils";

function midiName(midi: number): string {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const oct = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES_SHARP[pc]}${oct}`;
}

function yOf(midi: number, minM: number, maxM: number, h: number): number {
  return h - ((midi - minM) / Math.max(0.5, maxM - minM)) * h;
}

function drawContour(
  ctx: CanvasRenderingContext2D,
  frames: PitchFrame[],
  dur: number,
  left: number,
  w: number,
  h: number,
  minM: number,
  maxM: number,
  style: { stroke: string; width: number; dash?: number[] },
  accept: (f: PitchFrame) => boolean,
) {
  ctx.save();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (style.dash) ctx.setLineDash(style.dash);
  ctx.beginPath();
  let started = false;
  for (const f of frames) {
    if (!accept(f)) {
      started = false;
      continue;
    }
    const x = left + (f.t / dur) * w;
    const y = yOf(f.midi, minM, maxM, h);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function PitchCurve({
  result,
  currentTime,
  onSeek,
  className,
}: {
  result: AnalysisResult;
  currentTime: number;
  onSeek?: (t: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const filled = result.pitchTrack;
    const raw = result.rawPitchTrack ?? [];
    const midis = [
      ...filled.filter((f) => f.midi > 0).map((f) => f.midi),
      ...raw.filter((f) => f.midi > 0).map((f) => f.midi),
      ...result.notes.map((n) => n.midi),
    ];
    const minM = (midis.length ? Math.min(...midis) : 48) - 2;
    const maxM = (midis.length ? Math.max(...midis) : 84) + 2;
    const dur = Math.max(result.duration, 0.01);
    const left = 36;
    const plotW = Math.max(1, w - left);

    ctx.fillStyle = "rgba(232,216,196,0.06)";
    ctx.fillRect(0, 0, w, h);

    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    for (let m = Math.ceil(minM); m <= maxM; m++) {
      const y = yOf(m, minM, maxM, h);
      const isC = m % 12 === 0;
      ctx.strokeStyle = isC ? "rgba(232,216,196,0.16)" : "rgba(232,216,196,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      if (isC || m % 12 === 7) {
        ctx.fillStyle = "rgba(232,216,196,0.45)";
        ctx.fillText(midiName(m), 4, y);
      }
    }

    const acceptRaw = (f: PitchFrame) => f.midi > 0 && f.conf > 0.12 && !f.filled;
    const acceptLine = (f: PitchFrame) => f.midi > 0 && (Boolean(f.filled) || f.conf > 0.12);

    if (raw.length) {
      drawContour(
        ctx,
        raw,
        dur,
        left,
        plotW,
        h,
        minM,
        maxM,
        { stroke: "rgba(232,216,196,0.28)", width: 1.15, dash: [3, 3] },
        acceptRaw,
      );
    }

    if (filled.length) {
      drawContour(
        ctx,
        filled,
        dur,
        left,
        plotW,
        h,
        minM,
        maxM,
        { stroke: "rgba(232,216,196,0.92)", width: 2.15 },
        acceptLine,
      );
    }

    for (const n of result.notes) {
      const x0 = left + (n.start / dur) * plotW;
      const x1 = left + ((n.start + n.duration) / dur) * plotW;
      const y = yOf(n.midi, minM, maxM, h);
      ctx.fillStyle = "rgba(196, 140, 86, 0.28)";
      ctx.fillRect(x0, y - 4.5, Math.max(2, x1 - x0), 9);
      ctx.strokeStyle = "rgba(196, 140, 86, 0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(Math.max(x0 + 2, x1), y);
      ctx.stroke();
    }

    const px = left + (currentTime / dur) * plotW;
    ctx.fillStyle = "rgba(232,216,196,0.9)";
    ctx.fillRect(px, 0, 1.5, h);
  }, [result, currentTime]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-wide text-subtle">音调仪 · 时间 × 音高</p>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-fg/40" />
            原始音高
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-fg/80" />
            波长续线
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-sm bg-accent/50" />
            音符
          </span>
        </div>
      </div>
      <canvas
        ref={ref}
        className={cn(
          "h-56 w-full rounded-lg border border-border bg-surface",
          onSeek && "cursor-pointer",
        )}
        role={onSeek ? "slider" : undefined}
        aria-label="音调仪音高线"
        onClick={(e) => {
          if (!onSeek) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const dur = Math.max(result.duration, 0.01);
          const left = 36;
          const x = e.clientX - rect.left - left;
          const plotW = Math.max(1, rect.width - left);
          onSeek(Math.max(0, Math.min(dur, (x / plotW) * dur)));
        }}
      />
      <p className="text-[11px] text-subtle">
        虚线是帧级 f0。粗线用相邻稳定波长补短缺口；长静音保持断开。不是声压波形。
      </p>
    </div>
  );
}
