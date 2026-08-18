import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio";
import { getTranscription } from "@/lib/transcriptions";
import type { NoteEvent } from "@/lib/melody/notes";

type Search = { t?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ deps }) => {
    if (!deps.t) return { saved: null as null };
    try {
      const saved = await getTranscription({ data: deps.t });
      return { saved };
    } catch {
      return { saved: null };
    }
  },
  component: Home,
});

function parseNotes(json: string): NoteEvent[] {
  try {
    const raw = JSON.parse(json) as NoteEvent[];
    if (!Array.isArray(raw)) return [];
    return raw.filter((n) => n && typeof n.midi === "number" && typeof n.start === "number");
  } catch {
    return [];
  }
}

function Home() {
  const { saved } = Route.useLoaderData();
  const initial = saved
    ? {
        title: saved.title,
        notes: parseNotes(saved.notesJson),
        bpm: saved.bpm ?? 100,
        keyName: saved.keyName ?? undefined,
      }
    : null;
  return <Studio key={saved?.id ?? "new"} initial={initial} />;
}
