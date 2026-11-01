begin;

-- Accounts are plain IDs (the app maps them to an internal login address). No email domain restriction.
alter table public.profiles add column if not exists account text;
create unique index if not exists profiles_account_key on public.profiles (lower(account));
alter table public.profiles add constraint profiles_office_valid
  check (department in ('', 'Seoul office', 'Busan office', 'Gwangju office', 'Daejeon office', 'Daegu office', 'Ulsan Plant', 'Dangjin Plant', 'Yosu Plant')) not valid;

create or replace function public.register_employee() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  acct text := trim(coalesce(new.raw_user_meta_data ->> 'account', ''));
begin
  if length(acct) < 2 or length(acct) > 20 or acct ~ '\s' then
    raise exception 'Invalid account';
  end if;
  insert into public.profiles (id, name, department, account, role)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'department', '')),
    acct,
    case when lower(acct) = 'admin' then 'admin' else 'member' end
  );
  return new;
end;
$$;

commit;
