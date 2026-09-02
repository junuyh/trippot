-- ============================================================================
-- 프로필 이미지 Storage (MY-01)
-- 기준 문서: docs/05_ERD_v3.md, CLAUDE.md 1장
-- 작성일: 2026-09-02
--
-- 프로필 사진 파일을 담을 bucket 을 만든다.
--
-- ⚠️ users.profile_image_url 컬럼은 이미 있다. 새 컬럼을 만들지 않는다.
--    파일은 Storage, 파일의 위치는 그 컬럼. 역할을 나눈다.
--
-- ⚠️ 이 컬럼에는 **public URL 전체**를 저장한다. 컬럼 이름이 _url 이고
--    앱이 Image source 에 그대로 넣기 때문이다. object path 를 넣으면
--    이름과 내용이 어긋나 다른 화면(getGroupMembers)에서 오해를 부른다.
--
-- object path 규칙:  {user_id}/{uuid}.jpg
--    ⚠️ 파일명을 profile.jpg 로 고정하지 않는다. URL 이 그대로면 브라우저·CDN
--       캐시 때문에 사진을 바꿔도 예전 것이 보인다. 이전 파일은 앱이 지운다.
--
-- 기존 테이블은 한 글자도 바꾸지 않는다.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  -- ⚠️ public = true 는 "URL 을 아는 사람은 앱 밖에서도 볼 수 있다" 는 뜻이다.
  --    프로필 사진을 공개 가능한 비민감 정보로 보는 제품 판단에 따른 것이다.
  --    바뀌면 private + signed URL 로 재설계해야 한다.
  true,
  -- 2 MB. 앱이 정사각 crop + quality 0.8 로 업로드한다.
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;


-- ── 정책 ────────────────────────────────────────────────────────────────────
--
-- ⚠️ storage.objects 는 Supabase 가 RLS 를 켠 채로 제공한다.
--    정책을 만들지 않으면 업로드도 조회도 전부 막힌다.
--
-- ⚠️ 아래 쓰기 정책은 **개발용이다.** public 테이블의 dev_open_all 과 같은 성격이다.
--    앱에 아직 로그인이 없어 auth.uid() 가 null 이라 본인 검사를 걸 수 없다.
--    실서비스 정책은 이 파일 하단 주석 참고.
--
-- ⚠️ storage.objects 에는 다른 bucket 의 정책이 이미 있을 수 있다.
--    같은 이름으로 다시 만들면 42710 으로 실패하므로 먼저 지우고 만든다.
--    (create policy 에는 if not exists 가 없다)
drop policy if exists "profile_images_read" on storage.objects;
drop policy if exists "profile_images_dev_insert" on storage.objects;
drop policy if exists "profile_images_dev_update" on storage.objects;
drop policy if exists "profile_images_dev_delete" on storage.objects;

-- 읽기 — 모두 허용. 다른 사용자의 프로필 사진을 보여줘야 한다.
create policy "profile_images_read" on storage.objects
  for select using (bucket_id = 'profile-images');

-- 쓰기 — 개발용 전체 개방
create policy "profile_images_dev_insert" on storage.objects
  for insert with check (bucket_id = 'profile-images');

create policy "profile_images_dev_update" on storage.objects
  for update using (bucket_id = 'profile-images')
             with check (bucket_id = 'profile-images');

create policy "profile_images_dev_delete" on storage.objects
  for delete using (bucket_id = 'profile-images');


-- ============================================================================
-- 실서비스 정책 (배포 전 위 dev_* 세 개를 drop 하고 아래로 교체)
--
-- path 의 첫 폴더가 본인 uid 인지만 보면 된다.
-- storage.foldername('11111111-.../abc.jpg')[1] = '11111111-...'
--
-- drop policy "profile_images_dev_insert" on storage.objects;
-- drop policy "profile_images_dev_update" on storage.objects;
-- drop policy "profile_images_dev_delete" on storage.objects;
--
-- create policy "profile_images_own_insert" on storage.objects
--   for insert to authenticated
--   with check (
--     bucket_id = 'profile-images'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy "profile_images_own_update" on storage.objects
--   for update to authenticated
--   using (
--     bucket_id = 'profile-images'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy "profile_images_own_delete" on storage.objects
--   for delete to authenticated
--   using (
--     bucket_id = 'profile-images'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- 읽기 정책(profile_images_read)은 그대로 둔다. 다른 사용자의 사진을
-- 보여주는 것이 서비스 요구사항이다.
-- ============================================================================
