-- ============================================================================
-- trips_select — 방금 만든 여행을 만든 사람이 읽을 수 있게 한다 (여행 생성 42501 복구) · 2026-09-16
--
-- 증상: 20260916000008 적용 뒤 여행 생성이 전부 실패한다.
--   createTrip() = insert(...).select()  →  42501 "new row violates row-level security policy for table trips"
--   (개인 · 모임 여행 모두. 00008 적용 이후 생성된 여행 0건)
-- 원인: INSERT 의 WITH CHECK(trips_insert)는 통과하지만, PostgREST 의 .select() 는
--   INSERT … RETURNING 이라 Postgres 가 **새 행을 SELECT 정책(trips_select)으로 한 번 더 검사**한다.
--   trips_select = can_access_trip(id) 인데 이 함수는 STABLE 이라 같은 문장 시작 시점의
--   스냅샷을 보므로 방금 넣은 trips 행을 볼 수 없다 → 항상 거짓 → 42501.
--   (00008 의 주석이 INSERT 쪽은 다뤘지만 RETURNING 검사는 같은 문제를 갖는다)
-- 수정: 만든 사람(leader_user_id) · 개인 여행 주인(owner_user_id)은 함수와 무관하게 행 자체로
--   읽을 수 있게 조건을 인라인으로 덧붙인다. 다른 사람의 여행은 전과 똑같이 can_access_trip 만 본다.
--   보안 범위 변화: 없음 — 여행장/주인이 자기 여행을 읽는 것은 이미 모델상 허용된 접근.
--   RLS 해제 · dev_open_all · 넓은 true 정책 없음. INSERT/UPDATE/DELETE 정책 · 트리거 불변.
--
-- rollback (보고용 · 새 migration 으로만):
--   drop policy if exists "trips_select" on public.trips;
--   create policy "trips_select" on public.trips for select to authenticated
--     using (public.can_access_trip(id));
-- ============================================================================

drop policy if exists "trips_select" on public.trips;

create policy "trips_select" on public.trips
  for select to authenticated
  using (
    public.can_access_trip(id)
    or leader_user_id = auth.uid()
    or owner_user_id = auth.uid()
  );
