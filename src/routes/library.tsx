import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatTime } from "@/lib/utils";
import {
  deleteTranscription,
  listTranscriptions,
  type SavedTranscription,
} from "@/lib/transcriptions";

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryPage() {
  const { user, isPending } = useCurrentUserState();
  const [items, setItems] = useState<SavedTranscription[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listTranscriptions()
      .then(setItems)
      .catch(() => setItems([]));
  }, [user]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="h-8 w-40 animate-pulse rounded-md bg-elevated" />
        <div className="mt-8 space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-surface" />
          <div className="h-20 animate-pulse rounded-md bg-surface" />
        </div>
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function remove(id: string) {
    try {
      await deleteTranscription({ data: id });
      setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Library</p>
      <h1 className="mt-2 font-display text-4xl font-medium text-fg">曲库</h1>
      <p className="mt-2 text-sm text-muted">登录后保存的旋律稿都在这里。</p>

      {items === null ? (
        <div className="mt-8 space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-surface" />
          <div className="h-20 animate-pulse rounded-lg bg-surface" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-muted">还没有存过曲谱。</p>
          <Button asChild className="mt-4">
            <Link to="/">去扒一段</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{item.title}</p>
                <p className="mt-0.5 text-xs text-subtle">
                  {item.keyName ?? "未知调"} · {item.bpm ?? "—"} BPM · {formatTime(item.duration)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/" search={{ t: item.id }}>
                    打开
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(item.id)}>
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
