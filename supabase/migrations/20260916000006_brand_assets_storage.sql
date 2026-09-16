-- ============================================================================
-- Storage — brand-assets (앱 밖에서 쓰는 브랜드 이미지)
-- 작성일: 2026-09-16
--
-- 인증 메일(Supabase Auth · Brevo SMTP)에 앱 로고를 넣으려고 만든다.
-- 메일 안의 이미지는 **공개 주소**가 있어야 한다. Gmail 등은 메일에 파일을
-- 직접 넣는 방식(base64)을 막는다. 그래서 로그인 없이 읽히는 공개 버킷에 둔다.
--
-- 공개 주소
--   https://pzwabphxitubsioyhgkk.supabase.co/storage/v1/object/public/brand-assets/trippot-logo.png
--
-- ⚠️⚠️ 로고를 바꾸면 **이 버킷의 파일도 같이 바꾼다.** ⚠️⚠️
--       앱 로고(assets/logo.png)와 메일 로고는 따로 산다. 앱만 바꾸면 메일에는
--       옛 로고가 계속 나간다. 올리는 명령:
--         npx supabase storage cp assets/logo.png ss:///brand-assets/trippot-logo.png --experimental
--       (같은 이름으로 덮어쓰면 메일 템플릿은 고치지 않아도 된다.
--        메일 앱이 이미지를 캐시하므로 새 로고가 보이기까지 시간이 걸릴 수 있다)
--
-- ⚠️ 운영 DB 로 옮길 때도 이 버킷과 파일을 함께 만든다. 주소의 프로젝트 ref 가
--    바뀌므로 메일 템플릿의 이미지 주소도 같이 바꾼다.
--
-- ⚠️ 쓰기 정책을 만들지 않는다. 앱·사용자는 이 버킷에 올리거나 지울 수 없다.
--    올리기는 CLI(서비스 권한)로만 한다. 공개 버킷이라 읽기 정책도 필요 없다 —
--    /object/public/ 주소는 정책 없이 열린다.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  1048576,                                         -- 1 MB. 로고는 100 KB 안팎이다
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;


-- ============================================================================
-- 되돌리기 (새 마이그레이션으로 적용한다. 파일이 남아 있으면 먼저 지운다)
--
-- delete from storage.buckets where id = 'brand-assets';
-- ============================================================================
