import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="size-8 animate-pulse rounded-full bg-elevated" />;
  }
  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex h-9 items-center rounded-sm border border-border px-3 text-sm text-fg hover:bg-elevated"
      >
        登录
      </Link>
    );
  }
  const label = user.displayName ?? user.primaryEmail ?? "账户";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-8 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-elevated text-xs font-medium text-fg">
          {label.charAt(0)}
        </span>
      )}
      <span className="hidden max-w-28 truncate text-sm text-muted sm:inline">{label}</span>
      <button
        type="button"
        onClick={() => void signOut("/")}
        className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
      >
        退出
      </button>
    </div>
  );
}

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between gap-4 border-b border-border px-4 sm:px-6",
        className,
      )}
    >
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-lg font-medium tracking-tight text-fg">谱骨</span>
          <span className="hidden text-xs tracking-wide text-subtle sm:inline">扒旋律</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="rounded-sm px-2.5 py-1.5 text-sm text-muted hover:bg-elevated hover:text-fg"
            activeProps={{ className: "rounded-sm px-2.5 py-1.5 text-sm text-fg" }}
          >
            工作台
          </Link>
          <Link
            to="/library"
            className="rounded-sm px-2.5 py-1.5 text-sm text-muted hover:bg-elevated hover:text-fg"
            activeProps={{ className: "rounded-sm px-2.5 py-1.5 text-sm text-fg" }}
          >
            曲库
          </Link>
        </nav>
      </div>
      <AuthSlot />
    </header>
  );
}
