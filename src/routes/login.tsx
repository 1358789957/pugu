import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-3.5rem)] w-full max-w-md place-items-center px-6 py-12">
      <div className="w-full rounded-xl border border-border bg-surface p-8">
        <p className="text-xs tracking-[0.18em] text-subtle uppercase">谱骨</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-fg">登录，把曲谱留下来</h1>
        <p className="mt-2 text-sm text-muted">扒谱本身不用账号。登录后可以把旋律稿存进曲库。</p>
        <div className="mt-8 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
              >
                使用 {p.label} 继续
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">登录已关闭。</p>
          )}
        </div>
        <Link to="/" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          先去扒一段
        </Link>
      </div>
    </main>
  );
}
