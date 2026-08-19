import { Download, Minus, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LeadSheet } from "@/components/lead-sheet";
import { DropZone } from "@/components/drop-zone";
import { NoteList } from "@/components/note-list";
import { PianoRoll } from "@/components/piano-roll";
import { WaterfallGrid } from "@/components/waterfall-grid";
import { PitchCurve } from "@/components/pitch-curve";
import { PlayerBar } from "@/components/player-bar";
import { StaffView } from "@/components/staff-view";
import { Waveform } from "@/components/waveform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { assignLyrics, lyricsForFile, type LyricLine } from "@/lib/melody/leadsheet";
import { formatProgression, snapChordsToGrid, transposeChords } from "@/lib/melody/chords";
import { analyzeMelody, buildResult, type AnalyzeOptions } from "@/lib/melody/analyze";
import { DEMO_FILE_NAME, renderDemoBuffer } from "@/lib/melody/demo";
import { midiBlob, notesToJson } from "@/lib/melody/midi";
import {
  clampBpm,
  detectKey,
  findGridOffset,
  transposeNotes,
  type AnalysisResult,
  type NoteEvent,
} from "@/lib/melody/notes";
import { player, type PlayMode } from "@/lib/melody/synth";
import { assignDisplayGrid } from "@/lib/melody/display-grid";
import { saveTranscription } from "@/lib/transcriptions";
import { downloadBlob, audioBufferToWav } from "@/lib/utils";

type Status = "idle" | "loading" | "analyzing" | "ready" | "error";

export function Studio({
  initial,
}: {
  initial?: { title: string; notes: NoteEvent[]; bpm: number; keyName?: string } | null;
}) {
  const { user } = useCurrentUserState();
  const [status, setStatus] = useState<Status>(initial ? "ready" : "idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [fileName, setFileName] = useState(initial?.title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(() =>
    initial
      ? {
          notes: initial.notes,
          chords: [],
          key: detectKey(initial.notes),
          bpm: initial.bpm,
          duration: Math.max(1, ...initial.notes.map((n) => n.start + n.duration), 0),
          sampleRate: 16000,
          waveform: new Float32Array(0),
          pitchTrack: [],
          rawPitchTrack: [],
          gridOffset: findGridOffset(initial.notes, initial.bpm),
        }
      : null,
  );
  const bufferRef = useRef<AudioBuffer | null>(null);
  const vocalRef = useRef<AudioBuffer | null>(null);
  const [minDur, setMinDur] = useState(0.09);
  const [minConf, setMinConf] = useState(0.42);
  const [quantize, setQuantize] = useState(true);
  const [isolate, setIsolate] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mode, setMode] = useState<PlayMode>("melody");
  const [loop, setLoop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricDraft, setLyricDraft] = useState("");
  const resultRef = useRef(result);
  resultRef.current = result;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    player.onTime = (t) => setCurrentTime(t);
    player.onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    return () => {
      player.onTime = null;
      player.onEnded = null;
      player.stop();
    };
  }, []);

  useEffect(() => {
    player.loop = loop;
  }, [loop]);

  const opts: AnalyzeOptions = useMemo(
    () => ({
      minDuration: minDur,
      minConfidence: minConf,
      splitRepeats: true,
      quantize,
      isolateVocals: isolate,
    }),
    [minDur, minConf, quantize, isolate],
  );

  function applyNotes(notes: NoteEvent[], chords = resultRef.current?.chords) {
    const current = resultRef.current;
    if (!current) return;
    const byId = new Map(notes.map((n) => [n.id, n]));
    const sourceNotes = current.sourceNotes?.map((s) => {
      const u = byId.get(s.id);
      if (!u) return s;
      return {
        ...s,
        midi: u.midi,
        uncertain: u.uncertain,
        pitchLocked: u.pitchLocked,
        confidence: u.confidence,
      };
    });
    const key = detectKey(notes);
    const next = {
      ...current,
      notes,
      sourceNotes,
      key,
      chords: chords ? transposeChords(chords, 0, key) : [],
    };
    resultRef.current = next;
    setResult(next);
  }

  function patchNote(id: string, patch: Partial<NoteEvent>) {
    const current = resultRef.current;
    if (!current) return;
    applyNotes(current.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function resegment(override: Partial<AnalyzeOptions> = {}) {
    const current = resultRef.current;
    if (!current) return;
    const nextOpts = { ...opts, bpm: current.bpm, ...override };
    if (current.sourceNotes?.length || current.pitchTrack.length) {
      const next = buildResult(
        current.pitchTrack,
        current.waveform,
        current.sampleRate,
        current.duration,
        nextOpts,
        current.sourceNotes,
      );
      const merged = {
        ...next,
        chords: current.chords ?? [],
        rawPitchTrack: current.rawPitchTrack,
        listenPhrases: current.listenPhrases,
      };
      resultRef.current = merged;
      setResult(merged);
      setSelectedId(null);
      return;
    }
    if (nextOpts.quantize) {
      const q = assignDisplayGrid(current.notes, nextOpts.bpm ?? current.bpm);
      const next = {
        ...current,
        notes: q.notes,
        gridOffset: q.gridOffset,
        chords: snapChordsToGrid(current.chords, nextOpts.bpm ?? current.bpm, q.gridOffset),
        key: detectKey(q.notes),
      };
      resultRef.current = next;
      setResult(next);
    }
  }

  function setBpm(next: number) {
    const current = resultRef.current;
    if (!current) return;
    const bpm = clampBpm(next);
    if (bpm === current.bpm) return;
    const q = quantize
      ? assignDisplayGrid(current.notes, bpm)
      : { notes: current.notes, gridOffset: findGridOffset(current.notes, bpm) };
    const chords = snapChordsToGrid(current.chords, bpm, q.gridOffset);
    const updated = { ...current, bpm, notes: q.notes, gridOffset: q.gridOffset, chords };
    resultRef.current = updated;
    setResult(updated);
  }

  function toggleQuantize() {
    const next = !quantize;
    setQuantize(next);
    resegment({ quantize: next });
  }

  async function toggleIsolate() {
    const next = !isolate;
    setIsolate(next);
    const buf = bufferRef.current;
    if (!buf || status !== "ready") return;
    player.stop();
    setPlaying(false);
    setStatus("analyzing");
    setProgress(0);
    try {
      const analyzed = await analyzeMelody(
        buf,
        { ...opts, isolateVocals: next, maxSeconds: 360 },
        (p, label) => {
          setProgress(p);
          setProgressLabel(label);
        },
      );
      vocalRef.current = analyzed.vocalBuffer ?? null;
      resultRef.current = analyzed;
      setResult(analyzed);
      setStatus("ready");
      if (!next && mode === "vocals") setMode("source");
      toast.success(next ? "已弱分离并重新铺格，去瀑布听写" : "已按干声重新铺格，去瀑布听写");
    } catch {
      setStatus("ready");
      toast.error("重新分离失败");
    }
  }

  async function decodeFile(file: File) {
    setError(null);
    setStatus("loading");
    setFileName(file.name);
    setSelectedId(null);
    const seeded = lyricsForFile(file.name);
    setLyrics(seeded ?? []);
    setLyricDraft((seeded ?? []).map((l) => l.text).join("\n"));
    player.stop();
    setPlaying(false);
    setCurrentTime(0);
    try {
      const arr = await file.arrayBuffer();
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      await ctx.close();
      bufferRef.current = buf;
      const looksDry = /人声|vocal|vocals|dry|哼唱|acapella|acappella/i.test(file.name);
      const useHpss = looksDry ? false : isolate;
      if (looksDry && isolate) setIsolate(false);
      setStatus("analyzing");
      setProgress(0);
      const next = await analyzeMelody(buf, { ...opts, maxSeconds: 360, isolateVocals: useHpss }, (p, label) => {
        setProgress(p);
        setProgressLabel(label);
      });
      vocalRef.current = next.vocalBuffer ?? null;
      setResult(next);
      setStatus("ready");
      toast.success(
        useHpss
          ? `已按句铺格 ${next.notes.length} 个 · 去瀑布听写音高`
          : `干声已按句铺格 ${next.notes.length} 个 · 去瀑布听写音高`,
      );
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("无法解码这首歌。请换 MP3 或 WAV 再试。");
    }
  }

  async function runDemo() {
    setError(null);
    setStatus("loading");
    setFileName(DEMO_FILE_NAME);
    setSelectedId(null);
    const seeded = lyricsForFile(DEMO_FILE_NAME);
    setLyrics(seeded ?? []);
    setLyricDraft((seeded ?? []).map((l) => l.text).join("\n"));
    player.stop();
    setPlaying(false);
    setCurrentTime(0);
    try {
      const buf = await renderDemoBuffer();
      bufferRef.current = buf;
      setStatus("analyzing");
      const next = await analyzeMelody(
        buf,
        { ...opts, isolateVocals: false },
        (p, label) => {
          setProgress(p);
          setProgressLabel(label);
        },
      );
      vocalRef.current = null;
      setResult(next);
      setStatus("ready");
      toast.success("示例已扒出 · 小星星");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("示例生成失败，请刷新再试。");
    }
  }

  const startPlayback = useCallback(async (from: number) => {
    const current = resultRef.current;
    if (!current) return;
    await player.play({
      notes: current.notes,
      chords: current.chords,
      source: bufferRef.current,
      vocals: vocalRef.current,
      mode,
      from,
      duration: current.duration,
      loop,
    });
    setPlaying(true);
  }, [mode, loop]);

  async function togglePlay() {
    const current = resultRef.current;
    if (!current) return;
    if (playingRef.current) {
      player.stop();
      setPlaying(false);
      return;
    }
    const from = currentTime >= current.duration - 0.05 ? 0 : currentTime;
    await startPlayback(from);
  }

  function seek(t: number) {
    const was = player.seek(t);
    setCurrentTime(t);
    if (was) void startPlayback(t);
  }

  function exportMidi() {
    if (!result) return;
    const name = (fileName || "melody").replace(/\.[^.]+$/, "");
    downloadBlob(
      midiBlob(result.notes, {
        bpm: result.bpm,
        title: name,
        key: result.key,
        chords: result.chords,
      }),
      `${name}.mid`,
    );
    toast.success(`已导出库乐队 MIDI · 精细时值 · ${Math.round(result.bpm)} BPM`);
  }

  function exportVocals() {
    const vocal = vocalRef.current;
    if (!vocal) return;
    const name = (fileName || "melody").replace(/\.[^.]+$/, "");
    downloadBlob(audioBufferToWav(vocal), `${name}-vocals.wav`);
    toast.success("已导出干声 WAV");
  }

  function exportJson() {
    if (!result) return;
    const name = (fileName || "melody").replace(/\.[^.]+$/, "");
    const text = notesToJson(result.notes, {
      title: name,
      key: result.key.name,
      bpm: result.bpm,
      chords: result.chords,
    });
    downloadBlob(new Blob([text], { type: "application/json" }), `${name}.json`);
  }

  async function save() {
    if (!result) return;
    if (!user) {
      toast.message("登录后即可把曲谱存进曲库");
      return;
    }
    setSaving(true);
    try {
      const title = (fileName || "未命名曲谱").replace(/\.[^.]+$/, "");
      await saveTranscription({
        data: {
          id: crypto.randomUUID(),
          title,
          sourceName: fileName || null,
          keyName: result.key.name,
          bpm: Math.round(result.bpm),
          duration: result.duration,
          notesJson: JSON.stringify(result.notes),
        },
      });
      toast.success("已存入曲库");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unauthorized")) {
        toast.error("请先登录再保存");
      } else {
        toast.error("保存失败，请稍后再试");
      }
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    player.stop();
    bufferRef.current = null;
    vocalRef.current = null;
    setResult(null);
    setStatus("idle");
    setFileName("");
    setSelectedId(null);
    setPlaying(false);
    setCurrentTime(0);
    setError(null);
    setLyrics([]);
    setLyricDraft("");
  }

  function applyLyricDraft() {
    const current = resultRef.current;
    if (!current) return;
    const next = assignLyrics(lyricDraft, current, undefined);
    setLyrics(next);
  }

  function shiftAll(delta: number) {
    if (!result) return;
    const notes = transposeNotes(result.notes, delta);
    const key = detectKey(notes);
    applyNotes(notes, transposeChords(result.chords, delta, key));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
        return;
      }
      const current = resultRef.current;
      if (!current) return;
      if (e.key === "[" || e.key === "【") {
        const notes = transposeNotes(current.notes, -1);
        applyNotes(notes, transposeChords(current.chords, -1, detectKey(notes)));
      } else if (e.key === "]" || e.key === "】") {
        const notes = transposeNotes(current.notes, 1);
        applyNotes(notes, transposeChords(current.chords, 1, detectKey(notes)));
      } else if (e.key === "ArrowUp" && selectedId) {
        e.preventDefault();
        applyNotes(
          current.notes.map((n) =>
            n.id === selectedId ? { ...n, midi: Math.min(96, n.midi + 1) } : n,
          ),
        );
      } else if (e.key === "ArrowDown" && selectedId) {
        e.preventDefault();
        applyNotes(
          current.notes.map((n) =>
            n.id === selectedId ? { ...n, midi: Math.max(24, n.midi - 1) } : n,
          ),
        );
      } else if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        applyNotes(current.notes.filter((n) => n.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // togglePlay closes over currentTime/mode; refs keep play/pause correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, mode, loop, currentTime]);

  const busy = status === "loading" || status === "analyzing";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      {status === "idle" || status === "error" ? (
        <>
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.18em] text-subtle uppercase">Melody extractor</p>
            <h1 className="mt-2 font-display text-4xl font-medium text-fg sm:text-5xl">
              听出骨头里的旋律
            </h1>
            <p className="mt-3 text-sm text-muted sm:text-base">
              有干声请选「这是干声」，整段直接进 Basic Pitch。成曲只能用 HPSS 弱分离（会漏伴奏）。导出 MIDI 自带 BPM。
            </p>
          </div>
          <DropZone
            disabled={busy}
            isolate={isolate}
            onIsolate={setIsolate}
            onFile={(f) => void decodeFile(f)}
            onDemo={() => void runDemo()}
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </>
      ) : null}

      {busy ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-10">
          <p className="font-display text-xl text-fg">
            {status === "loading" ? "正在读入音频" : progressLabel || "正在扒谱"}
          </p>
          <p className="mt-1 text-sm text-muted">{fileName}</p>
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.round((status === "loading" ? 0.08 : progress) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {status === "ready" && result ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs text-subtle">{fileName}</p>
              <h1 className="mt-1 font-display text-3xl font-medium text-fg">旋律稿</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge>{result.key.name}</Badge>
                <label className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 text-xs font-medium text-muted">
                  <BpmField
                    bpm={result.bpm}
                    onChange={setBpm}
                    className="w-10 bg-transparent text-center font-mono text-fg tabular-nums outline-none"
                  />
                  BPM
                </label>
                <Badge>{result.notes.length} 音</Badge>
                {result.chords.length ? (
                  <Badge>
                    {result.chords
                      .slice(0, 6)
                      .map((c) => c.symbol)
                      .join(" · ")}
                    {result.chords.length > 6 ? " …" : ""}
                  </Badge>
                ) : null}
                {vocalRef.current ? <Badge>已拆人声</Badge> : null}
                {result.listenPhrases?.length ? (
                  <Badge>
                    {result.listenPhrases.length} 句 ·{" "}
                    {result.listenPhrases.map((p) => p.noteCount).join("+")} 音
                  </Badge>
                ) : result.sourceNotes?.length ? (
                  <Badge>听谱</Badge>
                ) : null}
                <Badge>{result.duration.toFixed(1)} 秒</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={reset}>
                <X className="size-4" />
                新文件
              </Button>
              <Button size="sm" variant="secondary" onClick={exportJson}>
                JSON
              </Button>
              {vocalRef.current ? (
                <Button size="sm" variant="secondary" onClick={exportVocals}>
                  干声
                </Button>
              ) : null}
              <Button size="sm" onClick={exportMidi}>
                <Download className="size-4" />
                库乐队 MIDI
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                <Save className="size-4" />
                {user ? "存入曲库" : "登录后保存"}
              </Button>
            </div>
          </div>

          {result.waveform.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <Waveform
                peaks={result.waveform}
                progress={result.duration ? currentTime / result.duration : 0}
                onSeek={(ratio) => seek(ratio * result.duration)}
              />
            </div>
          ) : null}

          <PlayerBar
            playing={playing}
            currentTime={currentTime}
            duration={result.duration}
            mode={mode}
            loop={loop}
            canPlaySource={Boolean(bufferRef.current)}
            canPlayVocals={Boolean(vocalRef.current)}
            onToggle={() => void togglePlay()}
            onStop={() => {
              player.halt();
              setPlaying(false);
              setCurrentTime(0);
            }}
            onSeek={seek}
            onLoop={setLoop}
            onMode={(m) => {
              setMode(m);
              if (playing) {
                player.stop();
                setPlaying(false);
              }
            }}
          />
          <p className="text-xs text-subtle">
            {mode === "melody"
              ? "只听你填进格子的音。还没听写的格子是机器的提示，别当谱。"
              : mode === "both"
                ? "对照：你填的音叠在原曲或干声上，听对不对。"
                : mode === "vocals"
                  ? "正在听拆出的干声。点瀑布格子会跳到那一拍。"
                  : "正在听原曲。点格子听这一拍，再写下数字。"}
          </p>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Tabs defaultValue="fall" className="min-w-0">
              <TabsList>
                <TabsTrigger value="fall">瀑布</TabsTrigger>
                <TabsTrigger value="roll">钢琴卷帘</TabsTrigger>
                <TabsTrigger value="staff">五线谱</TabsTrigger>
                <TabsTrigger value="chords">和弦</TabsTrigger>
                <TabsTrigger value="sheet">词谱</TabsTrigger>
                <TabsTrigger value="curve">音高曲线</TabsTrigger>
              </TabsList>
              <TabsContent value="roll" className="mt-3">
                <PianoRoll
                  result={result}
                  currentTime={currentTime}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onSeek={seek}
                  onChangeNote={patchNote}
                  onPreview={(midi) => player.tap(midi)}
                  className="h-96"
                />
                <p className="mt-2 hidden text-xs text-subtle sm:block">
                  着色是 C=1 固定调级数 · 小节尺按速度铺格 · 点空白处定位 · 拖动改音高 · Ctrl 滚轮缩放
                </p>
              </TabsContent>
              <TabsContent value="fall" className="mt-3">
                <WaterfallGrid
                  result={result}
                  currentTime={currentTime}
                  onSeek={seek}
                  onChangeNotes={applyNotes}
                />
              </TabsContent>
              <TabsContent value="staff" className="mt-3">
                <StaffView
                  result={result}
                  selectedId={selectedId}
                  currentTime={currentTime}
                  onSelect={setSelectedId}
                  onSeek={seek}
                />
              </TabsContent>
              <TabsContent value="chords" className="mt-3">
                {result.chords.length ? (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-xs text-subtle">
                      {result.key.name} · 按两拍切一块并对齐小节 · 已写入 MIDI 第二轨
                    </p>
                    <pre className="mt-3 overflow-x-auto font-mono text-sm leading-7 text-fg">
                      {formatProgression(result.chords, 4, {
                        bpm: result.bpm,
                        gridOffset: result.gridOffset ?? 0,
                      })}
                    </pre>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.chords.map((c, i) => (
                        <button
                          key={`${c.start}-${i}`}
                          type="button"
                          onClick={() => seek(c.start)}
                          className="rounded-md border border-border px-2.5 py-1 text-left text-sm hover:border-accent/40"
                        >
                          <span className="font-medium text-fg">{c.symbol}</span>
                          <span className="ml-2 text-xs text-subtle">{c.roman}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-border bg-surface p-8 text-sm text-muted">
                    还没有和弦。重新上传成曲即可自动听进行。
                  </p>
                )}
              </TabsContent>
              <TabsContent value="sheet" className="mt-3">
                <LeadSheet
                  result={result}
                  lyrics={lyrics}
                  draft={lyricDraft}
                  currentTime={currentTime}
                  onDraft={setLyricDraft}
                  onApply={applyLyricDraft}
                  onSeek={seek}
                  title={(fileName || "词谱").replace(/\.[^.]+$/, "")}
                />
              </TabsContent>
              <TabsContent value="curve" className="mt-3">
                {result.pitchTrack.length ? (
                  <PitchCurve result={result} currentTime={currentTime} onSeek={seek} />
                ) : (
                  <p className="rounded-lg border border-border bg-surface p-8 text-sm text-muted">
                    从曲库打开的稿件没有音调仪音高线，重新上传即可查看。
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <aside className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
              <div>
                <p className="text-xs tracking-wide text-subtle">整理</p>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex h-11 items-center justify-between rounded-md border border-border px-2">
                    <span className="px-1 text-sm text-muted">速度</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="减慢"
                        onClick={() => setBpm(result.bpm - 1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <BpmField
                        bpm={result.bpm}
                        onChange={setBpm}
                        className="w-12 bg-transparent text-center font-mono text-sm text-fg tabular-nums outline-none"
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="加快"
                        onClick={() => setBpm(result.bpm + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleIsolate()}
                    className={`flex h-11 items-center justify-between rounded-md border px-3 text-sm ${
                      isolate && vocalRef.current
                        ? "border-accent/40 bg-elevated text-fg"
                        : "border-border text-muted hover:text-fg"
                    }`}
                  >
                    <span>{isolate ? "成曲弱分离" : "这是干声"}</span>
                    <span className="font-mono text-xs tabular-nums">
                      {isolate ? "HPSS" : "直送"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleQuantize}
                    className={`flex h-11 items-center justify-between rounded-md border px-3 text-sm ${
                      quantize
                        ? "border-accent/40 bg-elevated text-fg"
                        : "border-border text-muted hover:text-fg"
                    }`}
                  >
                    <span>吸附节拍</span>
                    <span className="font-mono text-xs tabular-nums">{quantize ? "16 分" : "关"}</span>
                  </button>
                  <div className="flex h-11 items-center justify-between rounded-md border border-border px-2">
                    <span className="px-1 text-sm text-muted">移调</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="降低半音"
                        onClick={() => shiftAll(-1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="升高半音"
                        onClick={() => shiftAll(1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs tracking-wide text-subtle">识别灵敏度</p>
                <div className="mt-3 space-y-4">
                  <label className="block">
                    <span className="mb-2 flex justify-between text-xs text-muted">
                      <span>最短音符</span>
                      <span className="font-mono tabular-nums">{Math.round(minDur * 1000)} ms</span>
                    </span>
                    <Slider
                      min={0.05}
                      max={0.28}
                      step={0.01}
                      value={[minDur]}
                      onValueChange={(v) => setMinDur(v[0] ?? minDur)}
                      onValueCommit={(v) => resegment({ minDuration: v[0] ?? minDur })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 flex justify-between text-xs text-muted">
                      <span>置信门槛</span>
                      <span className="font-mono tabular-nums">{Math.round(minConf * 100)}</span>
                    </span>
                    <Slider
                      min={0.25}
                      max={0.7}
                      step={0.01}
                      value={[minConf]}
                      onValueChange={(v) => setMinConf(v[0] ?? minConf)}
                      onValueCommit={(v) => resegment({ minConfidence: v[0] ?? minConf })}
                    />
                  </label>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="min-h-0 max-h-80 flex-1 overflow-auto lg:max-h-none">
                <p className="mb-2 text-xs tracking-wide text-subtle">音符</p>
                <NoteList
                  result={result}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChange={applyNotes}
                />
              </div>
              <p className="text-xs text-subtle">空格播放 · 点谱定位 · [ ] 移调 · ↑↓ 改选中音</p>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function BpmField({
  bpm,
  onChange,
  className,
}: {
  bpm: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(Math.round(bpm)));
  useEffect(() => {
    setDraft(String(Math.round(bpm)));
  }, [bpm]);

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) onChange(n);
    else setDraft(String(Math.round(bpm)));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      aria-label="BPM"
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}
