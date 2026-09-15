-- ============================================================================
-- 테스트 빌드 전 권한 전환 · 1단계 — 앱이 쓰지 않는 표 3개를 먼저 잠근다
-- 기준 문서: docs/05_ERD_v6.md §6-5 · 테스트 빌드 보안 점검 필수 1
-- 작성일: 2026-09-15
--
-- 지금은 거의 모든 표에 dev_open_all 이 걸려 있어, 앱 파일에서 꺼낼 수 있는
-- anon 키만으로 읽기·쓰기·삭제가 된다. 테스터에게 앱을 주기 전에 닫아야 한다.
--
-- ⚠️ **이번에는 3개만 바꾼다.** 팀원 화면이 쓰는 표를 한꺼번에 바꾸면
--    개발용 미리보기(세션 없음)·모임·커뮤니티·가입이 막힌다. 아래 3개는
--    develop 과 최근 활동 브랜치를 모두 확인해 앱이 **쓰는** 코드가 없고,
--    읽는 곳도 travel_types 하나뿐이라 먼저 바꿔도 화면이 달라지지 않는다.
--
-- ⚠️ 표 구조는 바꾸지 않는다. types/database.ts 재생성이 필요 없다.
-- ============================================================================


-- ── ① destination_budget_products — AI 예산 추천 캐시 ────────────────────────
--
-- 모든 사용자가 같이 쓰는 캐시다. 앱은 이 표를 읽지도 쓰지도 않고,
-- budget-products Edge Function 이 service_role 로만 읽고 쓴다.
-- (20260907000002 에서 service_role GRANT 를 넣어 두었다)
--
-- ⚠️ 20260907000001 하단 주석 초안은 "읽기는 모두 허용" 이었지만 읽기도 막는다.
--    앱에서 읽는 곳이 없다. 앱이 읽어야 할 일이 생기면 그때 select 만 연다.
drop policy if exists "dev_open_all" on public.destination_budget_products;
revoke all on public.destination_budget_products from anon, authenticated;


-- ── ② insurance_referrals — 보험 제휴 전환 기록 ─────────────────────────────
--
-- 스키마만 있고 앱에서 아직 한 줄도 쓰지 않는다. (전환은 event_log 로만 남는다)
-- 기록 기능을 만들 때 "본인 기록만 넣는다" 정책과 GRANT 를 새로 건다.
--
-- ⚠️ RLS 는 켜진 채로 둔다. 정책이 없으면 행이 하나도 통과하지 않는다.
drop policy if exists "dev_open_all" on public.insurance_referrals;
revoke all on public.insurance_referrals from anon, authenticated;


-- ── ③ travel_types — 여행 유형 기준 데이터 ───────────────────────────────────
--
-- 유형 결과·홈 유형 카드·마이페이지가 읽는다. 앱이 고치는 곳은 없다.
-- 유형 추가·수정은 seed.sql 을 SQL 편집기로 돌려 왔고, 그 경로는 이 권한과 무관하다.
--
-- ⚠️ anon 에도 읽기를 연다. 개발용 미리보기(세션 없음)에서 유형 카드가 계속 보여야 한다.
--
-- ⚠️ init_schema 하단 초안은 "active = true 인 것만" 이었지만 전부 연다.
--    유형을 비활성으로 돌리면, 이미 그 유형을 받은 지난 여행 결과에서
--    유형이 사라진다(trip_type_results → travel_types 조인이 비게 된다).
drop policy if exists "dev_open_all" on public.travel_types;
drop policy if exists "travel_types_read" on public.travel_types;
create policy "travel_types_read" on public.travel_types
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, trigger, references
  on public.travel_types from anon, authenticated;


-- ============================================================================
-- 되돌리기 (문제가 생기면 새 마이그레이션으로 아래를 적용한다)
--
-- create policy "dev_open_all" on public.destination_budget_products
--   for all using (true) with check (true);
-- grant select, insert, update, delete on public.destination_budget_products to anon, authenticated;
--
-- create policy "dev_open_all" on public.insurance_referrals
--   for all using (true) with check (true);
-- grant select, insert, update, delete on public.insurance_referrals to anon, authenticated;
--
-- drop policy if exists "travel_types_read" on public.travel_types;
-- create policy "dev_open_all" on public.travel_types
--   for all using (true) with check (true);
-- grant select, insert, update, delete on public.travel_types to anon, authenticated;
-- ============================================================================
