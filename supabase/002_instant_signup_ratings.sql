begin;

alter table public.profiles alter column approved set default true;
update public.profiles set approved = true where not approved;

alter table public.places add column if not exists hourly_rate integer;
alter table public.places add constraint places_hourly_rate_valid
  check (hourly_rate is null or (category = 'parking' and hourly_rate between 0 and 1000000));
grant update (hourly_rate) on public.places to authenticated;

create table public.ratings (
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  primary key (place_id, author_id)
);
create index ratings_author_idx on public.ratings(author_id);
alter table public.ratings enable row level security;
revoke all on public.ratings from anon, authenticated;
grant select, insert on public.ratings to authenticated;
grant update (score) on public.ratings to authenticated;
create policy ratings_read on public.ratings for select to authenticated
using (public.is_employee());
create policy ratings_insert on public.ratings for insert to authenticated
with check (public.is_employee() and author_id = auth.uid());
create policy ratings_update on public.ratings for update to authenticated
using (public.is_employee() and author_id = auth.uid())
with check (public.is_employee() and author_id = auth.uid());

commit;