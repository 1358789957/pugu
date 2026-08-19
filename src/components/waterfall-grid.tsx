import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyEarDegrees, fromTonicForMode, parseDegreeTokens, type EarWriteMode } from "@/lib/melody/ear-degrees";
import { degreeFill, degreeInk } from "@/lib/melody/degree-colors";
import { jianpuDegree } from "@/lib/melody/leadsheet";
import { beatSeconds, resolveGridOffset, type AnalysisResult, type ListenPhraseInfo, type NoteEvent } from "@/lib/melody/notes";
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

function notesOfPhrase(result: AnalysisResult, phrase: ListenPhraseInfo, i: number): NoteEvent[] {
  return result.notes
    .filter((n) => {
      if (n.phraseIndex === i) return true;
      if (n.phraseIndex != null) return false;
      const t = n.rawStart ?? n.start;
      return t >= phrase.start && t < phrase.end;
    })
    .sort((a, b) => (a.rawStart ?? a.start) - (b.rawStart ?? b.start));
}

export function WaterfallGrid({
  result,
  currentTime,
  onSeek,
  onChangeNotes,
  className,
}: {
  result: AnalysisResult;
  currentTime: number;
  onSeek?: (t: number) => void;
  onChangeNotes?: (notes: NoteEvent[]) => void;
  className?: string;
}) {
  const phrases = useMemo(() => phrasesOf(result), [result]);
  const origin = resolveGridOffset(result);
  const sixteenth = beatSeconds(result.bpm) / 4;
  const [mode, setMode] = useState<EarWriteMode>("tonic1");
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  function applyPhrase(i: number, phrase: ListenPhraseInfo) {
    if (!onChangeNotes) return;
    const text = (drafts[i] ?? "").trim();
    if (!text) {
      toast.error("先写下这句听到的数字");
      return;
    }
    const out = applyEarDegrees({
      notes: result.notes,
      phraseIndex: i,
      text,
      fromTonic: fromTonicForMode(mode, result.key.tonic),
      phrase,
    });
    onChangeNotes(out.notes);
    if (!out.slots) {
      toast.error("这句还没有格子");
      return;
    }
    if (out.tokens.length === out.slots) {
      toast.success(`第${i + 1}句 ${out.applied} 音已写入 · 用「对照」叠原曲听`);
    } else if (out.tokens.length < out.slots) {
      toast.message(`写入 ${out.applied}/${out.slots} · 后面格子还空着`);
    } else {
      toast.message(`格子只有 ${out.slots} 个，多写的 ${out.tokens.length - out.slots} 个没装上`);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm text-fg">
        机器只做三件事：按句切开、数有几个音、排好长短格。音高你对着原曲听，填进格子，再叠着播。
      </p>
      <p className="text-xs text-subtle">
        谱面数字永远是 1=C 固定调。听写可以按「1=这首主音」写（G 大调的 1 写进去会显示成 5）。带问号的是机器没把握，别当谱。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("tonic1")}
          className={cn(
            "h-8 rounded-md border px-2.5 text-xs",
            mode === "tonic1" ? "border-accent/40 bg-elevated text-fg" : "border-border text-muted",
          )}
        >
          听写 1={result.key.name.replace(/ .*/, "")}
        </button>
        <button
          type="button"
          onClick={() => setMode("fixedC")}
          className={cn(
            "h-8 rounded-md border px-2.5 text-xs",
            mode === "fixedC" ? "border-accent/40 bg-elevated text-fg" : "border-border text-muted",
          )}
        >
          听写 1=C（格子上看到的）
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {phrases.map((p, i) => (
          <span
            key={`c${i}`}
            className="rounded-full border border-border bg-elevated px-2.5 py-1 font-mono text-xs text-fg"
          >
            第{i + 1}句 {p.noteCount} 格
            <span className="ml-1 text-subtle">{SECTION_LABEL[p.section]}</span>
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {phrases.map((phrase, i) => {
          const notes = notesOfPhrase(result, phrase, i);
          const active = currentTime >= phrase.start && currentTime < phrase.end;
          const written = notes.filter((n) => n.pitchLocked).length;
          const holes = notes.filter((n) => n.uncertain && !n.pitchLocked).length;
          return (
            <div
              key={`p${i}-${phrase.start}`}
              className={cn(
                "rounded-lg border bg-surface px-3 py-2",
                active ? "border-accent/40" : "border-border",
              )}
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs text-muted">
                  第{i + 1}句 · {phrase.noteCount} 格 · {phrase.grid === "triplet" ? "三连音格" : "16 分格"} ·{" "}
                  {SECTION_LABEL[phrase.section]}
                  {written ? ` · 已听写 ${written}` : ""}
                  {holes ? ` · ${holes} 个没把握` : ""}
                </p>
                {phrase.text ? <p className="truncate text-xs text-subtle">{phrase.text}</p> : null}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {notes.map((n) => {
                  const cells = Math.max(1, Math.round(n.duration / sixteenth));
                  const on = currentTime >= n.start && currentTime < n.start + n.duration;
                  const deg = jianpuDegree(n.midi);
                  const hole = Boolean(n.uncertain && !n.pitchLocked);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSeek?.(n.rawStart ?? n.start)}
                      title={
                        hole
                          ? `没把握 · 点这里听这一拍 · 机器听成 ${deg}`
                          : `${deg} · ${n.duration.toFixed(2)}s`
                      }
                      className={cn(
                        "h-9 min-w-[1.35rem] rounded-sm px-1 font-mono text-[13px] font-semibold leading-9",
                        on && "ring-2 ring-fg/70",
                        hole && "border border-dashed border-border/80",
                      )}
                      style={{
                        width: `${Math.min(7.2, cells * 0.72)}rem`,
                        background: hole ? "#d9d3c8" : degreeFill(n.midi),
                        color: hole ? "#5c574f" : "#14110e",
                        boxShadow: hole ? undefined : `inset 0 0 0 1px ${degreeInk(n.midi)}33`,
                      }}
                    >
                      {hole ? "?" : deg}
                    </button>
                  );
                })}
              </div>
              {onChangeNotes ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={drafts[i] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyPhrase(i, phrase);
                    }}
                    placeholder={
                      mode === "tonic1"
                        ? `听到的 ${phrase.noteCount} 个音，如 12323632712231`
                        : `1=C，${phrase.noteCount} 个，如 5 6 7 6 7 3`
                    }
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-elevated px-2 font-mono text-sm text-fg outline-none focus:border-accent/50"
                    aria-label={`第${i + 1}句听写`}
                  />
                  <Button size="sm" variant="secondary" onClick={() => applyPhrase(i, phrase)}>
                    写入这句
                  </Button>
                  <span className="font-mono text-[11px] text-subtle tabular-nums">
                    {parseDegreeTokens(drafts[i] ?? "").length}/{phrase.noteCount}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {phrases.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-sm text-muted">
          还没有按句切开的音头。上传干声或成曲后会出现格子，再听写音高。
        </p>
      ) : null}
      <p className="sr-only">
        grid-origin {origin.toFixed(3)} sixteenth {sixteenth.toFixed(3)}
      </p>
    </div>
  );
}
