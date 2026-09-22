-- ============================================================================
-- transactions 정책 분리 — 참여자 누구나 UPDATE 할 수 있게 한다
--
-- 왜 필요한가 (2026-09-22 테스트)
--   모임 여행에서 다른 참여자가 손으로 적은 거래를 열어 '확인 완료' 를 누르면
--   "저장하지 못했어요" 가 떴다. 20260921000001 이 transactions_by_trip 을
--   FOR ALL 로 두고 WITH CHECK 에 "created_by_user_id 는 비었거나 나" 를 넣었는데,
--   그 조건이 INSERT 뿐 아니라 UPDATE 에도 걸린다. 남이 적은 행은 created_by_user_id
--   가 내가 아니라 어떤 갱신도 WITH CHECK 에서 막힌다 — 분류 확인·카테고리 변경·
--   계획 연결·삭제(deleted_at 채우기) 전부.
--
-- 범위
--   FOR ALL 정책 하나를 명령별 네 개로 가른다.
--     SELECT  여행 참여자면 읽는다                         (변화 없음)
--     INSERT  여행 참여자 + 기록자는 비었거나 나 자신       (변화 없음)
--     UPDATE  여행 참여자면 누구나                         ← 기록자 조건을 뺀다
--     DELETE  여행 참여자면 누구나                         (변화 없음 · 앱은 물리 삭제 안 함)
--
-- ⚠️ UPDATE 의 WITH CHECK 에서 기록자 조건을 빼면 created_by_user_id 를 남의 id 로
--    고쳐 쓰는 것을 정책이 막지 못한다. 앱은 그 칸을 INSERT 때만 채우고 UPDATE 로
--    건드리지 않는다. 표 단위로 막으려면 트리거가 필요하다 — 이 파일은 정책만 다룬다.
--    [검토 필요] created_by_user_id 변경을 트리거로 막을지.
--
-- ⚠️ 두 번 실행해도 안전하다. drop policy if exists 뒤에 create.
-- ⚠️ 표 GRANT · can_access_trip 은 20260916000008 그대로다. 새 권한을 주지 않는다.
--
-- 되돌리기 (20260921000001 의 정책으로 복귀)
--   drop policy if exists "transactions_select" on public.transactions;
--   drop policy if exists "transactions_insert" on public.transactions;
--   drop policy if exists "transactions_update" on public.transactions;
--   drop policy if exists "transactions_delete" on public.transactions;
--   create policy "transactions_by_trip" on public.transactions
--     for all to authenticated
--     using (public.can_access_trip(trip_id))
--     with check (
--       public.can_access_trip(trip_id)
--       and (created_by_user_id is null or created_by_user_id = auth.uid())
--     );
-- ============================================================================

drop policy if exists "transactions_by_trip" on public.transactions;
drop policy if exists "transactions_select" on public.transactions;
drop policy if exists "transactions_insert" on public.transactions;
drop policy if exists "transactions_update" on public.transactions;
drop policy if exists "transactions_delete" on public.transactions;

-- 읽기: 같은 여행 참여자는 서로의 거래를 본다 (지금과 같다)
create policy "transactions_select" on public.transactions
  for select to authenticated
  using (public.can_access_trip(trip_id));

-- 쓰기: 기록자는 비워 두거나 나 자신이다. 남의 이름으로 적을 수 없다
create policy "transactions_insert" on public.transactions
  for insert to authenticated
  with check (
    public.can_access_trip(trip_id)
    and (
      created_by_user_id is null
      or created_by_user_id = auth.uid()
    )
  );

-- 고치기: 여행 참여자면 누가 적었든 고칠 수 있다.
-- 분류 확인·카테고리 변경·계획 연결·삭제(deleted_at)는 모임의 일이지 기록자만의 일이 아니다.
create policy "transactions_update" on public.transactions
  for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

-- 지우기: 여행 참여자면 된다 (앱은 물리 삭제를 하지 않는다 · 예전 규칙과 같다)
create policy "transactions_delete" on public.transactions
  for delete to authenticated
  using (public.can_access_trip(trip_id));
