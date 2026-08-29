-- Photos wall used by the birthday site.
-- Run in the Supabase SQL editor.
-- Also create a Storage bucket named `photos` (Dashboard → Storage).
-- Prefer a private bucket; the app requests signed URLs, with public URLs as fallback.

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null,
  participant_name text not null default '',
  file_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists photos_created_at_idx on public.photos (created_at desc);

alter table public.photos enable row level security;

-- The publishable key is used in the browser until owner Auth exists.
-- Tighten these policies when Hanna's owner session is a real Supabase Auth user.
drop policy if exists photos_select_public on public.photos;
create policy photos_select_public
  on public.photos
  for select
  to anon, authenticated
  using (true);

drop policy if exists photos_insert_public on public.photos;
create policy photos_insert_public
  on public.photos
  for insert
  to anon, authenticated
  with check (true);

-- Owner-only gift content must never use these public policies.
-- Keep gift letters in a separate table with no anon SELECT.

-- Realtime (run once; ignore the error if the table is already in the publication):
-- alter publication supabase_realtime add table public.photos;

-- Storage policies for bucket `photos` (Dashboard → Storage → photos → Policies):
--   INSERT: bucket_id = 'photos'
--   SELECT: bucket_id = 'photos'
-- Do not put a service_role key in the frontend.
