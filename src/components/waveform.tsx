import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function Waveform({
  peaks,
  progress = 0,
  onSeek,
  className,
}: {
  peaks: Float32Array | null;
  progress?: number;
  onSeek?: (ratio: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks || peaks.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const barW = Math.max(1, w / peaks.length);
    const playedUntil = progress * w;
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const amp = Math.max(1, peaks[i] * (h * 0.86));
      ctx.fillStyle = x < playedUntil ? "rgba(232,216,196,0.85)" : "rgba(232,216,196,0.28)";
      ctx.fillRect(x, mid - amp / 2, Math.max(1, barW - 0.4), amp);
    }
  }, [peaks, progress]);

  return (
    <canvas
      ref={ref}
      className={cn("h-12 w-full", onSeek && "cursor-pointer", className)}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "波形进度" : undefined}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
      }}
    />
  );
}
