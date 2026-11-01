begin;

-- 장소당 사진 1장. 값은 Storage 버킷 안의 경로(작성자 id/파일 id.jpg)
alter table public.places add column if not exists photo_path text;
alter table public.places add constraint places_photo_path_valid check (
  photo_path is null
  or photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
);
grant update (photo_path) on public.places to authenticated;

-- 프로필 사진: 본인 행의 avatar_path 컬럼만 수정 가능(role 등은 여전히 수정 불가)
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add constraint profiles_avatar_path_valid check (
  avatar_path is null
  or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
);
grant update (avatar_path) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

commit;
