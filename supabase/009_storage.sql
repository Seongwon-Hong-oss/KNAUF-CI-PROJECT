-- 사진 버킷 (장소 사진 + 프로필 사진, Supabase 전용이며 로컬 DB 테스트에는 포함되지 않음)
-- 공개 버킷이지만 파일 이름이 추측 불가능한 uuid이고, 업로드/삭제는 로그인한 승인 멤버만 가능합니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 307200, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy photos_read on storage.objects for select to authenticated
using (bucket_id = 'photos' and public.is_employee());

create policy photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'photos'
  and public.is_employee()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy photos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'photos'
  and public.is_employee()
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
