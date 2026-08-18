import { useMemo } from "react";
import {
  durationBeats,
  keySignatureMarks,
  midiName,
  prefersFlats,
  printedAccidental,
  type AnalysisResult,
  type NoteEvent,
} from "@/lib/melody/notes";
import { cn } from "@/lib/utils";

const STAFF_TOP = 40;
const LINE_GAP = 12;
const CLEF_W = 48;
const SIG_SLOT = 12;
const LEFT_PAD = 16;
const NOTE_MIN = 22;

function diatonicFromC0(midi: number): number {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const dia = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc];
  return oct * 7 + dia;
}

function staffY(midi: number): number {
  const stepsFromE4 = diatonicFromC0(midi) - diatonicFromC0(64);
  return STAFF_TOP + 4 * LINE_GAP - stepsFromE4 * (LINE_GAP / 2);
}

function c0DiatonicToMidi(step: number): number {
  const oct = Math.floor(step / 7);
  const dia = ((step % 7) + 7) % 7;
  const pc = [0, 2, 4, 5, 7, 9, 11][dia];
  return (oct + 1) * 12 + pc;
}

function ledgerLines(midi: number): number[] {
  const lines: number[] = [];
  if (midi < 64) {
    for (let step = diatonicFromC0(60); step >= diatonicFromC0(midi); step -= 2) {
      lines.push(c0DiatonicToMidi(step));
    }
  }
  if (midi > 79) {
    for (let step = diatonicFromC0(81); step <= diatonicFromC0(midi); step += 2) {
      lines.push(c0DiatonicToMidi(step));
    }
  }
  return lines;
}

function TrebleClef() {
  return (
    <g
      transform="translate(12,8)"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M24 8
        C 20 30 32 40 31 62
        C 30 80 16 88 10 76
        C 5 66 12 56 22 60
        C 30 63 31 76 20 80" />
      <path d="M24 8
        C 28 6 34 12 32 24
        C 30 38 20 44 16 36" />
      <path d="M20 80
        C 20 96 24 106 24 114
        C 24 122 16 126 12 122
        C 8 118 12 112 16 114" />
      <circle cx="12" cy="118" r="2.4" fill="currentColor" stroke="none" />
    </g>
  );
}

type System = { notes: NoteEvent[]; start: number; end: number };

function layoutSystems(notes: NoteEvent[], bpm: number): System[] {
  if (!notes.length) return [];
  const beat = 60 / Math.max(40, bpm);
  const measure = beat * 4;
  const last = notes[notes.length - 1];
  const total = last.start + last.duration;
  const first = Math.max(0, notes[0].start - (notes[0].start % measure));
  const systems: System[] = [];
  const measuresPer = 4;
  for (let t = first; t < total + 0.001; t += measure * measuresPer) {
    const end = t + measure * measuresPer;
    const chunk = notes.filter((n) => n.start >= t && n.start < end);
    if (chunk.length) systems.push({ notes: chunk, start: t, end });
  }
  return systems;
}

export function StaffView({
  result,
  selectedId,
  currentTime,
  onSelect,
  className,
}: {
  result: AnalysisResult;
  selectedId: string | null;
  currentTime?: number;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const flats = prefersFlats(result.key.tonic, result.key.mode);
  const marks = keySignatureMarks(result.key.tonic, result.key.mode);
  const systems = useMemo(
    () => layoutSystems(result.notes, result.bpm),
    [result.notes, result.bpm],
  );
  const beat = 60 / Math.max(40, result.bpm);
  const measure = beat * 4;
  const left = LEFT_PAD + CLEF_W + marks.length * SIG_SLOT + 10;

  if (!result.notes.length) {
    return (
      <div
        className={cn(
          "grid min-h-64 place-items-center rounded-lg bg-paper text-sm text-ink/50",
          className,
        )}
      >
        还没有音符
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 overflow-auto rounded-lg bg-paper p-4 text-ink sm:p-6", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-medium">{result.key.name}</p>
        <p className="font-mono text-xs text-ink/50">
          {result.bpm} BPM · 4/4 · {result.notes.length} 音
        </p>
      </div>
      {systems.map((sys, si) => {
        const span = Math.max(measure, sys.end - sys.start);
        const usable = Math.max(420, sys.notes.length * NOTE_MIN + 80);
        const width = left + usable + 24;
        const height = 132;
        const xAt = (t: number) => left + ((t - sys.start) / span) * usable;
        const playIn = currentTime !== undefined && currentTime >= sys.start && currentTime < sys.end;
        return (
          <svg
            key={si}
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={`五线谱 第 ${si + 1} 行`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1={12}
                x2={width - 12}
                y1={STAFF_TOP + i * LINE_GAP}
                y2={STAFF_TOP + i * LINE_GAP}
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.5"
              />
            ))}
            <TrebleClef />
            {marks.map((m, i) => (
              <text
                key={`${m.mark}${i}`}
                x={LEFT_PAD + CLEF_W + i * SIG_SLOT}
                y={staffY(m.midi) + 5}
                fontSize="16"
                fontFamily="Georgia, serif"
                fill="currentColor"
              >
                {m.mark}
              </text>
            ))}
            {Array.from({ length: Math.floor(span / measure) + 1 }, (_, i) => {
              const x = xAt(sys.start + i * measure);
              return (
                <line
                  key={`bar${i}`}
                  x1={x}
                  x2={x}
                  y1={STAFF_TOP}
                  y2={STAFF_TOP + 4 * LINE_GAP}
                  stroke="currentColor"
                  strokeWidth={i === 0 ? 1.4 : 1}
                  opacity="0.45"
                />
              );
            })}
            {sys.notes.map((n) => {
              const x = xAt(n.start);
              const y = staffY(n.midi);
              const acc = printedAccidental(n.midi, result.key.tonic, result.key.mode);
              const ledgers = ledgerLines(n.midi);
              const stemDown = n.midi >= 71;
              const beats = durationBeats(n.duration, result.bpm);
              const hollow = beats >= 1.75;
              const flagged = beats < 0.85;
              return (
                <g key={n.id}>
                  {ledgers.map((m) => (
                    <line
                      key={m}
                      x1={x - 11}
                      x2={x + 11}
                      y1={staffY(m)}
                      y2={staffY(m)}
                      stroke="currentColor"
                      strokeWidth="1"
                      opacity="0.5"
                    />
                  ))}
                  {acc ? (
                    <text
                      x={x - 16}
                      y={y + 4}
                      fontSize="13"
                      fontFamily="Georgia, serif"
                      fill="currentColor"
                    >
                      {acc}
                    </text>
                  ) : null}
                  <g
                    onClick={() => onSelect(n.id === selectedId ? null : n.id)}
                    className="cursor-pointer"
                  >
                    <ellipse
                      cx={x}
                      cy={y}
                      rx="7.2"
                      ry="5.1"
                      transform={`rotate(-18 ${x} ${y})`}
                      fill={hollow ? "none" : "currentColor"}
                      stroke="currentColor"
                      strokeWidth={hollow ? 1.4 : 0}
                      opacity={n.id === selectedId ? 1 : 0.92}
                    />
                    {n.id === selectedId ? (
                      <ellipse
                        cx={x}
                        cy={y}
                        rx="10"
                        ry="8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        opacity="0.4"
                      />
                    ) : null}
                    <line
                      x1={x + (stemDown ? -6.4 : 6.4)}
                      x2={x + (stemDown ? -6.4 : 6.4)}
                      y1={y}
                      y2={stemDown ? y + 32 : y - 32}
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    {flagged ? (
                      <path
                        d={
                          stemDown
                            ? `M ${x - 6.4} ${y + 32} c 8 2 12 8 10 14`
                            : `M ${x + 6.4} ${y - 32} c 8 2 12 8 10 14`
                        }
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    ) : null}
                  </g>
                  <title>{midiName(n.midi, flats)}</title>
                </g>
              );
            })}
            {playIn ? (
              <line
                x1={xAt(currentTime)}
                x2={xAt(currentTime)}
                y1={STAFF_TOP - 8}
                y2={STAFF_TOP + 4 * LINE_GAP + 8}
                stroke="currentColor"
                strokeWidth="1.4"
                opacity="0.55"
              />
            ) : null}
          </svg>
        );
      })}
    </div>
  );
}
