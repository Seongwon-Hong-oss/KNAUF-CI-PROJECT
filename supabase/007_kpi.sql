begin;

-- 주차장 요금 구조화 입력 (무료 여부, 30분당 요금, 무료 시간)
alter table public.places
  add column if not exists parking_free boolean,
  add column if not exists fee_per_30min integer,
  add column if not exists free_minutes integer;
alter table public.places add constraint places_fee_valid check (
  (fee_per_30min is null or fee_per_30min between 0 and 100000)
  and (free_minutes is null or free_minutes between 0 and 1440)
);
grant update (parking_free, fee_per_30min, free_minutes) on public.places to authenticated;

-- "이용했어요" 기록. 절감액 = 평소 주차비 - 실제 주차비
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  used_at date not null default current_date,
  actual_fee integer check (actual_fee is null or actual_fee between 0 and 1000000),
  usual_fee integer check (usual_fee is null or usual_fee between 0 and 1000000),
  created_at timestamptz not null default now()
);
create index usage_logs_author_idx on public.usage_logs(author_id);
create index usage_logs_place_idx on public.usage_logs(place_id);
create index usage_logs_used_idx on public.usage_logs(used_at);
alter table public.usage_logs enable row level security;
revoke all on public.usage_logs from anon, authenticated;
grant select, insert, delete on public.usage_logs to authenticated;
create policy usage_logs_read on public.usage_logs for select to authenticated
using (public.is_employee());
create policy usage_logs_insert on public.usage_logs for insert to authenticated
with check (public.is_employee() and author_id = auth.uid());
create policy usage_logs_delete on public.usage_logs for delete to authenticated
using (public.is_employee() and (author_id = auth.uid() or public.is_admin()));

-- 월평균 주차비 설문 (도입 전 baseline, 도입 후 followup). 본인 응답만 조회 가능
create table public.parking_surveys (
  author_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('baseline', 'followup')),
  monthly_fee integer not null check (monthly_fee between 0 and 10000000),
  created_at timestamptz not null default now(),
  primary key (author_id, phase)
);
alter table public.parking_surveys enable row level security;
revoke all on public.parking_surveys from anon, authenticated;
grant select, insert on public.parking_surveys to authenticated;
grant update (monthly_fee) on public.parking_surveys to authenticated;
create policy parking_surveys_read on public.parking_surveys for select to authenticated
using (public.is_employee() and author_id = auth.uid());
create policy parking_surveys_insert on public.parking_surveys for insert to authenticated
with check (public.is_employee() and author_id = auth.uid());
create policy parking_surveys_update on public.parking_surveys for update to authenticated
using (public.is_employee() and author_id = auth.uid())
with check (public.is_employee() and author_id = auth.uid());

-- 설문 평균은 응답 3건 이상일 때만 반환 (개인 응답 노출 방지, 관리자 계정 제외)
create or replace function public.survey_summary()
returns table (phase text, responses integer, avg_fee numeric)
language sql stable security definer set search_path = ''
as $$
  select s.phase, count(*)::integer,
    case when count(*) >= 3 then round(avg(s.monthly_fee)) end
  from public.parking_surveys s
  join public.profiles p on p.id = s.author_id and p.role <> 'admin'
  where public.is_employee()
  group by s.phase;
$$;
revoke all on function public.survey_summary() from public, anon;
grant execute on function public.survey_summary() to authenticated;

-- 관리자가 정하는 목표값
create table public.kpi_targets (
  key text primary key check (key in ('participation_rate', 'district_count', 'monthly_usage', 'monthly_savings')),
  value numeric not null check (value >= 0)
);
alter table public.kpi_targets enable row level security;
revoke all on public.kpi_targets from anon, authenticated;
grant select, insert on public.kpi_targets to authenticated;
grant update (value) on public.kpi_targets to authenticated;
create policy kpi_targets_read on public.kpi_targets for select to authenticated
using (public.is_employee());
create policy kpi_targets_insert on public.kpi_targets for insert to authenticated
with check (public.is_admin());
create policy kpi_targets_update on public.kpi_targets for update to authenticated
using (public.is_admin()) with check (public.is_admin());

commit;
