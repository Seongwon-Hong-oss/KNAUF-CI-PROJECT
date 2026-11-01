begin;

create table public.company_domains (
  domain text primary key check (domain = lower(domain) and domain not like '%@%' and length(domain) > 3)
);
alter table public.company_domains enable row level security;
revoke all on public.company_domains from anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  department text not null default '' check (length(department) <= 60),
  role text not null default 'member' check (role in ('admin', 'member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category text not null check (category in ('restaurant', 'parking')),
  address text not null check (length(trim(address)) between 1 and 200),
  note text not null check (length(trim(note)) between 1 and 1000),
  price text not null default '' check (length(price) <= 100),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index places_author_idx on public.places(author_id);
create index places_created_idx on public.places(created_at desc);
create index comments_place_idx on public.comments(place_id);
create index comments_author_idx on public.comments(author_id);

create function public.is_employee() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = auth.uid() and approved); $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = auth.uid() and approved and role = 'admin'); $$;

create function public.register_employee() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from public.company_domains where domain = lower(split_part(new.email, '@', 2))
  ) then
    raise exception 'This email domain is not allowed. Contact your administrator.';
  end if;
  insert into public.profiles (id, name, department)
  values (new.id, trim(coalesce(new.raw_user_meta_data ->> 'name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'department', '')));
  return new;
end;
$$;

create trigger on_employee_signup after insert on auth.users
for each row execute function public.register_employee();

create function public.set_employee_approval(employee_id uuid, approval boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.profiles set approved = approval where id = employee_id and role <> 'admin';
  if not found then raise exception 'Employee not found or administrator account'; end if;
end;
$$;

revoke all on function public.register_employee() from public, anon, authenticated;
revoke all on function public.is_employee() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.set_employee_approval(uuid, boolean) from public, anon;
grant execute on function public.is_employee(), public.is_admin(), public.set_employee_approval(uuid, boolean) to authenticated;

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.comments enable row level security;

revoke all on public.profiles, public.places, public.comments from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.places to authenticated;
grant update (name, category, address, note, price, lat, lng) on public.places to authenticated;
grant select, insert, delete on public.comments to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or (public.is_employee() and approved));
create policy places_read on public.places for select to authenticated using (public.is_employee());
create policy places_insert on public.places for insert to authenticated
with check (public.is_employee() and author_id = auth.uid());
create policy places_update on public.places for update to authenticated
using (public.is_employee() and (author_id = auth.uid() or public.is_admin()))
with check (public.is_employee() and (author_id = auth.uid() or public.is_admin()));
create policy places_delete on public.places for delete to authenticated
using (public.is_employee() and (author_id = auth.uid() or public.is_admin()));
create policy comments_read on public.comments for select to authenticated using (public.is_employee());
create policy comments_insert on public.comments for insert to authenticated
with check (public.is_employee() and author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
using (public.is_employee() and (author_id = auth.uid() or public.is_admin()));

commit;