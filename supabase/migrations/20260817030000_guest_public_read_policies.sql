-- Allow the anon role to read public content used by the guest feed.
-- These policies are read-only and do not change creator permissions.
alter table public.profiles enable row level security;
alter table public.signals enable row level security;
alter table public.posts enable row level security;

drop policy if exists profiles_select_guest_public on public.profiles;
create policy profiles_select_guest_public
  on public.profiles for select to anon
  using (true);

drop policy if exists signals_select_guest_public on public.signals;
create policy signals_select_guest_public
  on public.signals for select to anon
  using (visibility = 'public');

drop policy if exists posts_select_guest_public on public.posts;
create policy posts_select_guest_public
  on public.posts for select to anon
  using (true);
