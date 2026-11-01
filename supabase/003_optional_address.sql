begin;

alter table public.places drop constraint places_address_check;
alter table public.places alter column address set default '';
alter table public.places add constraint places_address_length check (length(address) <= 200);

commit;
