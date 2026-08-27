-- Deletes birthday CONTENT only (test photos, messages, voices, reactions, votes).
-- Does NOT delete:
--   - Supabase project configuration
--   - database schema, tables, policies, or buckets
--   - admin access (there is no server admin account)
--   - Ferenc Gift configuration or application files
--   - participants (left intact; uncomment below only if you also want a people reset)
--
-- Run in the Supabase SQL editor after confirming in /admin.
-- The public anon key cannot reliably empty these tables when RLS has no DELETE policy.
-- If the admin UI reports that RLS blocked the reset, this file is the real reset.

delete from public.photo_votes;
delete from public.reactions;
delete from public.voices;
delete from public.messages;
delete from public.photos;

-- Optional: also clear participant rows created during tests.
-- Uncomment if you want a full people reset too.
-- delete from public.participants;

-- Storage objects (photos + voices). Ignore errors if the buckets are empty.
delete from storage.objects where bucket_id in ('photos', 'voices');
