create table if not exists transcriptions (
  id          text primary key,
  user_id     text not null,
  title       text not null,
  source_name text,
  key_name    text,
  bpm         integer,
  duration    real not null default 0,
  notes_json  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists transcriptions_user_id_idx
  on transcriptions (user_id, created_at desc);
