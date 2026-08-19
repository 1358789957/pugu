import { useMemo } from "react";
import { degreeFill, degreeInk } from "@/lib/melody/degree-colors";
import { jianpuDegree } from "@/lib/melody/leadsheet";
import { beatSeconds, resolveGridOffset, type AnalysisResult, type ListenPhraseInfo } from "@/lib/melody/notes";
import { cn } from "@/lib/utils";

function phrasesOf(result: AnalysisResult): ListenPhraseInfo[] {
  if (result.listenPhrases?.length) return result.listenPhrases;
  const notes = result.notes.filter((n) => n.duration >= 0.08);
  if (!notes.length) return [];
  const out: ListenPhraseInfo[] = [];
  let start = notes[0]!.start;
  let end = notes[0]!.start + notes[0]!.duration;
  let count = 1;
  for (let i = 1; i < notes.length; i++) {
    const n = notes[i]!;
    const gap = n.start - end;
    if (gap > 0.42 || n.start - start > 7.2) {
      out.push({ start, end, noteCount: count, section: "other", grid: "16th" });
      start = n.start;
      count = 0;
    }
    count += 1;
    end = Math.max(end, n.start + n.duration);
  }
  out.push({ start, end, noteCount: count, section: "other", grid: "16th" });
  return out;
}

const SECTION_LABEL: Record<ListenPhraseInfo["section"], string> = {
  verse: "主歌",
  pre: "预副",
  chorus: "副歌",
  other: "乐句",
};

export function WaterfallGrid({
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
  const phrases = useMemo(() => phrasesOf(result), [result]);
  const origin = resolveGridOffset(result);
  const sixteenth = beatSeconds(result.bpm) / 4;

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-subtle">
        瀑布幕布 · 按句着色（C=1 固定调）· 格子只用于显示 · 导出 MIDI 仍是原始音头
      </p>
      <div className="flex flex-wrap gap-2">
        {phrases.map((p, i) => (
          <span
            key={`c${i}`}
            className="rounded-full border border-border bg-elevated px-2.5 py-1 font-mono text-xs text-fg"
          >
            第{i + 1}句 {p.noteCount} 音
            <span className="ml-1 text-subtle">{SECTION_LABEL[p.section]}</span>
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {phrases.map((phrase, i) => {
          const notes = result.notes.filter((n) => {
            if (n.phraseIndex === i) return true;
            if (n.phraseIndex != null) return false;
            const t = n.start;
            return t >= phrase.start && t < phrase.end;
          });
          const active = currentTime >= phrase.start && currentTime < phrase.end;
          return (
            <div
              key={`p${i}-${phrase.start}`}
              className={cn(
                "rounded-lg border bg-surface px-3 py-2",
                active ? "border-accent/40" : "border-border",
              )}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted">
                  第{i + 1}句 · {phrase.noteCount} 音 · {phrase.grid === "triplet" ? "三连音格" : "16 分格"} ·{" "}
                  {SECTION_LABEL[phrase.section]}
                </p>
                {phrase.text ? <p className="truncate text-xs text-subtle">{phrase.text}</p> : null}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {notes.map((n) => {
                  const cells = Math.max(1, Math.round(n.duration / sixteenth));
                  const on = currentTime >= n.start && currentTime < n.start + n.duration;
                  const deg = jianpuDegree(n.midi);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSeek?.(n.rawStart ?? n.start)}
                      title={`${deg} · ${n.duration.toFixed(2)}s`}
                      className={cn(
                        "h-9 min-w-[1.35rem] rounded-sm px-1 font-mono text-[13px] font-semibold leading-9",
                        on && "ring-2 ring-fg/70",
                      )}
                      style={{
                        width: `${Math.min(7.2, cells * 0.72)}rem`,
                        background: degreeFill(n.midi),
                        color: "#14110e",
                        boxShadow: `inset 0 0 0 1px ${degreeInk(n.midi)}33`,
                      }}
                    >
                      {deg}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {phrases.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-sm text-muted">
          还没有按句切开的音头。上传干声或成曲后会出现着色格子。
        </p>
      ) : null}
      <p className="sr-only">
        grid-origin {origin.toFixed(3)} sixteenth {sixteenth.toFixed(3)}
      </p>
    </div>
  );
}
