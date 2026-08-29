-- Messages wall used by the birthday site.
-- Run in the Supabase SQL editor.
-- Do not drop existing tables. This file is additive.
--
-- If public.messages already exists with a `message` column instead of `content`,
-- leave that table in place. The app maps both names and does not require a rename.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null,
  participant_name text not null default '',
  content text not null,
  created_at timestamptz not null default now(),
  constraint messages_content_length
    check (char_length(trim(content)) between 1 and 500)
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

-- The publishable key is used in the browser until owner Auth exists.
-- Tighten these policies when Hanna's owner session is a real Supabase Auth user.
drop policy if exists messages_select_public on public.messages;
create policy messages_select_public
  on public.messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists messages_insert_public on public.messages;
create policy messages_insert_public
  on public.messages
  for insert
  to anon, authenticated
  with check (
    char_length(trim(content)) between 1 and 500
    and char_length(trim(participant_id)) > 0
  );

-- No update/delete from the frontend.

-- Realtime (run once; ignore the error if the table is already in the publication):
-- alter publication supabase_realtime add table public.messages;

-- Do not put a service_role key in the frontend.
