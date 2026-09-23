-- =============================================================================
-- Depart Karl — Supabase setup for the Photo Album
--
-- With the Supabase GitHub integration ("Deploy to production" on), this runs
-- automatically when pushed to main. Without it, paste the whole file into
-- Supabase → SQL Editor → New query → Run. It is safe to run more than once.
--
-- Who can see what:
--   • Public photos  → everyone
--   • Private photos → the administrator only (not even the uploader)
-- =============================================================================

-- ---------- Administrators ----------------------------------------------------

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No policies = nobody can read or change this table from the website.
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Photo records -----------------------------------------------------

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid default auth.uid() references auth.users (id) on delete set null,
  storage_path text not null unique,
  title        text check (char_length(title) <= 100),
  album        text check (char_length(album) <= 60),
  is_public    boolean not null default true,
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size_bytes   integer not null check (size_bytes > 0 and size_bytes <= 5242880), -- 5 MB
  width        integer check (width > 0),
  height       integer check (height > 0),
  created_at   timestamptz not null default now()
);

create index if not exists photos_public_created_idx on public.photos (is_public, created_at desc);
create index if not exists photos_owner_idx on public.photos (owner_id);

alter table public.photos enable row level security;

drop policy if exists "photos: read" on public.photos;
drop policy if exists "photos: insert own" on public.photos;
drop policy if exists "photos: admin update" on public.photos;
drop policy if exists "photos: delete" on public.photos;

-- Everyone can read public records. The admin can read everything.
-- Uploaders can read the *record* (title, date) of their own private photos so
-- "My uploads" can list them, but the image itself stays admin-only (see storage below).
create policy "photos: read" on public.photos
  for select to anon, authenticated
  using (is_public or (select public.is_admin()) or owner_id = (select auth.uid()));

-- Visitors can only add records for files in their own folder.
create policy "photos: insert own" on public.photos
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
  );

-- Only the admin can change a photo (e.g. switch public/private).
create policy "photos: admin update" on public.photos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The admin can delete anything; uploaders can delete their own public photos.
create policy "photos: delete" on public.photos
  for delete to authenticated
  using ((select public.is_admin()) or (owner_id = (select auth.uid()) and is_public));

-- ---------- Photo files (Storage) ---------------------------------------------

-- Private bucket: files are only reachable through signed links, which the
-- policies below allow only for public photos (or for the admin).
-- The bucket itself also enforces the size limit and allowed image types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photo files: upload own" on storage.objects;
drop policy if exists "photo files: read" on storage.objects;
drop policy if exists "photo files: delete" on storage.objects;

-- Visitors can upload only into a folder named after their own user id.
create policy "photo files: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Files can be viewed when their photo is public, or by the admin.
create policy "photo files: read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.photos p
        where p.storage_path = objects.name and p.is_public
      )
    )
  );

-- The admin can delete any file; uploaders can delete files of their own public photos.
create policy "photo files: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      (select public.is_admin())
      or (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and exists (
          select 1 from public.photos p
          where p.storage_path = objects.name and p.is_public
        )
      )
    )
  );

-- ---------- Make yourself the administrator ------------------------------------
-- 1. Supabase → Authentication → Users → "Add user" → create your email + password
--    (tick "Auto Confirm User"), then copy the new user's "User UID".
-- 2. Supabase → Table Editor → admins → Insert row → paste the UID into user_id → Save.
--    (Or in the SQL Editor:
--       insert into public.admins (user_id)
--       select id from auth.users where email = 'YOUR-EMAIL@example.com'; )
