-- ============================================================================
-- 목적지 상품 캐시 · service_role GRANT 보강
-- 기준 문서: 20260907000001_destination_budget_products.sql
-- 작성일: 2026-09-07
--
-- 20260907000001 이 anon, authenticated 에만 권한을 줬다. 그런데 이 표를
-- 실제로 쓰는 주체는 Edge Function(budget-products)이고, 그건 service_role 로
-- 붙는다. 그래서 캐시 저장이 42501(insufficient privilege)로 막혔다.
--
-- ⚠️ service_role 은 RLS 를 우회하지만 **테이블 GRANT 까지 우회하지는 않는다.**
--    두 개는 다른 층이다. RLS 정책만 열어 두고 GRANT 를 빠뜨리면
--    정책은 통과하는데 권한에서 막혀 원인을 찾기 어렵다.
--
-- ⚠️ 앞 마이그레이션을 고치지 않고 새 파일로 더한다. (CLAUDE.md 1장)
--    이미 push 된 파일을 고치면 다른 환경과 이력이 어긋난다.
--
-- 배포 전 실서비스 정책으로 바꿀 때도 이 GRANT 는 남는다.
-- 쓰기 주체가 service_role 하나여야 하기 때문이다.
-- ============================================================================

grant select, insert, update, delete
  on public.destination_budget_products
  to service_role;
