-- ============================================================================
-- 커뮤니티 게시글 사진 컬럼 (COMM-04)
-- 기준 문서: docs/05_ERD_v6.md §3, CLAUDE.md 1장
-- 작성일: 2026-09-04
--
-- 글쓰기에서 고른 사진(최대 5장)의 public URL 을 담을 자리를 만든다.
-- 지금까지는 담을 곳이 없어 고른 사진이 버려지고, 글 상세에는
-- components/community/cover.ts 가 만드는 더미 이미지가 대신 그려졌다.
--
-- ⚠️ **표(post_images)를 새로 만들지 않는다.**
--    · community_posts 의 RLS·GRANT 를 그대로 따라가 정책 작업이 늘지 않고,
--      배포 전 Production 정책 전환 대상(§6-5)도 늘지 않는다.
--    · MVP 는 최대 5장이고 사진마다 붙일 정보(캡션·크기)가 없다.
--      순서 컬럼도 필요 없다 — **배열 순서가 곧 사진 순서다.**
--    · 나중에 사진마다 정보가 필요해지면 그때 표로 옮기는 편이 반대보다 쉽다.
--
-- ⚠️ 이 컬럼에는 **public URL 전체**를 저장한다. users.profile_image_url 과
--    같은 판단이다. 앱이 Image source 에 그대로 넣기 때문이다.
--    object path 를 넣으면 이름과 내용이 어긋나 호출부에서 오해를 부른다.
--
-- ⚠️ default '{}' + not null 이라 기존 행은 전부 빈 배열이 된다.
--    앱은 "사진 없음" 을 length 0 으로 판정하면 되고 null 검사는 필요 없다.
--
-- 인덱스를 걸지 않는다. 이 컬럼으로 조회하거나 정렬하는 화면이 없다.
--
-- 기존 테이블의 다른 칼럼은 한 글자도 바꾸지 않는다.
-- ============================================================================

alter table public.community_posts
  add column if not exists image_urls text[] not null default '{}';

comment on column public.community_posts.image_urls is
  '게시글 사진의 public URL 목록. community-images bucket. 배열 순서가 표시 순서다. 최대 5장(앱에서 제한).';
