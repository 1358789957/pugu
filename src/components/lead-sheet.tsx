import { useMemo } from "react";
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
        <p className="text-xs text-subtle">简谱写法 · 上数字 · 中歌词 · 下和弦</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={copy}>
            复制文本
          </Button>
          <Button size="sm" variant="secondary" onClick={save}>
            下载词谱
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-paper px-5 py-5 text-ink">
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
              active={currentTime >= line.start && currentTime < line.start + line.duration}
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
  active,
  onSeek,
}: {
  line: LeadLine;
  active: boolean;
  onSeek: (t: number) => void;
}) {
  const cols = Math.max(1, line.cells.length);
  return (
    <button
      type="button"
      onClick={() => onSeek(line.start)}
      className={cn(
        "w-full overflow-x-auto rounded-md px-1 py-1 text-left",
        active ? "bg-ink/5" : "hover:bg-ink/[0.03]",
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
        {line.cells.map((c, i) => (
          <div
            key={`n${i}`}
            className={cn(
              "text-center font-mono text-[16px] font-medium tabular-nums text-ink",
              c.bar && i > 0 && "border-l border-ink/50",
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
              {c.dash ? <span className="ml-0.5 text-ink/70">{c.dash}</span> : null}
            </span>
          </div>
        ))}
        {line.cells.map((c, i) => (
          <div
            key={`w${i}`}
            className={cn(
              "pt-0.5 text-center font-display text-[17px] font-medium leading-8 text-ink",
              c.bar && i > 0 && "border-l border-ink/20",
            )}
          >
            {c.lyric || (line.text && i === 0 ? line.text : "")}
          </div>
        ))}
        {line.cells.map((c, i) => (
          <div
            key={`c${i}`}
            className={cn(
              "text-center font-mono text-[11px] font-semibold text-ink/65",
              c.bar && i > 0 && "border-l border-ink/20",
            )}
          >
            {c.chord}
          </div>
        ))}
      </div>
    </button>
  );
}
