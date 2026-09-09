-- ============================================================================
-- trips.status 에 'CANCELED' 추가 + trips.canceled_at 칼럼
-- 기준: 여행 홈 '여행 취소하기' (전원 동의 → 취소 → 72시간 안 되돌리기) · MY-02 취소된 여행 탭
-- 작성일: 2026-09-09
--
-- DELETED 와 다르다. 취소는 되돌릴 수 있고 예산·거래 데이터를 그대로 남긴다.
-- 되돌릴 때 status 는 날짜로 다시 계산한다 (PLANNING / TRAVELING / ENDED).
--
-- canceled_at: 전원 동의가 끝나 취소가 확정된 시각. 되돌리기 72시간의 기준점이다.
--   되돌리면 null 로 되돌린다. 이 값이 없으면 72시간을 셀 수 없다.
--   [검토 필요] 모임원별 동의 기록(누가 언제 동의했나)은 이 마이그레이션에 없다.
--   MVP 에서 동의 흐름을 어디까지 넣을지 정한 뒤 별도 마이그레이션으로 붙인다.
--
-- 스펠링은 CANCELED (L 하나). itinerary_items · orders · REFUND_STATUS 와 같다.
--
-- ⚠️ 두 번 실행해도 안전하게 썼다. (대시보드에서 직접 적용한 뒤 히스토리로도 남긴다)
-- ⚠️ 기존 데이터 마이그레이션 없음. 새 값을 허용할 뿐이다.
-- ⚠️ 반영 후 types/database.ts 를 CLI 로 다시 만든다:
--      npx supabase gen types typescript --linked > types/database.ts
-- ============================================================================

-- 1) CHECK 제약 교체. add constraint 에는 if not exists 가 없어 drop 후 다시 건다.
alter table public.trips drop constraint if exists trips_status_check;
alter table public.trips
  add constraint trips_status_check
  check (status in ('PLANNING', 'TRAVELING', 'ENDED', 'SETTLED', 'DELETED', 'CANCELED'));

-- 2) 취소 확정 시각. null 이면 취소되지 않은 여행이다.
alter table public.trips
  add column if not exists canceled_at timestamptz;

comment on column public.trips.canceled_at is
  '전원 동의로 취소가 확정된 시각. 되돌리기 72시간의 기준. 되돌리면 null';

-- ============================================================================
-- 되돌리기
--   alter table public.trips drop column if exists canceled_at;
--   alter table public.trips drop constraint if exists trips_status_check;
--   alter table public.trips add constraint trips_status_check
--     check (status in ('PLANNING', 'TRAVELING', 'ENDED', 'SETTLED', 'DELETED'));
--   ⚠️ CANCELED 인 행이 남아 있으면 제약 추가가 실패한다. 먼저 update 로 되돌린다.
-- ============================================================================
