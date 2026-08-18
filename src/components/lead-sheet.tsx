import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  buildLeadSheet,
  keyJianpuLabel,
  leadSheetPlainText,
  type LeadLine,
  type LyricLine,
} from "@/lib/melody/leadsheet";
import { prefersFlats, type AnalysisResult } from "@/lib/melody/notes";
import { cn, downloadBlob } from "@/lib/utils";

export function LeadSheet({
  result,
  lyrics,
  draft,
  currentTime,
  onDraft,
  onApply,
  onSeek,
  title,
}: {
  result: AnalysisResult;
  lyrics: LyricLine[];
  draft: string;
  currentTime: number;
  onDraft: (v: string) => void;
  onApply: () => void;
  onSeek: (t: number) => void;
  title: string;
}) {
  const lines = useMemo(() => buildLeadSheet(result, lyrics), [result, lyrics]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const cursorStart = useMemo(() => {
    for (const line of lines) {
      for (const c of line.cells) {
        if (currentTime >= c.start && currentTime < c.start + c.duration) return c.start;
      }
    }
    return -1;
  }, [lines, currentTime]);
  useEffect(() => {
    if (cursorStart < 0) return;
    const el = sheetRef.current?.querySelector("[data-lead-cell='now']");
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursorStart]);
  const flats = prefersFlats(result.key.tonic, result.key.mode);
  const keyMark = keyJianpuLabel(result.key.tonic, flats);
  const plain = useMemo(
    () => leadSheetPlainText(lines, title || "词谱", `${keyMark} ${result.key.name}`, result.bpm),
    [lines, title, keyMark, result.key.name, result.bpm],
  );

  function copy() {
    void navigator.clipboard?.writeText(plain);
  }

  function save() {
    downloadBlob(new Blob([plain], { type: "text/plain;charset=utf-8" }), `${title || "leadsheet"}.txt`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-subtle">简谱 1=C 固定调 · 上数字 · 中歌词 · 下和弦</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={copy}>
            复制文本
          </Button>
          <Button size="sm" variant="secondary" onClick={save}>
            下载词谱
          </Button>
        </div>
      </div>

      <div ref={sheetRef} className="rounded-xl border border-border bg-paper px-5 py-5 text-ink">
        <div className="border-b border-ink/15 pb-3 text-center">
          <h2 className="font-display text-xl font-semibold tracking-wide">{title || "词谱"}</h2>
          <p className="mt-1 font-mono text-xs text-ink/60">
            {keyMark}　4/4　{Math.round(result.bpm)} 拍　{result.key.name}
          </p>
        </div>
        <div className="mt-4 space-y-5">
          {lines.map((line, i) => (
            <LeadRow
              key={`${line.start}-${i}`}
              line={line}
              currentTime={currentTime}
              onSeek={onSeek}
            />
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs text-subtle">歌词（一行一句，空格分词会对上每个音）</span>
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          rows={5}
          className="w-full resize-y rounded-lg border border-border bg-elevated px-3 py-2 font-sans text-sm text-fg outline-none focus:border-accent/50"
          placeholder="雨 の 匂 い 駅 前 の&#10;道 で 傘 の 影 に 二 人"
        />
        <Button size="sm" className="mt-2" variant="secondary" onClick={onApply}>
          按歌词重排
        </Button>
      </label>
    </div>
  );
}

function LeadRow({
  line,
  currentTime,
  onSeek,
}: {
  line: LeadLine;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const cols = Math.max(1, line.cells.length);
  const lineActive = currentTime >= line.start && currentTime < line.start + line.duration;
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-md px-1 py-1 text-left",
        lineActive ? "bg-ink/5" : "hover:bg-ink/[0.03]",
      )}
    >
      <div
        className="min-w-max"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(2.1rem, 1fr))`,
          rowGap: "0.12rem",
          columnGap: "0.1rem",
        }}
      >
        {line.cells.map((c, i) => {
          const on = currentTime >= c.start && currentTime < c.start + c.duration;
          return (
            <button
              key={`n${i}`}
              type="button"
              data-lead-cell={on ? "now" : undefined}
              onClick={() => onSeek(c.start)}
              className={cn(
                "rounded-sm text-center font-mono text-[16px] font-medium tabular-nums text-ink",
                c.bar && i > 0 && "border-l border-ink/50",
                on && "bg-ink/10",
                c.rest && "text-ink/45",
              )}
            >
              <span
                className={cn(
                  "inline-block min-w-[1.1em]",
                  c.under === 1 && "border-b border-ink",
                  c.under === 2 && "border-b-2 border-ink",
                )}
              >
                {c.jianpu || c.name}
                {c.dotted ? "." : ""}
                {c.dash ? <span className="ml-0.5 text-ink/70">{c.dash}</span> : null}
              </span>
            </button>
          );
        })}
        {line.cells.map((c, i) => {
          const on = currentTime >= c.start && currentTime < c.start + c.duration;
          return (
            <button
              key={`w${i}`}
              type="button"
              onClick={() => onSeek(c.start)}
              className={cn(
                "pt-0.5 text-center font-display text-[17px] font-medium leading-8 text-ink",
                c.bar && i > 0 && "border-l border-ink/20",
                on && "bg-ink/10",
              )}
            >
              {c.lyric || ""}
            </button>
          );
        })}
        {line.cells.map((c, i) => (
          <button
            key={`c${i}`}
            type="button"
            onClick={() => onSeek(c.start)}
            className={cn(
              "text-center font-mono text-[11px] font-semibold text-ink/65",
              c.bar && i > 0 && "border-l border-ink/20",
            )}
          >
            {c.chord}
          </button>
        ))}
      </div>
    </div>
  );
}
