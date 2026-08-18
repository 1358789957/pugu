import { Pause, Play, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { PlayMode } from "@/lib/melody/synth";
import { cn, formatTime } from "@/lib/utils";

export function PlayerBar({
  playing,
  currentTime,
  duration,
  mode,
  loop,
  canPlaySource,
  canPlayVocals,
  onToggle,
  onSeek,
  onMode,
  onLoop,
}: {
  playing: boolean;
  currentTime: number;
  duration: number;
  mode: PlayMode;
  loop: boolean;
  canPlaySource: boolean;
  canPlayVocals?: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onMode: (m: PlayMode) => void;
  onLoop: (next: boolean) => void;
}) {
  const modes: { id: PlayMode; label: string; disabled?: boolean }[] = [
    { id: "melody", label: "旋律" },
    { id: "vocals", label: "干声", disabled: !canPlayVocals },
    { id: "source", label: "原曲", disabled: !canPlaySource },
    { id: "both", label: "对照", disabled: !canPlaySource && !canPlayVocals },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="paper"
          aria-label={playing ? "暂停" : "播放"}
          onClick={onToggle}
          className="shrink-0"
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </Button>
        <Button
          size="icon"
          variant={loop ? "secondary" : "ghost"}
          aria-label={loop ? "关闭循环" : "循环播放"}
          aria-pressed={loop}
          onClick={() => onLoop(!loop)}
          className="shrink-0"
        >
          <Repeat className="size-4" />
        </Button>
      </div>
      <div className="min-w-0 flex-1">
        <Slider
          min={0}
          max={Math.max(0.01, duration)}
          step={0.01}
          value={[Math.min(currentTime, duration)]}
          onValueChange={(v) => onSeek(v[0] ?? 0)}
        />
        <div className="mt-1 flex justify-between font-mono text-xs text-subtle tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <div className="flex h-11 w-full items-center rounded-md border border-border bg-bg p-0.5 sm:h-10 sm:w-auto">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={m.disabled}
            onClick={() => onMode(m.id)}
            className={cn(
              "h-10 flex-1 rounded-sm px-3 text-sm text-muted disabled:opacity-30 sm:h-9 sm:flex-none",
              mode === m.id && "bg-elevated text-fg",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
