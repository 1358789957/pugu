import { useEffect, useMemo, useRef } from "react";
import { chordsInSpan, notateAnalysis, type NotationEvent, type NotationMeasure } from "@/lib/melody/notation";
import { keySignatureMarks, midiName, prefersFlats, type AnalysisResult } from "@/lib/melody/notes";
import { cn } from "@/lib/utils";

const STAFF_TOP = 48;
const LINE_GAP = 12;
const CLEF_W = 48;
const SIG_SLOT = 12;
const LEFT_PAD = 16;
const MEASURE_W = 168;

function staffY(midi: number): number {
  const stepsFromE4 = diatonicFromC0(midi) - diatonicFromC0(64);
  return STAFF_TOP + 4 * LINE_GAP - stepsFromE4 * (LINE_GAP / 2);
}

function diatonicFromC0(midi: number): number {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const dia = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc];
  return oct * 7 + dia;
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

function TimeSignature({ x }: { x: number }) {
  return (
    <g fontFamily="Georgia, serif" fontSize="18" fill="currentColor" textAnchor="middle">
      <text x={x} y={STAFF_TOP + LINE_GAP + 4}>
        4
      </text>
      <text x={x} y={STAFF_TOP + 3 * LINE_GAP + 4}>
        4
      </text>
    </g>
  );
}

function RestGlyph({ x, units }: { x: number; units: number }) {
  const mid = STAFF_TOP + 2 * LINE_GAP;
  if (units >= 16) {
    return <rect x={x - 7} y={mid - 10} width="14" height="6" fill="currentColor" />;
  }
  if (units >= 8) {
    return <rect x={x - 7} y={mid} width="14" height="6" fill="currentColor" />;
  }
  if (units >= 4) {
    return (
      <text x={x} y={mid + 5} textAnchor="middle" fontSize="20" fontFamily="Georgia, serif" fill="currentColor">
        𝄽
      </text>
    );
  }
  const extra = units <= 1;
  return (
    <g stroke="currentColor" fill="currentColor" strokeWidth="1.2">
      <path d={`M ${x - 1} ${mid + 10} L ${x + 4} ${mid - 10}`} fill="none" />
      <circle cx={x - 3} cy={mid - 2} r="2.2" />
      {extra ? <circle cx={x - 3} cy={mid + 5} r="2.2" /> : null}
    </g>
  );
}

type System = { measures: NotationMeasure[]; start: number; end: number };

function layoutSystems(measures: NotationMeasure[], bpm: number): System[] {
  if (!measures.length) return [];
  const bar = (60 / Math.max(40, bpm)) * 4;
  const systems: System[] = [];
  for (let i = 0; i < measures.length; i += 4) {
    const chunk = measures.slice(i, i + 4);
    const start = chunk[0]!.start;
    const end = chunk[chunk.length - 1]!.start + bar;
    systems.push({ measures: chunk, start, end });
  }
  return systems;
}

function eventX(measureLeft: number, ev: NotationEvent): number {
  return measureLeft + 16 + (ev.posInMeasure / 16) * (MEASURE_W - 22);
}

export function StaffView({
  result,
  selectedId,
  currentTime,
  onSelect,
  onSeek,
  className,
}: {
  result: AnalysisResult;
  selectedId: string | null;
  currentTime?: number;
  onSelect: (id: string | null) => void;
  onSeek?: (t: number) => void;
  className?: string;
}) {
  const flats = prefersFlats(result.key.tonic, result.key.mode);
  const marks = keySignatureMarks(result.key.tonic, result.key.mode);
  const measures = useMemo(() => notateAnalysis(result), [result]);
  const systems = useMemo(() => layoutSystems(measures, result.bpm), [measures, result.bpm]);
  const left = LEFT_PAD + CLEF_W + marks.length * SIG_SLOT + 22;
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeSys = systems.findIndex(
    (sys) => currentTime !== undefined && currentTime >= sys.start && currentTime < sys.end,
  );

  useEffect(() => {
    if (activeSys < 0) return;
    const el = wrapRef.current?.querySelector(`[data-staff-sys="${activeSys}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSys]);

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
    <div
      ref={wrapRef}
      className={cn("space-y-3 overflow-auto rounded-lg bg-paper p-4 text-ink sm:p-6", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-medium">{result.key.name}</p>
        <p className="font-mono text-xs text-ink/50">
          {Math.round(result.bpm)} BPM · 4/4 · {result.notes.length} 音
        </p>
      </div>
      {systems.map((sys, si) => {
        const width = left + sys.measures.length * MEASURE_W + 28;
        const height = 168;
        const playIn = currentTime !== undefined && currentTime >= sys.start && currentTime < sys.end;
        const xAtTime = (t: number) => {
          const i = sys.measures.findIndex((m, idx) => {
            const end = (sys.measures[idx + 1]?.start ?? sys.end) - 1e-6;
            return t >= m.start && t <= end;
          });
          const mi = i < 0 ? (t < sys.start ? 0 : sys.measures.length - 1) : i;
          const m = sys.measures[mi]!;
          const span = Math.max(1e-6, (60 / Math.max(40, result.bpm)) * 4);
          const local = Math.max(0, Math.min(0.999, (t - m.start) / span));
          return left + mi * MEASURE_W + local * MEASURE_W;
        };

        return (
          <svg
            key={si}
            data-staff-sys={si}
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full cursor-text"
            role="img"
            aria-label={`五线谱 第 ${si + 1} 行`}
            onClick={(e) => {
              if (!onSeek) return;
              const svg = e.currentTarget;
              const ctm = svg.getScreenCTM();
              if (!ctm) return;
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const loc = pt.matrixTransform(ctm.inverse());
              const x = loc.x;
              if (x < left) {
                onSeek(sys.start);
                return;
              }
              const mi = Math.max(0, Math.min(sys.measures.length - 1, Math.floor((x - left) / MEASURE_W)));
              const m = sys.measures[mi]!;
              const frac = Math.max(0, Math.min(1, (x - left - mi * MEASURE_W) / MEASURE_W));
              const bar = (60 / Math.max(40, result.bpm)) * 4;
              onSeek(Math.max(0, m.start + frac * bar));
            }}
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
            <TimeSignature x={LEFT_PAD + CLEF_W + marks.length * SIG_SLOT + 10} />
            <text
              x={12}
              y={20}
              fontSize="11"
              fontFamily="IBM Plex Mono, ui-monospace, monospace"
              fill="currentColor"
              opacity="0.45"
            >
              {sys.measures[0]!.index + 1}
            </text>
            {sys.measures.map((measure, mi) => {
              const mx = left + mi * MEASURE_W;
              const barChords = chordsInSpan(result.chords, measure.start, measure.start + (60 / Math.max(40, result.bpm)) * 4);
              return (
                <g key={measure.index}>
                  <line
                    x1={mx}
                    x2={mx}
                    y1={STAFF_TOP}
                    y2={STAFF_TOP + 4 * LINE_GAP}
                    stroke="currentColor"
                    strokeWidth={mi === 0 ? 1.4 : 1}
                    opacity="0.45"
                  />
                  {barChords.map((c) => {
                    const frac = Math.max(0, (c.start - measure.start) / Math.max(1e-6, (60 / result.bpm) * 4));
                    return (
                      <text
                        key={`${c.start}-${c.symbol}`}
                        x={mx + 8 + frac * (MEASURE_W - 12)}
                        y={STAFF_TOP - 16}
                        fontSize="11"
                        fontFamily="IBM Plex Mono, ui-monospace, monospace"
                        fill="currentColor"
                        opacity="0.7"
                      >
                        {c.symbol}
                      </text>
                    );
                  })}
                  <MeasureNotes
                    measure={measure}
                    measureLeft={mx}
                    selectedId={selectedId}
                    currentTime={currentTime}
                    flats={flats}
                    onSelect={onSelect}
                  />
                </g>
              );
            })}
            <line
              x1={left + sys.measures.length * MEASURE_W}
              x2={left + sys.measures.length * MEASURE_W}
              y1={STAFF_TOP}
              y2={STAFF_TOP + 4 * LINE_GAP}
              stroke="currentColor"
              strokeWidth="1.6"
              opacity="0.55"
            />
            {playIn ? (
              <line
                x1={xAtTime(currentTime)}
                x2={xAtTime(currentTime)}
                y1={STAFF_TOP - 14}
                y2={STAFF_TOP + 4 * LINE_GAP + 10}
                stroke="currentColor"
                strokeWidth="1.4"
                opacity="0.55"
              />
            ) : null}
          </svg>
        );
      })}
      <p className="text-xs text-ink/40">点击谱面定位播放 · 休止、符杠和小节线按 {Math.round(result.bpm)} BPM 排开</p>
    </div>
  );
}

function MeasureNotes({
  measure,
  measureLeft,
  selectedId,
  currentTime,
  flats,
  onSelect,
}: {
  measure: NotationMeasure;
  measureLeft: number;
  selectedId: string | null;
  currentTime?: number;
  flats: boolean;
  onSelect: (id: string | null) => void;
}) {
  const beams = new Map<number, NotationEvent[]>();
  for (const ev of measure.events) {
    if (ev.beamGroup == null) continue;
    const list = beams.get(ev.beamGroup) ?? [];
    list.push(ev);
    beams.set(ev.beamGroup, list);
  }

  return (
    <g>
      {Array.from(beams.values()).map((group, gi) => {
        const first = group[0]!;
        const last = group[group.length - 1]!;
        const stemDown = group.reduce((s, e) => s + e.staffMidi, 0) / group.length >= 71;
        const x1 = eventX(measureLeft, first) + (stemDown ? -6.4 : 6.4);
        const x2 = eventX(measureLeft, last) + (stemDown ? -6.4 : 6.4);
        const y1 = staffY(first.staffMidi) + (stemDown ? 32 : -32);
        const y2 = staffY(last.staffMidi) + (stemDown ? 32 : -32);
        const has16 = group.some((e) => e.units === 1);
        return (
          <g key={`beam-${measure.index}-${gi}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3.1" />
            {has16
              ? group.map((e, i) => {
                  if (e.units !== 1) return null;
                  const x = eventX(measureLeft, e) + (stemDown ? -6.4 : 6.4);
                  const y = staffY(e.staffMidi) + (stemDown ? 32 : -32);
                  const t = group.length === 1 ? 0 : i / (group.length - 1);
                  const beamY = y1 + (y2 - y1) * t + (stemDown ? -5 : 5);
                  const nx = i < group.length - 1 ? x + 8 : x - 8;
                  return (
                    <line
                      key={e.start}
                      x1={x}
                      y1={y + (stemDown ? -5 : 5)}
                      x2={nx}
                      y2={beamY}
                      stroke="currentColor"
                      strokeWidth="2.2"
                    />
                  );
                })
              : null}
          </g>
        );
      })}
      {measure.events.map((ev, ei) => {
        const x = eventX(measureLeft, ev);
        if (ev.kind === "rest") {
          return (
            <g key={`r${measure.index}-${ei}`}>
              <RestGlyph x={x} units={ev.units} />
              {ev.dotted ? <circle cx={x + 10} cy={STAFF_TOP + 2 * LINE_GAP} r="1.6" fill="currentColor" /> : null}
            </g>
          );
        }
        const y = staffY(ev.staffMidi);
        const ledgers = ledgerLines(ev.staffMidi);
        const stemDown = ev.staffMidi >= 71;
        const playing =
          currentTime !== undefined && currentTime >= ev.start && currentTime < ev.start + ev.duration;
        const selected = ev.id === selectedId;
        const next = measure.events.slice(ei + 1).find((n) => n.kind === "note" && n.midi === ev.midi);
        return (
          <g key={`${ev.id ?? "n"}-${ev.start}`}>
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
            {ev.printed ? (
              <text x={x - 16} y={y + 4} fontSize="13" fontFamily="Georgia, serif" fill="currentColor">
                {ev.printed}
              </text>
            ) : null}
            <g
              onClick={(e) => {
                e.stopPropagation();
                if (ev.id) onSelect(ev.id === selectedId ? null : ev.id);
              }}
              className="cursor-pointer"
            >
              <ellipse
                cx={x}
                cy={y}
                rx="7.2"
                ry="5.1"
                transform={`rotate(-18 ${x} ${y})`}
                fill={ev.hollow ? "none" : "currentColor"}
                stroke="currentColor"
                strokeWidth={ev.hollow ? 1.4 : 0}
                opacity={selected || playing ? 1 : 0.92}
              />
              {selected || playing ? (
                <ellipse
                  cx={x}
                  cy={y}
                  rx="10"
                  ry="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  opacity={playing ? 0.55 : 0.4}
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
              {ev.beamGroup == null && ev.flags > 0 ? (
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
              {ev.beamGroup == null && ev.flags > 1 ? (
                <path
                  d={
                    stemDown
                      ? `M ${x - 6.4} ${y + 26} c 8 2 12 8 10 14`
                      : `M ${x + 6.4} ${y - 26} c 8 2 12 8 10 14`
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              ) : null}
              {ev.dotted ? <circle cx={x + 12} cy={y} r="1.7" fill="currentColor" /> : null}
            </g>
            {ev.tieToNext && next ? (
              <path
                d={`M ${x + 8} ${y + (stemDown ? 10 : -10)} C ${x + 18} ${y + (stemDown ? 20 : -20)} ${eventX(measureLeft, next) - 18} ${staffY(next.staffMidi) + (stemDown ? 20 : -20)} ${eventX(measureLeft, next) - 8} ${staffY(next.staffMidi) + (stemDown ? 10 : -10)}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                opacity="0.7"
              />
            ) : ev.tieToNext ? (
              <path
                d={`M ${x + 8} ${y - 8} C ${x + 22} ${y - 20} ${x + 36} ${y - 20} ${x + 42} ${y - 8}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                opacity="0.7"
              />
            ) : null}
            <title>{midiName(ev.midi, flats)}</title>
          </g>
        );
      })}
    </g>
  );
}
