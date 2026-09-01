-- ============================================================================
-- budget_plan_items.display_mode 추가
--
-- BUDGET-02 v2 스펙
--   "입력 항목은 항목명, 총 예상 금액, 금액 표시 방식입니다.
--    금액 표시 방식은 총액 또는 1인당 금액 × 인원 중 선택하게 합니다.
--    표시 방식만 달라지고 실제 합산 총액은 변경하지 않습니다."
--
-- 사용자가 넣는 값은 언제나 **총액**이다. 이 칼럼은 그 총액을 목록에서
-- 어떻게 보여줄지만 정한다.
--
--   TOTAL       200,000원 · 총액 기준
--   PER_PERSON  200,000원 · 50,000원 × 4명
--
-- ⚠️ expected_amount 를 바꾸지 않는다. 표시 방식일 뿐이라
--    계획 합계·설정 예산·결산 어디에도 영향을 주지 않는다.
--
-- ⚠️ 인원수는 여기에 저장하지 않는다. trips.headcount 를 그대로 쓴다.
--    인원이 바뀌면 나눈 금액도 따라 바뀌어야 하는데, 복사해 두면
--    같은 여행에서 두 값이 어긋난다.
--
-- 기본값은 TOTAL 이다. 기존 행은 지금 화면에 보이던 그대로 남는다.
-- ============================================================================

alter table public.budget_plan_items
  add column if not exists display_mode text not null default 'TOTAL'
    check (display_mode in ('TOTAL', 'PER_PERSON'));

comment on column public.budget_plan_items.display_mode is
  '목록에서 금액을 보여주는 방식. 총액(TOTAL) 또는 1인당 × 인원(PER_PERSON). '
  '표시에만 쓰며 expected_amount 를 바꾸지 않는다. (BUDGET-02 v2 스펙)';

-- GRANT 은 테이블 단위라 칼럼 추가로 다시 줄 필요는 없다.
-- (20260828000001_grant_anon_access.sql 에서 이미 부여했다)
