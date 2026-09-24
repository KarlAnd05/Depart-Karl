-- =============================================================================
-- Depart Karl — anonymous messages (with an optional photo) for the site owner
--
-- Visitors can send messages; only the administrator can read them.
-- Senders stay anonymous: the site never asks for a name or email.
-- Uses public.is_admin() / public.admins from the previous migration.
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  -- Random id of the visitor's anonymous session (not a name or email).
  -- Used only to limit spam and to check photo uploads.
  sender_id         uuid default auth.uid() references auth.users (id) on delete set null,
  body              text not null check (char_length(btrim(body)) between 1 and 2000),
  photo_path        text unique,
  photo_mime_type   text check (photo_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  photo_size_bytes  integer check (photo_size_bytes > 0 and photo_size_bytes <= 5242880), -- 5 MB
  photo_width       integer check (photo_width > 0),
  photo_height      integer check (photo_height > 0),
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists messages_created_idx on public.messages (created_at desc);
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages: send" on public.messages;
drop policy if exists "messages: admin read" on public.messages;
drop policy if exists "messages: admin update" on public.messages;
drop policy if exists "messages: admin delete" on public.messages;

-- Any visitor (anonymous session) can send a message, attaching only a photo
-- from their own upload folder.
create policy "messages: send" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and is_read = false
    and (photo_path is null or photo_path like (select auth.uid())::text || '/%')
  );

-- Only the admin can read, mark as read, or delete messages.
create policy "messages: admin read" on public.messages
  for select to authenticated
  using ((select public.is_admin()));

create policy "messages: admin update" on public.messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "messages: admin delete" on public.messages
  for delete to authenticated
  using ((select public.is_admin()));

-- Spam protection: at most 10 messages per visitor per hour, and the
-- timestamp always comes from the server.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if (
    select count(*) from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many messages. Please try again later.';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ---------- Message photos (Storage) -------------------------------------------

-- Private bucket; the bucket itself enforces the size limit and image types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-photos', 'message-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "message photos: upload own" on storage.objects;
drop policy if exists "message photos: admin read" on storage.objects;
drop policy if exists "message photos: admin delete" on storage.objects;

-- Visitors can upload only into a folder named after their own session id.
create policy "message photos: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Only the admin can view or delete message photos.
create policy "message photos: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'message-photos' and (select public.is_admin()));

create policy "message photos: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'message-photos' and (select public.is_admin()));
