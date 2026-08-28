-- ============================================================================
-- public 스키마 테이블 접근 권한 부여 (anon / authenticated)
-- 기준 문서: docs/05_ERD_v2.md 6장
-- 작성일: 2026-08-28
--
-- ⚠️⚠️ 이 GRANT 는 개발용이다. RLS 의 dev_open_all 정책과 짝이다. ⚠️⚠️
--       실서비스 배포 전에 RLS 정책을 실제 정책으로 바꾸고
--       GRANT 범위도 함께 재검토해야 한다.
--       (20260827000001_init_schema.sql 하단 "실서비스 정책" 절)
--
-- ── 왜 이 파일이 필요한가 ───────────────────────────────────────────────────
--
-- RLS 정책과 GRANT 는 다른 것이고, 둘 다 있어야 접근된다.
--
--   GRANT       테이블에 접근할 수 있는가        (권한 검사)
--   RLS 정책     그 테이블의 어떤 행을 볼 수 있는가 (행 필터)
--
-- 순서상 GRANT 가 먼저다. GRANT 가 없으면 RLS 정책까지 가보지도 못하고 막힌다.
-- dev_open_all 이 `using (true)` 로 모든 행을 열어두었어도 마찬가지다.
--
-- 실제로 20260827000001 적용 후 앱의 모든 조회가 이렇게 실패했다.
--
--   {"code":"42501",
--    "message":"permission denied for table group_members",
--    "hint":"Grant the required privileges to the current role with:
--            GRANT SELECT ON public.group_members TO anon;"}
--
-- 초기 스키마에 GRANT 문이 한 줄도 없었던 것이 원인이다.
-- Supabase 대시보드로 만든 테이블은 GRANT 가 자동으로 붙지만,
-- 마이그레이션 SQL 로 만든 테이블은 붙지 않는다.
-- ============================================================================

-- ── 스키마 사용 권한 ────────────────────────────────────────────────────────
-- 테이블 권한이 있어도 스키마 USAGE 가 없으면 접근할 수 없다.
grant usage on schema public to anon, authenticated;


-- ── 기존 테이블 ─────────────────────────────────────────────────────────────
-- 23개 테이블 전부. 행 수준 제어는 RLS 정책이 맡는다.
grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;


-- ── 기존 시퀀스 ─────────────────────────────────────────────────────────────
-- 현재 스키마는 PK 가 전부 uuid 라 시퀀스가 없다. (serial / bigserial 미사용)
-- 나중에 serial 칼럼이 추가돼도 nextval 이 막히지 않도록 미리 넣어둔다.
-- 시퀀스가 하나도 없으면 이 문장은 아무것도 하지 않고 성공한다.
grant usage, select
  on all sequences in schema public
  to anon, authenticated;


-- ── 앞으로 만들 테이블·시퀀스 ───────────────────────────────────────────────
-- 위 "all tables" 는 이 마이그레이션을 실행하는 시점의 테이블에만 적용된다.
-- 이후 마이그레이션에서 만든 테이블에는 적용되지 않으므로 기본 권한을 걸어둔다.
--
-- ⚠️ ALTER DEFAULT PRIVILEGES 는 **이 문장을 실행한 역할이 만든 객체**에만
--    적용된다. 다른 역할로 테이블을 만들면 적용되지 않으니,
--    새 테이블이 또 permission denied 로 막히면 위 "all tables" GRANT 를
--    새 마이그레이션으로 다시 실행한다.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;


-- ============================================================================
-- 배포 전 체크리스트
--
--   [ ] dev_open_all 정책 전부 drop
--   [ ] 20260827000001 하단 "실서비스 정책" 의 RLS 정책으로 교체
--   [ ] 이 파일의 GRANT 범위 재검토
--       · anon 에게 INSERT/UPDATE/DELETE 가 필요한가
--         (로그인 후 동작이면 authenticated 만으로 충분하다)
--       · event_log 는 앱에서 INSERT 만 한다. SELECT 를 회수할지 검토
--         (docs/05_ERD_v2.md §6-2)
--   [ ] ALTER DEFAULT PRIVILEGES 도 같은 기준으로 다시 건다
-- ============================================================================
