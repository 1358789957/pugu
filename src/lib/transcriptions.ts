import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { z } from "zod";

export type SavedTranscription = {
  id: string;
  title: string;
  sourceName: string | null;
  keyName: string | null;
  bpm: number | null;
  duration: number;
  notesJson: string;
  createdAt: string;
};

const saveSchema = z.object({
  id: z.string().min(8),
  title: z.string().trim().min(1).max(80),
  sourceName: z.string().max(160).nullable(),
  keyName: z.string().max(32).nullable(),
  bpm: z.number().int().min(30).max(240).nullable(),
  duration: z.number().min(0).max(3600),
  notesJson: z.string().min(2).max(1_500_000),
});

function mapRow(r: {
  id: string;
  title: string;
  source_name: string | null;
  key_name: string | null;
  bpm: number | null;
  duration: number;
  notes_json: string;
  created_at: string;
}): SavedTranscription {
  return {
    id: r.id,
    title: r.title,
    sourceName: r.source_name,
    keyName: r.key_name,
    bpm: r.bpm,
    duration: Number(r.duration),
    notesJson: r.notes_json,
    createdAt: r.created_at,
  };
}

export const listTranscriptions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      source_name: string | null;
      key_name: string | null;
      bpm: number | null;
      duration: number;
      notes_json: string;
      created_at: string;
    }>`
      select id, title, source_name, key_name, bpm, duration, notes_json, created_at
      from transcriptions
      where user_id = ${context.userId}
      order by created_at desc
    `;
    return rows.map(mapRow);
  });

export const getTranscription = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: unknown) => z.string().min(8).parse(id))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      source_name: string | null;
      key_name: string | null;
      bpm: number | null;
      duration: number;
      notes_json: string;
      created_at: string;
    }>`
      select id, title, source_name, key_name, bpm, duration, notes_json, created_at
      from transcriptions
      where id = ${id} and user_id = ${context.userId}
      limit 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  });

export const saveTranscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into transcriptions (id, user_id, title, source_name, key_name, bpm, duration, notes_json)
      values (
        ${data.id},
        ${context.userId},
        ${data.title},
        ${data.sourceName},
        ${data.keyName},
        ${data.bpm},
        ${data.duration},
        ${data.notesJson}
      )
      on conflict (id) do update set
        title = excluded.title,
        source_name = excluded.source_name,
        key_name = excluded.key_name,
        bpm = excluded.bpm,
        duration = excluded.duration,
        notes_json = excluded.notes_json
    `;
    return { id: data.id };
  });

export const deleteTranscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => z.string().min(8).parse(id))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`
      delete from transcriptions
      where id = ${id} and user_id = ${context.userId}
    `;
    return { ok: true };
  });
