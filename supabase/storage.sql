-- Storage buckets and policies for photos + voice messages.
-- Run in the Supabase SQL editor.
-- Do not put a service_role key in the frontend.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('voices', 'voices', false)
on conflict (id) do nothing;

drop policy if exists photos_storage_select on storage.objects;
create policy photos_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id in ('photos', 'voices'));

drop policy if exists photos_storage_insert on storage.objects;
create policy photos_storage_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id in ('photos', 'voices'));
