import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { durationBeats, midiName, prefersFlats, type AnalysisResult, type NoteEvent } from "@/lib/melody/notes";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function NoteList({
  result,
  selectedId,
  onSelect,
  onChange,
}: {
  result: AnalysisResult;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (notes: NoteEvent[]) => void;
}) {
  const flats = prefersFlats(result.key.tonic, result.key.mode);

  function patch(id: string, fn: (n: NoteEvent) => NoteEvent) {
    onChange(result.notes.map((n) => (n.id === id ? fn(n) : n)));
  }

  function remove(id: string) {
    onChange(result.notes.filter((n) => n.id !== id));
    if (selectedId === id) onSelect(null);
  }

  if (!result.notes.length) {
    return <p className="px-1 py-8 text-center text-sm text-subtle">没有识别到稳定音高</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {result.notes.map((n, i) => {
        const active = n.id === selectedId;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onSelect(active ? null : n.id)}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg"
              }`}
            >
              <span className="w-6 font-mono text-xs text-subtle tabular-nums">{i + 1}</span>
              <span className="w-10 font-mono text-fg">{midiName(n.midi, flats)}</span>
              <span className="flex-1 font-mono text-xs tabular-nums">
                {formatTime(n.start)} · {durationBeats(n.duration, result.bpm).toFixed(2)} 拍
              </span>
            </button>
            {active ? (
              <div className="mb-1 ml-8 flex items-center gap-1 py-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="升高半音"
                  onClick={() => patch(n.id, (x) => ({ ...x, midi: Math.min(96, x.midi + 1) }))}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="降低半音"
                  onClick={() => patch(n.id, (x) => ({ ...x, midi: Math.max(24, x.midi - 1) }))}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="删除音符"
                  onClick={() => remove(n.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
