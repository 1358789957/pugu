import { useEffect, useRef } from "react";
import type { AnalysisResult } from "@/lib/melody/notes";
import { cn } from "@/lib/utils";

export function PitchCurve({
  result,
  currentTime,
  className,
}: {
  result: AnalysisResult;
  currentTime: number;
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

    const track = result.pitchTrack;
    if (!track.length) return;
    const midis = track.filter((f) => f.midi > 0).map((f) => f.midi);
    const minM = (midis.length ? Math.min(...midis) : 48) - 2;
    const maxM = (midis.length ? Math.max(...midis) : 84) + 2;
    const dur = Math.max(result.duration, 0.01);

    ctx.strokeStyle = "rgba(232,216,196,0.08)";
    ctx.lineWidth = 1;
    for (let m = Math.ceil(minM); m <= maxM; m++) {
      if (m % 12 !== 0) continue;
      const y = h - ((m - minM) / (maxM - minM)) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = "rgba(232,216,196,0.85)";
    ctx.lineWidth = 1.6;
    let started = false;
    for (const f of track) {
      if (f.midi <= 0 || f.conf < 0.25) {
        started = false;
        continue;
      }
      const x = (f.t / dur) * w;
      const y = h - ((f.midi - minM) / (maxM - minM)) * h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const px = (currentTime / dur) * w;
    ctx.fillStyle = "rgba(232,216,196,0.9)";
    ctx.fillRect(px, 0, 1.5, h);
  }, [result, currentTime]);

  return <canvas ref={ref} className={cn("h-56 w-full rounded-lg border border-border bg-surface", className)} />;
}
