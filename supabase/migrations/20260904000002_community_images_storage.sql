-- ============================================================================
-- 커뮤니티 게시글 이미지 Storage (COMM-04)
-- 기준 문서: docs/05_ERD_v6.md §6-7, CLAUDE.md 1장
-- 작성일: 2026-09-04
--
-- 게시글 사진 파일을 담을 bucket 을 만든다.
-- 20260902000003_profile_images_storage.sql 과 같은 모양이다.
--
-- ⚠️ 파일의 위치는 community_posts.image_urls 컬럼에 담는다.
--    (20260904000001_community_post_images.sql)
--    파일은 Storage, 파일의 위치는 컬럼. 역할을 나눈다.
--
-- object path 규칙:  {user_id}/{uuid}.jpg
--    ⚠️ **{post_id} 를 경로에 넣지 않는다.** 새 글은 저장되기 전에 post_id 가
--       없어서 사진을 먼저 올릴 수 없다. 사용자는 사진을 고르고 미리보기를 본
--       뒤에 게시하므로, 업로드가 글 저장보다 앞선다.
--    ⚠️ 파일명을 고정하지 않는다. URL 이 그대로면 브라우저·CDN 캐시 때문에
--       사진을 바꿔도 예전 것이 보인다. 이전 파일은 앱이 지운다.
--
-- 기존 테이블·bucket 은 한 글자도 바꾸지 않는다.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  -- ⚠️ public = true 는 "URL 을 아는 사람은 앱 밖에서도 볼 수 있다" 는 뜻이다.
  --    커뮤니티 글은 누구나 보는 공개글이라 프로필 사진과 같은 판단을 적용했다.
  --    바뀌면 private + signed URL 로 재설계해야 한다.
  true,
  -- 5 MB. 여행 사진은 가로가 길어서, 앱이 긴 변 1600px · JPEG 로 줄여 올려도
  -- 프로필 상한(2 MB)을 넘길 수 있다.
  5242880,
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
-- ⚠️ storage.objects 에는 다른 bucket 의 정책(profile-images)이 함께 산다.
--    같은 이름으로 다시 만들면 42710 으로 실패하므로 먼저 지우고 만든다.
--    (create policy 에는 if not exists 가 없다)
drop policy if exists "community_images_read" on storage.objects;
drop policy if exists "community_images_dev_insert" on storage.objects;
drop policy if exists "community_images_dev_update" on storage.objects;
drop policy if exists "community_images_dev_delete" on storage.objects;

-- 읽기 — 모두 허용. 커뮤니티 글은 누구나 보는 공개글이다.
create policy "community_images_read" on storage.objects
  for select using (bucket_id = 'community-images');

-- 쓰기 — 개발용 전체 개방
create policy "community_images_dev_insert" on storage.objects
  for insert with check (bucket_id = 'community-images');

create policy "community_images_dev_update" on storage.objects
  for update using (bucket_id = 'community-images')
             with check (bucket_id = 'community-images');

create policy "community_images_dev_delete" on storage.objects
  for delete using (bucket_id = 'community-images');


-- ============================================================================
-- 실서비스 정책 (배포 전 위 dev_* 세 개를 drop 하고 아래로 교체)
--
-- ⚠️ [Release Blocker] 다. 지금 상태로 배포하면 누구나 **남의 글 사진을
--    덮어쓰거나 지울 수 있다.** P2 나 Future 가 아니다. (05_ERD_v6.md §6-5)
--
-- path 의 첫 폴더가 본인 uid 인지만 보면 된다.
-- storage.foldername('11111111-.../abc.jpg')[1] = '11111111-...'
--
-- drop policy "community_images_dev_insert" on storage.objects;
-- drop policy "community_images_dev_update" on storage.objects;
-- drop policy "community_images_dev_delete" on storage.objects;
--
-- create policy "community_images_own_insert" on storage.objects
--   for insert to authenticated
--   with check (
--     bucket_id = 'community-images'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy "community_images_own_update" on storage.objects
--   for update to authenticated
--   using (
--     bucket_id = 'community-images'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy "community_images_own_delete" on storage.objects
--   for delete to authenticated
--   using (
--     bucket_id = 'community-images'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- 읽기 정책(community_images_read)은 그대로 둔다.
-- 공개글의 사진을 모두에게 보여주는 것이 서비스 요구사항이다.
-- ============================================================================
