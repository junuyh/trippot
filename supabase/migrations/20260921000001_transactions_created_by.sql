-- ============================================================================
-- transactions.created_by_user_id — 이 거래를 적은 사람
--
-- 왜 필요한가 (2026-09-21 테스트)
--   모임 여행에서 입금을 손으로 적으면 날짜와 금액만 남는다. 누가 넣었는지
--   알 방법이 없어서 "이 20만원 누가 넣은 거지" 가 반복됐다. 모임 자금은
--   여러 사람이 같은 목록에 적는 자리라 기록자가 목록의 일부다.
--
-- 범위
--   · 칸 하나를 더한다. 기존 행은 null 로 남는다(누가 적었는지 모르는 기록).
--     화면은 null 이면 이름 줄을 그리지 않는다. 과거 기록에 아무 이름도
--     지어내지 않는다.
--   · 계좌에서 들어온 거래(source_type = ACCOUNT · MOCK)는 사람이 적은 것이
--     아니라 null 로 둔다. 앱이 MANUAL 일 때만 채운다.
--
-- 정책
--   transactions_by_trip 은 여행 참여자면 읽고 쓸 수 있게 되어 있다.
--   그대로 두면 남의 이름을 기록자로 적어 넣을 수 있다. INSERT · UPDATE 의
--   WITH CHECK 에 "기록자는 비었거나 나 자신" 을 더한다. SELECT 범위는
--   바꾸지 않는다 — 같은 여행 참여자는 지금도 서로의 거래를 본다.
--
-- 되돌리기
--   drop policy if exists transactions_by_trip on public.transactions;
--   create policy transactions_by_trip on public.transactions
--     for all to authenticated
--     using (public.can_access_trip(trip_id))
--     with check (public.can_access_trip(trip_id));
--   alter table public.transactions drop column if exists created_by_user_id;
-- ============================================================================

alter table public.transactions
  add column if not exists created_by_user_id uuid
    references public.users (id) on delete set null;

comment on column public.transactions.created_by_user_id is
  '이 거래를 손으로 적은 사람. 계좌에서 들어온 거래와 옛 기록은 null.';

drop policy if exists "transactions_by_trip" on public.transactions;

create policy "transactions_by_trip" on public.transactions
  for all to authenticated
  using (public.can_access_trip(trip_id))
  with check (
    public.can_access_trip(trip_id)
    -- 기록자는 비워 두거나 나 자신이다. 남의 이름으로 적을 수 없다.
    and (
      created_by_user_id is null
      or created_by_user_id = auth.uid()
    )
  );
