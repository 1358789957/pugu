import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  buildLeadSheet,
  leadSheetPlainText,
  type LeadLine,
  type LyricLine,
} from "@/lib/melody/leadsheet";
import type { AnalysisResult } from "@/lib/melody/notes";
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
  const plain = useMemo(
    () => leadSheetPlainText(lines, title || "词谱", result.key.name, result.bpm),
    [lines, title, result.key.name, result.bpm],
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
        <p className="text-xs text-subtle">一句一行 · 上音符 · 中歌词 · 下和弦 · 点一行可定位</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={copy}>
            复制文本
          </Button>
          <Button size="sm" variant="secondary" onClick={save}>
            下载词谱
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((line, i) => (
          <LeadRow
            key={`${line.start}-${i}`}
            line={line}
            active={currentTime >= line.start && currentTime < line.start + line.duration}
            onSeek={onSeek}
          />
        ))}
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
        "w-full overflow-x-auto rounded-xl border px-3 py-3 text-left transition-colors",
        active ? "border-accent/40 bg-elevated" : "border-border bg-surface hover:border-accent/25",
      )}
    >
      <div
        className="min-w-max"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(2.4rem, 1fr))`,
          rowGap: "0.35rem",
          columnGap: "0.15rem",
        }}
      >
        {line.cells.map((c, i) => (
          <div key={`n${i}`} className="text-center font-mono text-[11px] tabular-nums text-muted">
            {c.name}
          </div>
        ))}
        {line.cells.map((c, i) => (
          <div
            key={`w${i}`}
            className="text-center font-display text-[17px] font-medium leading-8 text-fg"
          >
            {c.lyric || (line.text && i === 0 ? line.text : "")}
          </div>
        ))}
        {line.cells.map((c, i) => (
          <div key={`c${i}`} className="text-center font-mono text-xs font-medium text-accent">
            {c.chord}
          </div>
        ))}
      </div>
    </button>
  );
}
