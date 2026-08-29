-- Additive setup for challenge, voices, reactions, votes, and realtime.
-- Run in the Supabase SQL editor AFTER photos.sql and messages.sql.
-- Safe to run more than once.

alter table public.photos
  add column if not exists destination text not null default 'today';

alter table public.photos
  add column if not exists with_ferenc boolean not null default false;

create index if not exists photos_destination_idx on public.photos (destination, created_at desc);
create index if not exists photos_with_ferenc_idx on public.photos (with_ferenc);

alter table public.messages
  add column if not exists destination text not null default 'today';

create index if not exists messages_destination_idx on public.messages (destination, created_at desc);

create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null,
  participant_name text not null default '',
  file_path text not null unique,
  duration integer not null default 0,
  destination text not null default 'today',
  created_at timestamptz not null default now()
);

create index if not exists voices_created_at_idx on public.voices (created_at desc);

alter table public.voices enable row level security;

drop policy if exists voices_select_public on public.voices;
create policy voices_select_public
  on public.voices
  for select
  to anon, authenticated
  using (
    coalesce(destination, 'today') <> 'capsule'
    or now() >= timestamptz '2026-08-31 22:00:00+02'
  );

drop policy if exists voices_insert_public on public.voices;
create policy voices_insert_public
  on public.voices
  for insert
  to anon, authenticated
  with check (true);

grant select, insert on table public.voices to anon, authenticated;

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null,
  participant_id text not null default 'guest',
  created_at timestamptz not null default now()
);

alter table public.reactions enable row level security;

drop policy if exists reactions_select_public on public.reactions;
create policy reactions_select_public
  on public.reactions
  for select
  to anon, authenticated
  using (true);

drop policy if exists reactions_insert_public on public.reactions;
create policy reactions_insert_public
  on public.reactions
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.photo_votes (
  photo_id text not null,
  participant_id text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, participant_id)
);

alter table public.photo_votes enable row level security;

drop policy if exists photo_votes_select_public on public.photo_votes;
create policy photo_votes_select_public
  on public.photo_votes
  for select
  to anon, authenticated
  using (true);

drop policy if exists photo_votes_insert_public on public.photo_votes;
create policy photo_votes_insert_public
  on public.photo_votes
  for insert
  to anon, authenticated
  with check (true);

-- Hide capsule photos/messages until 22:00 on 31.08.2026 (Europe/Berlin).
drop policy if exists photos_select_public on public.photos;
create policy photos_select_public
  on public.photos
  for select
  to anon, authenticated
  using (
    coalesce(destination, 'today') <> 'capsule'
    or now() >= timestamptz '2026-08-31 22:00:00+02'
  );

drop policy if exists messages_select_public on public.messages;
create policy messages_select_public
  on public.messages
  for select
  to anon, authenticated
  using (
    coalesce(destination, 'today') <> 'capsule'
    or now() >= timestamptz '2026-08-31 22:00:00+02'
  );

do $$
begin
  alter publication supabase_realtime add table public.photos;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.voices;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reactions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.photo_votes;
exception
  when duplicate_object then null;
end $$;
