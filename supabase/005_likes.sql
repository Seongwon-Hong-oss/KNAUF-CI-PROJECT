begin;

create table public.likes (
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, author_id)
);
create index likes_author_idx on public.likes(author_id);

alter table public.likes enable row level security;
revoke all on public.likes from anon, authenticated;
grant select, insert, delete on public.likes to authenticated;

create policy likes_read on public.likes for select to authenticated
using (public.is_employee());
create policy likes_insert on public.likes for insert to authenticated
with check (public.is_employee() and author_id = auth.uid());
create policy likes_delete on public.likes for delete to authenticated
using (public.is_employee() and author_id = auth.uid());

commit;
