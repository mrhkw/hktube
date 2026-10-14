alter table public.videos
  add column if not exists requested_visibility text not null default 'public'
  check (requested_visibility in ('public', 'unlisted', 'private'));

update public.videos
   set requested_visibility = case when visibility in ('public', 'unlisted', 'private') then visibility else 'private' end
 where requested_visibility = 'public'
   and visibility in ('unlisted', 'private');

comment on column public.videos.requested_visibility is
  'Creator-selected visibility, applied only after successful media processing and safety approval.';
