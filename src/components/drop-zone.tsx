import { Mic, Square, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm";

export function DropZone({
  disabled,
  onFile,
  onDemo,
  isolate,
  onIsolate,
}: {
  disabled?: boolean;
  onFile: (file: File) => void;
  onDemo: () => void;
  isolate?: boolean;
  onIsolate?: (next: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [over, setOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  function take(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  async function toggleRecord() {
    setRecError(null);
    if (recording && recRef.current) {
      recRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        recRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], `录音 ${new Date().toLocaleTimeString("zh-CN")}.webm`, {
          type: blob.type,
        });
        onFile(file);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setRecError("无法使用麦克风，请检查权限");
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center transition-colors",
        over && "border-accent/60 bg-elevated",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => take(e.target.files)}
      />
      <div className="mb-4 grid size-12 place-items-center rounded-lg bg-elevated text-accent">
        <Upload className="size-5" />
      </div>
      <h2 className="font-display text-xl font-medium text-fg">把歌放上来</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        机器按句切开、数有几个音、排好格子。音高你对着原曲听写填进去，再叠着播核对。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button disabled={disabled} onClick={() => inputRef.current?.click()}>
          选择音频
        </Button>
        <Button disabled={disabled} variant="secondary" onClick={onDemo}>
          试听示例
        </Button>
        <Button
          disabled={disabled}
          variant={recording ? "paper" : "outline"}
          onClick={() => void toggleRecord()}
        >
          {recording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
          {recording ? "停止录音" : "哼唱录音"}
        </Button>
      </div>
      {recError ? <p className="mt-3 text-sm text-danger">{recError}</p> : null}
      {onIsolate ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onIsolate(false)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-md border px-3 text-sm",
                !isolate
                  ? "border-accent/40 bg-elevated text-fg"
                  : "border-border text-muted hover:text-fg",
              )}
            >
              <span className="font-medium">这是干声</span>
              <span className="text-xs text-subtle">已拆人声 / 哼唱，按句数格子</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onIsolate(true)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-md border px-3 text-sm",
                isolate
                  ? "border-border bg-elevated text-muted"
                  : "border-border text-muted hover:text-fg",
              )}
            >
              <span className="font-medium">成曲弱分离</span>
              <span className="text-xs text-subtle">HPSS + 中置，会漏伴奏</span>
            </button>
          </div>
          <p className="max-w-md text-xs text-subtle">
            浏览器里没有体积合适的 Demucs。有干声请选「这是干声」。HPSS 只是退路，不是干净人声。最长约 6 分钟
          </p>
        </div>
      ) : null}
      <div className="mt-6 w-full max-w-md rounded-xl border border-border bg-elevated px-4 py-3 text-left">
        <p className="text-sm font-medium text-fg">《昼回のメモリー》已扒好</p>
        <p className="mt-1 text-xs text-subtle">G 大调 · 117 BPM · 可直接进库乐队钢琴帘</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/downloads/hirumawari-melody.mid"
            download="昼回のメモリー-旋律.mid"
            className="inline-flex h-8 items-center rounded-md bg-paper px-3 text-xs font-medium text-ink"
          >
            库乐队 MIDI
          </a>
          <a
            href="/downloads/hirumawari-vocals.wav"
            download="昼回のメモリー-人声.wav"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-fg"
          >
            人声 WAV
          </a>
          <a
            href="/downloads/hirumawari-garageband.zip"
            download="昼回のメモリー-库乐队.zip"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-fg"
          >
            打包下载
          </a>
        </div>
      </div>
    </div>
  );
}
