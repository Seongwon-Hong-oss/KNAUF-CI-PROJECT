begin;

-- 무료 플랜의 비활성 일시정지를 막기 위해 GitHub Actions가 주기적으로 호출하는 함수. 데이터는 읽거나 쓰지 않는다.
create or replace function public.keepalive() returns integer
language sql stable security invoker set search_path = ''
as $$ select 1 $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

commit;
